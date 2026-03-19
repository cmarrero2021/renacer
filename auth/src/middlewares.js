const jwt = require("jsonwebtoken");
const pool = require("./db");

// Middleware para autenticación y verificación de expiración de sesión
exports.authenticate = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ error: "Acceso denegado. Token no proporcionado." });
  }

  const client = await pool.connect();
  try {
    // Verificar si el token está en la lista negra
    const blacklistResult = await client.query(
      "SELECT * FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (blacklistResult.rows.length) {
      return res
        .status(401)
        .json({
          error: "Sesión expirada. Por favor, inicia sesión nuevamente.",
        });
    }

    // Decodificar el token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;

    // Verificar si la sesión está activa y no revocada
    const sessionResult = await client.query(
      "SELECT expires_at FROM sessions WHERE token = $1 AND is_revoked = FALSE",
      [token]
    );

    if (!sessionResult.rows.length) {
      return res
        .status(401)
        .json({ error: "Sesión no encontrada o revocada." });
    }

    const expiresAt = new Date(sessionResult.rows[0].expires_at);
    const currentTime = new Date();
    // Restar 10 segundos a expiresAt

    const expiresAtMinus10s = new Date(expiresAt.getTime() - (process.env.SESSION_PREVIOUS_TIME * 1000));

    if (currentTime > expiresAtMinus10s) {
      // Marcar la sesión como revocada y registrar el logout automático
      await client.query(
        "UPDATE sessions SET is_revoked = TRUE WHERE token = $1",
        [token]
      );

      await client.query(
        "UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2",
        ["expired", token]
      );

      return res
        .status(401)
        .json({
          error: "La sesión ha expirado. Se ha realizado un logout automático.",
        });
    }

    next(); // Continuar con la petición si la sesión no ha expirado
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      // Registrar el vencimiento de la sesión en la auditoría
      await client.query(
        "UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2",
        ["expired", token]
      );
      return res
        .status(401)
        .json({
          error: "La sesión ha expirado. Por favor, inicia sesión nuevamente.",
        });
    }
    res.status(400).json({ error: "Token inválido." });
  } finally {
    client.release();
  }
};
// Middleware para verificar permisos
exports.authorize = (requiredPermission) => {
  return async (req, res, next) => {
    const { userId } = req;

    const client = await pool.connect();
    try {
      // Verificar si el usuario es administrador (bypass de permisos)
      const roleResult = await client.query(
        `SELECT r.name 
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1`,
        [userId]
      );

      const roles = roleResult.rows.map(r => r.name.toLowerCase());
      if (roles.includes('admin') || roles.includes('administrador')) {
        return next();
      }

      // Obtener los permisos del usuario a través de sus roles y permisos directos
      const result = await client.query(
        `
                SELECT p.name AS permission_name
                FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE u.id = $1 AND u.deleted_at IS NULL
                UNION
                SELECT p.name AS permission_name
                FROM users u
                JOIN user_permissions up ON u.id = up.user_id
                JOIN permissions p ON up.permission_id = p.id
                WHERE u.id = $1 AND u.deleted_at IS NULL
            `,
        [userId]
      );

      const userPermissions = result.rows.map((row) => row.permission_name);
      // Verificar si el usuario tiene el permiso requerido
      if (!userPermissions.includes(requiredPermission)) {
        return res
          .status(403)
          .json({ error: "No tienes permiso para realizar esta acción." });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: "Error al verificar los permisos." });
    } finally {
      client.release();
    }
  };
};

// Middleware para verificar si el usuario está verificado
exports.verifyUser = async (req, res, next) => {
  const { userId } = req;

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT is_verified FROM users WHERE id = $1",
      [userId]
    );
    if (!result.rows[0]?.is_verified) {
      return res.status(403).json({ error: "El usuario no está verificado." });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Error al verificar el usuario." });
  } finally {
    client.release();
  }
};

// Middleware para verificar si el token está en la lista negra
exports.checkBlacklist = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return next();

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (result.rows.length) {
      return res
        .status(401)
        .json({
          error: "Sesión expirada. Por favor, inicia sesión nuevamente.",
        });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Error al verificar el token." });
  } finally {
    client.release();
  }
};
