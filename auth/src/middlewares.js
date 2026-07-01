const jwt = require("jsonwebtoken");
const pool = require("./db");

exports.authenticate = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Acceso denegado. Token no proporcionado." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "La sesión ha expirado. Por favor, inicia sesión nuevamente." });
    }
    return res.status(401).json({ error: "Token inválido." });
  }
  req.userId = decoded.userId;

  const client = await pool.connect();
  try {
    // Query principal: sesión + blacklist (siempre debe funcionar)
    const sessionResult = await client.query(`
      SELECT expires_at FROM sessions
      WHERE token = $1 AND is_revoked = FALSE
    `, [token]);

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: "Sesión no encontrada o revocada." });
    }

    const sessionRow = sessionResult.rows[0];

    // Blacklist
    const blacklistResult = await client.query(
      `SELECT 1 FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (blacklistResult.rows.length) {
      return res.status(401).json({ error: "Sesión expirada. Por favor, inicia sesión nuevamente." });
    }

    const expiresAt = new Date(sessionRow.expires_at);
    const expiresAtMinusBuffer = new Date(expiresAt.getTime() - (parseInt(process.env.SESSION_PREVIOUS_TIME, 10) || 10) * 1000);

    if (new Date() > expiresAtMinusBuffer) {
      await client.query("UPDATE sessions SET is_revoked = TRUE WHERE token = $1", [token]);
      await client.query(
        "UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2",
        ["expired", token]
      );
      return res.status(401).json({ error: "La sesión ha expirado. Se ha realizado un logout automático." });
    }

    // Query secundaria: roles + permisos (puede fallar sin romper auth)
    try {
      const permResult = await client.query(`
        SELECT
          COALESCE(
            (SELECT ARRAY_AGG(DISTINCT r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1),
            ARRAY[]::text[]
          ) AS roles,
          COALESCE(
            (SELECT ARRAY_AGG(DISTINCT p.name) FROM (
              SELECT p.name FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = $1
              UNION
              SELECT p.name FROM user_roles ur JOIN role_permissions rp ON ur.role_id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = $1
            ) perms),
            ARRAY[]::text[]
          ) AS permissions
      `, [req.userId]);
      req.roles = permResult.rows[0]?.roles || [];
      req.permissions = permResult.rows[0]?.permissions || [];
    } catch (permErr) {
      console.error("⚠️ Error cargando roles/permisos:", permErr.message);
      req.roles = [];
      req.permissions = [];
    }

    next();
  } catch (err) {
    console.error("Error en authenticate:", err.message);
    return res.status(500).json({ error: "Error al verificar la autenticación." });
  } finally {
    client.release();
  }
};

exports.authorize = (requiredPermission) => {
  return (req, res, next) => {
    if (req.roles.some(r => r.toLowerCase() === 'admin' || r.toLowerCase() === 'administrador')) {
      return next();
    }
    if (!req.permissions.includes(requiredPermission)) {
      return res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
};

exports.verifyUser = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT is_verified, is_email_verified FROM users WHERE id = $1",
      [req.userId]
    );
    const isVerified = result.rows[0]?.is_verified ?? result.rows[0]?.is_email_verified ?? false;
    if (!isVerified) {
      return res.status(403).json({ error: "El usuario no está verificado." });
    }
    next();
  } catch (err) {
    console.error("Error en verifyUser:", err.message);
    return res.status(500).json({ error: "Error al verificar el usuario." });
  } finally {
    client.release();
  }
};
