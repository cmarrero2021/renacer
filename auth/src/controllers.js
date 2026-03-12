const jwt = require("jsonwebtoken");
const pool = require("./db");
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateSecureToken,
  sendEmail,
  validatePassword,
  getSessionTimeout,
  getCooldownMinutes,
  generateResetCode,
  sendResetCodeEmail,
  isTwoFactorEnabled,
} = require("./utils");
const moment = require("moment-timezone");
const { withAuditContext } = require("./audit");

// Simple health/prueba endpoint
exports.prueba = async (req, res) => {
  res.status(200).json({ message: "Prueba exitosa." });
};

// Verificar Correo Electrónico
exports.verifyEmail = async (req, res) => {
  const { token } = req.body;
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT user_id, expires_at FROM email_verifications WHERE token = $1",
      [token]
    );
    if (!result.rows.length || new Date(result.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: "Token inválido o expirado." });
    }

    await client.query("UPDATE users SET is_verified = TRUE WHERE id = $1", [
      result.rows[0].user_id,
    ]);
    await client.query("DELETE FROM email_verifications WHERE token = $1", [
      token,
    ]);

    res.status(200).json({ message: "Correo verificado exitosamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al verificar el correo." });
  } finally {
    client.release();
  }
};

// Cambiar Contraseña
exports.changePassword = async (req, res) => {
  const { userId } = req; // Obtenido del middleware de autenticación
  const { oldPassword, newPassword } = req.body;

  const passwordErrors = validatePassword(newPassword);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ errors: passwordErrors });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );
    const isMatch = await comparePassword(
      oldPassword,
      result.rows[0].password_hash
    );
    if (!isMatch) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta." });
    }

    const hashedPassword = await hashPassword(newPassword);
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);

    res.status(200).json({ message: "Contraseña cambiada exitosamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar la contraseña." });
  } finally {
    client.release();
  }
};

// Listar Usuarios
exports.listUsers = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, first_name,last_name,cedula,email, is_email_verified, status, session_timeout_min, two_factor_enabled FROM users WHERE deleted_at IS NULL"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al listar los usuarios." });
  } finally {
    client.release();
  }
};

// Actualizar Usuario
exports.updateUser = async (req, res) => {
  const { userId } = req.params;
  const { first_name, last_name, cedula, email, password, session_timeout_min, two_factor_enabled } = req.body;

  const client = await pool.connect();
  try {
    // Convertir session_timeout_min a número o null
    const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;
    // Manejar two_factor_enabled (si viene en el body, lo usamos; si no, true por defecto)
    // Convertir explícitamente a booleano si es posible
    let twoFactor = true;
    if (two_factor_enabled === 'false' || two_factor_enabled === false) {
      twoFactor = false;
    } else if (two_factor_enabled === 'true' || two_factor_enabled === true) {
      twoFactor = true;
    }
    console.log(`[DEBUG] updateUser: userId=${userId}, body.two_factor_enabled=${two_factor_enabled}, final=${twoFactor}`);

    if (password) {
      // Validar fortaleza de la contraseña si se proporciona
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ error: passwordErrors.join(" ") });
      }
      const hashedPassword = await hashPassword(password);

      await client.query(
        "UPDATE users SET first_name = $1, last_name = $2, cedula = $3, email = $4, password_hash = $5, session_timeout_min = $6, two_factor_enabled = $7, updated_at = NOW() WHERE id = $8",
        [first_name, last_name, cedula, email, hashedPassword, timeout, twoFactor, userId]
      );
    } else {
      await client.query(
        "UPDATE users SET first_name = $1, last_name = $2, cedula = $3, email = $4, session_timeout_min = $5, two_factor_enabled = $6, updated_at = NOW() WHERE id = $7",
        [first_name, last_name, cedula, email, timeout, twoFactor, userId]
      );
    }
    res.status(200).json({ message: "Usuario actualizado exitosamente." });
  } catch (err) {
    console.error("Error al actualizar usuario:", err);
    res.status(500).json({ error: "Error al actualizar el usuario." });
  } finally {
    client.release();
  }
};

// Eliminar Usuario (Borrado Lógico)
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;

  const client = await pool.connect();
  try {
    await client.query("UPDATE users SET deleted_at = NOW() WHERE id = $1", [
      userId,
    ]);
    res.status(200).json({ message: "Usuario eliminado lógicamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar el usuario." });
  } finally {
    client.release();
  }
};

// Eliminar Usuario (Borrado Físico)
exports.deleteUserPermanently = async (req, res) => {
  const { userId } = req.params;

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    res.status(200).json({ message: "Usuario eliminado permanentemente." });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Error al eliminar el usuario permanentemente." });
  } finally {
    client.release();
  }
};

// Crear Rol
exports.createRole = async (req, res) => {
  const { name, description, session_timeout_min } = req.body;

  // Convertir session_timeout_min a número o null
  const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;

  const client = await pool.connect();
  try {
    const result = await client.query(
      "INSERT INTO roles (name, description, session_timeout_min) VALUES ($1, $2, $3) RETURNING id",
      [name, description, timeout]
    );
    res
      .status(201)
      .json({ message: "Rol creado exitosamente.", roleId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: "Error al crear el rol." });
  } finally {
    client.release();
  }
};

// Listar Roles
exports.listRoles = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, name, description, session_timeout_min FROM roles"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al listar los roles." });
  } finally {
    client.release();
  }
};

// Listar Permisos
exports.listPermissions = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, name, resource, action, description FROM permissions ORDER BY resource, action"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al listar los permisos." });
  } finally {
    client.release();
  }
};

// Crear Permiso
exports.createPermission = async (req, res) => {
  const { name, description, resource, action } = req.body;

  if (!name) {
    return res.status(400).json({ error: "El nombre del permiso es obligatorio." });
  }

  if (!resource || !action) {
    return res.status(400).json({ error: "El recurso y la acción son obligatorios." });
  }

  const client = await pool.connect();
  try {
    // Verificar si ya existe un permiso con ese nombre
    const exists = await client.query(
      "SELECT id FROM permissions WHERE name = $1",
      [name]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe un permiso con ese nombre." });
    }

    const result = await client.query(
      "INSERT INTO permissions (name, resource, action, description) VALUES ($1, $2, $3, $4) RETURNING id, name, resource, action, description",
      [name, resource, action, description || null]
    );
    res.status(201).json({
      message: "Permiso creado exitosamente.",
      permission: result.rows[0]
    });
  } catch (err) {
    console.error("Error al crear permiso:", err);
    res.status(500).json({ error: "Error al crear el permiso." });
  } finally {
    client.release();
  }
};

// Actualizar Permiso
exports.updatePermission = async (req, res) => {
  const { permissionId } = req.params;
  const { name, description, resource, action } = req.body;

  if (!name) {
    return res.status(400).json({ error: "El nombre del permiso es obligatorio." });
  }

  if (!resource || !action) {
    return res.status(400).json({ error: "El recurso y la acción son obligatorios." });
  }

  const client = await pool.connect();
  try {
    // Verificar si otro permiso ya tiene ese nombre
    const exists = await client.query(
      "SELECT id FROM permissions WHERE name = $1 AND id != $2",
      [name, permissionId]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Ya existe otro permiso con ese nombre." });
    }

    const result = await client.query(
      "UPDATE permissions SET name = $1, resource = $2, action = $3, description = $4 WHERE id = $5 RETURNING id, name, resource, action, description",
      [name, resource, action, description || null, permissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Permiso no encontrado." });
    }

    res.status(200).json({
      message: "Permiso actualizado exitosamente.",
      permission: result.rows[0]
    });
  } catch (err) {
    console.error("Error al actualizar permiso:", err);
    res.status(500).json({ error: "Error al actualizar el permiso." });
  } finally {
    client.release();
  }
};

// Eliminar Permiso
exports.deletePermission = async (req, res) => {
  const { permissionId } = req.params;

  const client = await pool.connect();
  try {
    // Primero eliminar las asignaciones de este permiso a roles y usuarios
    await client.query("DELETE FROM role_permissions WHERE permission_id = $1", [permissionId]);
    await client.query("DELETE FROM user_permissions WHERE permission_id = $1", [permissionId]);

    // Luego eliminar el permiso
    const result = await client.query(
      "DELETE FROM permissions WHERE id = $1 RETURNING id",
      [permissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Permiso no encontrado." });
    }

    res.status(200).json({ message: "Permiso eliminado exitosamente." });
  } catch (err) {
    console.error("Error al eliminar permiso:", err);
    res.status(500).json({ error: "Error al eliminar el permiso." });
  } finally {
    client.release();
  }
};

exports.listRolesPermissions = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT a.role_id,b.name AS rol,a.permission_id,c.name AS permission,c.description FROM role_permissions a LEFT JOIN roles b ON b.id = a.role_id LEFT JOIN permissions c ON c.id = a.permission_id ORDER BY b.name,  c.name"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al listar los permisos." });
  } finally {
    client.release();
  }
};

exports.listUserssPermissions = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT a.user_id,b.email AS rol,a.permission_id,c.name AS PERMISSION,c.description FROM user_permissions a LEFT JOIN users b ON b.id = a.user_id LEFT JOIN permissions c ON c.id = a.permission_id ORDER BY b.email,c.name"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al listar los permisos." });
  } finally {
    client.release();
  }
};

exports.listUserRoles = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT a.user_id, b.first_name, b.last_name, a.role_id, c.name as role_name FROM user_roles a JOIN users b ON a.user_id = b.id JOIN roles c ON a.role_id = c.id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error al listar roles de usuarios:", err);
    res.status(500).json({ error: "Error al listar roles de usuarios." });
  } finally {
    client.release();
  }
};

// Login (Fase 1: validar credenciales + enviar código 2FA)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  const client = await pool.connect();
  try {
    // Sesión activa no expirada
    const activeSession = await client.query(
      "SELECT * FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1) AND is_revoked = false",
      [username]
    );

    if (activeSession.rows.length > 0) {
      const session = activeSession.rows[0];
      const sessionExpiration = moment.tz(session.expires_at, "America/Caracas");
      const currentTime = moment.tz("America/Caracas");
      if (currentTime.isBefore(sessionExpiration)) {
        return res.status(403).json({
          error: "La sesión del usuario ya está abierta y no ha expirado.",
        });
      } else {
        await client.query("UPDATE sessions SET is_revoked = true WHERE id = $1", [
          session.id,
        ]);
      }
    }

    // Buscar usuario
    const result = await client.query(
      "SELECT id, first_name, last_name, email, password_hash, status, failed_login_attempts, last_failed_login, last_login_attempt FROM users WHERE email = $1",
      [username]
    );


    if (!result.rows.length) {
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "failed"]
      );
      return res
        .status(400)
        .json({ error: "Nombre de usuario o contraseña incorrectos." });
    }

    const user = result.rows[0];

    // ============================================
    // Verificar cooldown entre intentos de login
    // ============================================
    const cooldownMin = await getCooldownMinutes(user.id);
    if (cooldownMin > 0 && user.last_login_attempt) {
      const lastAttempt = moment.tz(user.last_login_attempt, "America/Caracas");
      const cooldownEnd = lastAttempt.clone().add(cooldownMin, 'minutes');
      const now = moment.tz("America/Caracas");
      if (now.isBefore(cooldownEnd)) {
        const remainingSec = cooldownEnd.diff(now, 'seconds');
        const remainingMin = Math.ceil(remainingSec / 60);
        await client.query(
          "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
          [username, ip, "cooldown"]
        );
        return res.status(429).json({
          error: `Debe esperar ${remainingMin} minuto(s) antes de volver a intentar iniciar sesión.`,
          cooldown: true,
          remainingSeconds: remainingSec
        });
      }
    }

    // Registrar timestamp de este intento de login
    await client.query(
      "UPDATE users SET last_login_attempt = NOW() WHERE id = $1",
      [user.id]
    );
    const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'recam@minaamp.gob.ve';

    // Estados de usuario
    if (user.status === "deleted") {
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "failed"]
      );
      return res.status(403).json({ error: "El usuario ha sido dado de baja." });
    }
    if (user.status === "suspended") {
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "failed"]
      );
      return res.status(403).json({
        error: `El usuario está suspendido. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Intentos fallidos recientes
    if (
      user.failed_login_attempts >= 3 &&
      moment
        .tz(user.last_failed_login, "America/Caracas")
        .isAfter(moment.tz("America/Caracas").subtract(15, "minutes"))
    ) {
      await client.query("UPDATE users SET status = $1 WHERE id = $2", [
        "suspended",
        user.id,
      ]);
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "blocked"]
      );
      return res.status(403).json({
        error: `El usuario ha sido bloqueado debido a múltiples intentos fallidos. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Verificar password
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await client.query(
        "UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1",
        [user.id]
      );
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "failed"]
      );
      return res
        .status(400)
        .json({ error: "Nombre de usuario o contraseña incorrectos." });
    }

    const is2faEnabled = await isTwoFactorEnabled(user.id);

    if (!is2faEnabled) {
      // ============================================
      // 2FA DESACTIVADO: Iniciar sesión directamente
      // ============================================
      console.log(`🔓 LOGIN DIRECTO (2FA Deshabilitado): ${user.email}`);

      // Duración de sesión
      const timeoutMin = await getSessionTimeout(user.id);
      const expiresInSeconds = Math.max(parseInt(timeoutMin, 10) || 20, 1) * 60;
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: expiresInSeconds,
      });

      // Registrar sesión
      await client.query(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + $3 * INTERVAL '1 minute')",
        [user.id, token, parseInt(timeoutMin, 10) || 20]
      );

      // Permisos del usuario
      const permissionsQuery = `
        SELECT DISTINCT p.name, p.description, p.action, p.resource
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
        UNION
        SELECT DISTINCT p.name, p.description, p.action, p.resource
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
        ORDER BY resource, action
      `;
      const permissionsResult = await client.query(permissionsQuery, [user.id]);
      const permissions = permissionsResult.rows;

      // Rol del usuario
      const roleQuery = `
        SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 LIMIT 1
      `;
      const roleResult = await client.query(roleQuery, [user.id]);
      const role = roleResult.rows[0]?.name || null;

      // Auditoría
      await client.query(
        "INSERT INTO login_logs (user_id, username, ip_address, login_status, session_token) VALUES ($1, $2, $3, $4, $5)",
        [user.id, username, ip, "success", token]
      );

      return res.status(200).json({
        message: "Inicio de sesión exitoso.",
        token,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        sessionDuration: expiresInSeconds / 60,
        role,
        permissions,
      });

    }

    // ============================================
    // 2FA HABILITADO: Proceder con envío de código
    // ============================================

    // Contar solicitudes de código 2FA en los últimos 30 minutos
    const recentCodesResult = await client.query(
      "SELECT MAX(request_count) as max_requests FROM two_factor_codes WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 minutes'",
      [user.id]
    );
    const currentRequestCount = recentCodesResult.rows[0]?.max_requests || 0;

    if (currentRequestCount >= 3) {
      // Suspender cuenta
      await client.query(
        "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1",
        [user.id]
      );
      await client.query(
        "INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)",
        [username, ip, "blocked"]
      );
      return res.status(403).json({
        error: `Ha excedido el número máximo de solicitudes de código. Su cuenta ha sido suspendida. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Invalidar códigos anteriores
    await client.query("DELETE FROM two_factor_codes WHERE user_id = $1", [user.id]);

    // Generar código 2FA
    const code = generateResetCode();
    const hashedCode = await hashPassword(code);

    // Guardar código (expira en 10 min)
    await client.query(
      "INSERT INTO two_factor_codes (user_id, code_hash, expires_at, request_count) VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)",
      [user.id, hashedCode, currentRequestCount + 1]
    );

    // Enviar código por email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="cid:logo@app" alt="${process.env.APP_NAME || 'Logo'}" style="max-width: 300px; height: auto;" />
        </div>
        <h2 style="color: #273984; text-align: center;">Código de Verificación</h2>
        <p>Se ha solicitado un código de verificación para iniciar sesión en su cuenta.</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #273984; background: #f5f5f5; padding: 12px 24px; border-radius: 8px;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">Este código es válido por <strong>10 minutos</strong>.</p>
        <p style="color: #666; font-size: 14px;">Si no solicitó este código, cambie su contraseña inmediatamente.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">${process.env.APP_NAME || 'Sistema'}</p>
      </div>
    `;

    await sendEmail(
      user.email,
      'Código de Verificación - Inicio de Sesión',
      `Su código de verificación es: ${code}. Válido por 10 minutos.`,
      html
    );

    console.log(`\n==========================================`);
    console.log(`🔐 CÓDIGO 2FA GENERADO (DEBUG): ${code}`);
    console.log(`📧 DESTINATARIO: ${user.email}`);
    console.log(`==========================================\n`);

    // Generar token temporal para la fase 2FA (10 min)
    const tempToken = jwt.sign(
      { userId: user.id, purpose: '2fa-pending' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    await client.query(
      "INSERT INTO login_logs (user_id, username, ip_address, login_status) VALUES ($1, $2, $3, $4)",
      [user.id, username, ip, "2fa-pending"]
    );

    const attemptsLeft = 3 - (currentRequestCount + 1);
    res.status(200).json({
      requires2FA: true,
      tempToken,
      message: 'Se ha enviado un código de verificación a su correo electrónico.',
      attemptsLeft
    });
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    res.status(500).json({ error: "Error en el inicio de sesión." });
  } finally {
    client.release();
  }
};

// Verificar código 2FA (Fase 2: completar login)
exports.verify2FA = async (req, res) => {
  const { tempToken, code } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const client = await pool.connect();

  try {
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Token temporal y código son requeridos.' });
    }

    // Verificar token temporal
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (decoded.purpose !== '2fa-pending') {
        return res.status(400).json({ error: 'Token de verificación inválido.' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Token de verificación inválido o expirado.' });
    }

    const userId = decoded.userId;
    const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'recam@minaamp.gob.ve';

    // Verificar estado del usuario
    const userCheck = await client.query(
      'SELECT first_name, last_name, email, status FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!userCheck.rows.length || userCheck.rows[0].status === 'suspended') {
      return res.status(403).json({
        error: `Su cuenta ha sido suspendida. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Buscar código 2FA vigente
    const codeResult = await client.query(
      'SELECT id, code_hash, expires_at, attempts FROM two_factor_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (!codeResult.rows.length) {
      return res.status(400).json({ error: 'No hay código de verificación pendiente. Inicie sesión nuevamente.' });
    }

    const codeRecord = codeResult.rows[0];

    // Verificar expiración
    if (new Date(codeRecord.expires_at) < new Date()) {
      await client.query('DELETE FROM two_factor_codes WHERE id = $1', [codeRecord.id]);
      return res.status(400).json({ error: 'El código ha expirado. Inicie sesión nuevamente para recibir un nuevo código.', expired: true });
    }

    // Verificar intentos (máx 3)
    if (codeRecord.attempts >= 3) {
      await client.query('DELETE FROM two_factor_codes WHERE id = $1', [codeRecord.id]);
      return res.status(400).json({
        error: 'Ha excedido el número máximo de intentos. Inicie sesión nuevamente para recibir un nuevo código.',
        codeInvalidated: true
      });
    }

    // Verificar código
    const isValid = await comparePassword(code, codeRecord.code_hash);
    if (!isValid) {
      // Incrementar intentos
      const newAttempts = codeRecord.attempts + 1;
      await client.query(
        'UPDATE two_factor_codes SET attempts = $1 WHERE id = $2',
        [newAttempts, codeRecord.id]
      );
      const remaining = 3 - newAttempts;
      if (remaining <= 0) {
        await client.query('DELETE FROM two_factor_codes WHERE id = $1', [codeRecord.id]);
        return res.status(400).json({
          error: 'Código incorrecto. Ha excedido el número máximo de intentos. Inicie sesión nuevamente para recibir un nuevo código.',
          codeInvalidated: true
        });
      }
      return res.status(400).json({
        error: `Código incorrecto. Le quedan ${remaining} intento(s).`,
        attemptsLeft: remaining
      });
    }

    // ============================================
    // CÓDIGO CORRECTO: Completar login
    // ============================================

    // Limpiar códigos 2FA
    await client.query('DELETE FROM two_factor_codes WHERE user_id = $1', [userId]);

    // Duración de sesión
    const timeoutMin = await getSessionTimeout(userId);
    const expiresInSeconds = Math.max(parseInt(timeoutMin, 10) || 20, 1) * 60;
    const token = jwt.sign({ userId: userId }, process.env.JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });

    // Registrar sesión
    await client.query(
      "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + $3 * INTERVAL '1 minute')",
      [userId, token, parseInt(timeoutMin, 10) || 20]
    );

    // Permisos del usuario
    const permissionsQuery = `
      SELECT DISTINCT p.name, p.description, p.action, p.resource
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1
      UNION
      SELECT DISTINCT p.name, p.description, p.action, p.resource
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
      ORDER BY resource, action
    `;
    const permissionsResult = await client.query(permissionsQuery, [userId]);
    const permissions = permissionsResult.rows;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Usuario logueado (2FA): ${userCheck.rows[0].email} (ID: ${userId})`);
    console.log(`📋 Permisos del usuario (${permissions.length} permisos)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Rol del usuario
    const roleQuery = `
      SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 LIMIT 1
    `;
    const roleResult = await client.query(roleQuery, [userId]);
    const role = roleResult.rows[0]?.name || null;

    // Auditoría
    await client.query(
      "INSERT INTO login_logs (user_id, username, ip_address, login_status, session_token) VALUES ($1, $2, $3, $4, $5)",
      [userId, userCheck.rows[0].email, ip, "success", token]
    );

    res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      email: userCheck.rows[0].email,
      firstName: userCheck.rows[0].first_name,
      lastName: userCheck.rows[0].last_name,
      sessionDuration: expiresInSeconds / 60,
      role,
      permissions,
    });

  } catch (err) {
    console.error("❌ Error en verify2FA:", err.message);
    res.status(500).json({ error: "Error al verificar el código." });
  } finally {
    client.release();
  }
};

// Logout
exports.logout = async (req, res) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res.status(400).json({ error: "No se proporcionó un token." });
  }

  const decoded = jwt.decode(token);
  const userId = decoded?.userId;

  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2",
      ["logout", token]
    );
    await client.query("UPDATE sessions SET is_revoked = $1 WHERE token = $2", [
      true,
      token,
    ]);

    if (decoded?.exp) {
      const expiresAt = new Date(decoded.exp * 1000);
      await client.query(
        "INSERT INTO blacklisted_tokens (token, expires_at) VALUES ($1, $2)",
        [token, expiresAt]
      );
    }

    res.status(200).json({ message: "Cierre de sesión exitoso." });
  } catch (err) {
    res.status(500).json({ error: "Error al cerrar sesión." });
  } finally {
    client.release();
  }
};

// Logout forzado
exports.forceLogout = async (req, res) => {
  const userId = req.body.userId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE user_id = $2",
      ["force logout", userId]
    );

    await client.query(
      "UPDATE sessions SET is_revoked = $1 WHERE user_id = $2",
      [true, userId]
    );

    await client.query("COMMIT");
    res.status(200).json({ message: "Cierre forzoso de sesión exitoso." });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al cerrar sesión." });
  } finally {
    client.release();
  }
};

// ================================
// Configuración de sesión
// ================================

exports.getGlobalSessionTimeout = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT global_timeout FROM session_settings WHERE id = 1"
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Configuración global no encontrada" });
    }

    res.json({ timeout: result.rows[0].global_timeout });
  } catch (err) {
    console.error("❌ Error al obtener configuración global:", err.message);
    res
      .status(500)
      .json({ error: "Error al obtener la configuración global de sesión" });
  }
};

exports.updateGlobalSessionTimeout = async (req, res) => {
  const { timeout } = req.body;

  if (!timeout || typeof timeout !== "number" || timeout <= 0) {
    return res
      .status(400)
      .json({ error: "La duración debe ser un número positivo." });
  }

  try {
    await pool.query(
      "UPDATE session_settings SET global_timeout = $1 WHERE id = 1",
      [timeout]
    );

    res.json({
      message: "Duración global de sesión actualizada exitosamente.",
    });
  } catch (err) {
    console.error("❌ Error al actualizar configuración global:", err.message);
    res
      .status(500)
      .json({ error: "Error al actualizar la duración global de sesión" });
  }
};

exports.updateUserSessionTimeout = async (req, res) => {
  const { userId } = req.params;
  const { timeout } = req.body;

  if (!timeout || typeof timeout !== "number" || timeout <= 0) {
    return res
      .status(400)
      .json({ error: "La duración debe ser un número positivo." });
  }

  try {
    const userExists = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    await pool.query(
      "UPDATE users SET session_timeout_min = $1 WHERE id = $2",
      [timeout, userId]
    );

    res.json({
      message: "Duración de sesión del usuario actualizada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error al actualizar sesión de usuario:", err.message);
    res
      .status(500)
      .json({ error: "Error al actualizar la duración de sesión del usuario" });
  }
};

exports.updateRoleSessionTimeout = async (req, res) => {
  const { roleId } = req.params;
  const { timeout } = req.body;

  if (!timeout || typeof timeout !== "number" || timeout <= 0) {
    return res
      .status(400)
      .json({ error: "La duración debe ser un número positivo." });
  }

  try {
    const roleExists = await pool.query("SELECT id FROM roles WHERE id = $1", [
      roleId,
    ]);
    if (roleExists.rows.length === 0) {
      return res.status(404).json({ error: "Rol no encontrado." });
    }

    await pool.query(
      "UPDATE roles SET session_timeout_min = $1 WHERE id = $2",
      [timeout, roleId]
    );

    res.json({
      message: "Duración de sesión del rol actualizada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error al actualizar sesión de rol:", err.message);
    res
      .status(500)
      .json({ error: "Error al actualizar la duración de sesión del rol" });
  }
};

// Crear Usuario
exports.createUser = async (req, res) => {
  const { first_name, last_name, cedula, email, password, session_timeout_min } = req.body;

  // Validar campos requeridos
  if (!first_name || !last_name || !cedula || !email || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  // Validar fortaleza de la contraseña
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: passwordErrors.join(" ") });
  }

  const client = await pool.connect();
  try {
    // Verificar si el usuario ya existe (que no haya sido borrado)
    const userExist = await client.query(
      "SELECT id FROM users WHERE (email = $1 OR cedula = $2) AND deleted_at IS NULL",
      [email, cedula]
    );
    if (userExist.rows.length > 0) {
      return res.status(409).json({ error: "El usuario ya existe (email o cédula)." });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Manejar two_factor_enabled (si viene en el body, lo usamos; si no, true por defecto)
    let twoFactor = true;
    const { two_factor_enabled } = req.body;
    if (two_factor_enabled === 'false' || two_factor_enabled === false) {
      twoFactor = false;
    } else if (two_factor_enabled === 'true' || two_factor_enabled === true) {
      twoFactor = true;
    }

    // Convertir session_timeout_min a número o null
    const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;

    // Insertar usuario
    const newUser = await client.query(
      "INSERT INTO users (first_name, last_name, cedula, email, password_hash, session_timeout_min, two_factor_enabled, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id, first_name, last_name, email, two_factor_enabled",
      [first_name, last_name, cedula, email, hashedPassword, timeout, twoFactor]
    );

    res.status(201).json({
      message: "Usuario creado exitosamente.",
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    res.status(500).json({ error: "Error al crear el usuario." });
  } finally {
    client.release();
  }
};

// Actualizar Rol
exports.updateRole = async (req, res) => {
  const { roleId } = req.params;
  const { name, description, session_timeout_min } = req.body;

  // Convertir session_timeout_min a número o null
  const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;

  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE roles SET name = $1, description = $2, session_timeout_min = $3, updated_at = NOW() WHERE id = $4",
      [name, description, timeout, roleId]
    );
    res.status(200).json({ message: "Rol actualizado exitosamente." });
  } catch (err) {
    console.error("Error al actualizar rol:", err);
    res.status(500).json({ error: "Error al actualizar el rol." });
  } finally {
    client.release();
  }
};

// Eliminar Rol
exports.deleteRole = async (req, res) => {
  const { roleId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM roles WHERE id = $1", [roleId]);
    res.status(200).json({ message: "Rol eliminado exitosamente." });
  } catch (err) {
    console.error("Error al eliminar rol:", err);
    res.status(500).json({ error: "Error al eliminar el rol." });
  } finally {
    client.release();
  }
};

// Asignar Rol a Usuario
exports.assignRoleToUser = async (req, res) => {
  const { userId, roleId } = req.body;

  if (!userId || !roleId) {
    return res.status(400).json({ error: "userId y roleId son requeridos." });
  }

  const client = await pool.connect();
  try {
    // Verificar si ya existe la asignación
    const check = await client.query(
      "SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2",
      [userId, roleId]
    );

    if (check.rows.length > 0) {
      return res.status(200).json({ message: "El rol ya está asignado al usuario." });
    }

    // Insertar si no existe
    await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userId, roleId]
    );
    res.status(200).json({ message: "Rol asignado exitosamente." });
  } catch (err) {
    console.error("Error al asignar rol:", err);
    res.status(500).json({ error: "Error al asignar el rol: " + err.message });
  } finally {
    client.release();
  }
};

// Remover Rol de Usuario
exports.removeRoleFromUser = async (req, res) => {
  const { userId, roleId } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2",
      [userId, roleId]
    );
    res.status(200).json({ message: "Rol removido exitosamente." });
  } catch (err) {
    console.error("Error al remover rol:", err);
    res.status(500).json({ error: "Error al remover el rol." });
  } finally {
    client.release();
  }
};

// Asignar Permiso a Rol
exports.assignPermissionToRole = async (req, res) => {
  const { roleId, permissionId } = req.body;

  if (!roleId || !permissionId) {
    return res.status(400).json({ error: "roleId y permissionId son requeridos." });
  }

  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT * FROM role_permissions WHERE role_id = $1 AND permission_id = $2",
      [roleId, permissionId]
    );

    if (check.rows.length > 0) {
      return res.status(200).json({ message: "El permiso ya está asignado al rol." });
    }

    await client.query(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
      [roleId, permissionId]
    );
    res.status(200).json({ message: "Permiso asignado al rol exitosamente." });
  } catch (err) {
    console.error("Error al asignar permiso a rol:", err);
    res.status(500).json({ error: "Error al asignar permiso al rol: " + err.message });
  } finally {
    client.release();
  }
};

// Remover Permiso de Rol
exports.removePermissionFromRole = async (req, res) => {
  const { roleId, permissionId } = req.body;

  if (!roleId || !permissionId) {
    return res.status(400).json({ error: "roleId y permissionId son requeridos." });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2",
      [roleId, permissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No se encontró la asignación para eliminar." });
    }

    res.status(200).json({ message: "Permiso removido del rol exitosamente." });
  } catch (err) {
    console.error("Error al remover permiso de rol:", err);
    res.status(500).json({ error: "Error al remover permiso del rol: " + err.message });
  } finally {
    client.release();
  }
};

// Asignar Permiso a Usuario (Directo)
exports.assignPermissionToUser = async (req, res) => {
  const { userId, permissionId } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT (user_id, permission_id) DO NOTHING",
      [userId, permissionId]
    );
    res.status(200).json({ message: "Permiso asignado al usuario exitosamente." });
  } catch (err) {
    console.error("Error al asignar permiso a usuario:", err);
    res.status(500).json({ error: "Error al asignar permiso al usuario." });
  } finally {
    client.release();
  }
};

// Remover Permiso de Usuario (Directo)
exports.removePermissionFromUser = async (req, res) => {
  const { userId, permissionId } = req.body;
  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2",
      [userId, permissionId]
    );
    res.status(200).json({ message: "Permiso removido del usuario exitosamente." });
  } catch (err) {
    console.error("Error al remover permiso de usuario:", err);
    res.status(500).json({ error: "Error al remover permiso del usuario." });
  } finally {
    client.release();
  }
};

// ================================
// AUDITORÍA - LOGIN LOGS
// ================================

// Listar Login Logs
exports.listLoginLogs = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id, 
        user_id, 
        username, 
        ip_address::text as ip_address, 
        login_status, 
        login_timestamp, 
        logout_type, 
        logout_timestamp, 
        session_token 
      FROM login_logs 
      ORDER BY id DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error al listar login logs:", err);
    res.status(500).json({ error: "Error al listar los registros de ingreso." });
  } finally {
    client.release();
  }
};

// Listar Audit Logs (Acciones)
exports.listAuditLogs = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id,
        fecha,
        id_usuario,
        usuario,
        ip::text as ip,
        tabla,
        accion,
        id_registro,
        datos_anteriores,
        datos_nuevos,
        campos_modificados,
        comando_sql
      FROM vaudit_logs 
      ORDER BY id DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error al listar audit logs:", err);
    res.status(500).json({ error: "Error al listar los registros de acciones." });
  } finally {
    client.release();
  }
};

// ==========================================
// CONFIGURACIÓN DE SESIÓN (MANTENIMIENTO)
// ==========================================

exports.getSessionSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT global_timeout, two_factor_enabled FROM session_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      // Si por alguna razón no hay registro, devolver default
      return res.json({ global_timeout: 60, two_factor_enabled: true });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener configuración de sesión:', err);
    res.status(500).json({ error: 'Error al obtener configuración.' });
  } finally {
    client.release();
  }
};

exports.updateSessionSettings = async (req, res) => {
  const { global_timeout, two_factor_enabled } = req.body;
  if (global_timeout && (isNaN(global_timeout) || global_timeout < 1)) {
    return res.status(400).json({ error: 'El tiempo de espera debe ser un número válido mayor a 0.' });
  }

  const client = await pool.connect();
  try {
    await withAuditContext(client, req);

    const check = await client.query('SELECT id FROM session_settings LIMIT 1');

    if (check.rows.length > 0) {
      let query = 'UPDATE session_settings SET updated_at = NOW()';
      const params = [];
      let paramIdx = 1;

      if (global_timeout !== undefined) {
        query += `, global_timeout = $${paramIdx++}`;
        params.push(global_timeout);
      }
      if (two_factor_enabled !== undefined) {
        query += `, two_factor_enabled = $${paramIdx++}`;
        params.push(two_factor_enabled);
      }

      query += ` WHERE id = $${paramIdx}`;
      params.push(check.rows[0].id);

      await client.query(query, params);
    } else {
      await client.query(
        'INSERT INTO session_settings (global_timeout, two_factor_enabled) VALUES ($1, $2)',
        [global_timeout || 60, two_factor_enabled !== undefined ? two_factor_enabled : true]
      );
    }

    res.json({ message: 'Configuración de sesión actualizada correctamente.' });
  } catch (err) {
    console.error('Error al actualizar configuración de sesión:', err);
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  } finally {
    client.release();
  }
};

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

// Cambiar estado de usuario (suspender/reactivar)
exports.toggleUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body; // 'active' o 'suspended'
  const client = await pool.connect();

  try {
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: "Estado inválido. Use 'active' o 'suspended'." });
    }

    const userResult = await client.query(
      'SELECT id, first_name, status FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Si se reactiva, resetear intentos de recuperación
    const extraFields = status === 'active' ? ', recovery_attempts = 0, failed_attempts = 0, lock_until = NULL' : '';

    await client.query(
      `UPDATE users SET status = $1${extraFields}, updated_at = NOW() WHERE id = $2`,
      [status, userId]
    );

    const action = status === 'active' ? 'reactivado' : 'suspendido';
    res.status(200).json({ message: `Usuario ${action} exitosamente.` });
  } catch (err) {
    console.error('Error al cambiar estado del usuario:', err);
    res.status(500).json({ error: 'Error al cambiar el estado del usuario.' });
  } finally {
    client.release();
  }
};

// Solicitar código de recuperación
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  const client = await pool.connect();

  try {
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    // Buscar usuario por email
    const userResult = await client.query(
      'SELECT id, email, status, recovery_attempts, first_name, last_recovery_attempt FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    if (!userResult.rows.length) {
      // No revelar si el email existe o no (seguridad)
      return res.status(200).json({ message: 'Si el correo existe, recibirá un código de recuperación.' });
    }

    const user = userResult.rows[0];
    const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'recam@gmail.com';

    // ============================================
    // Verificar cooldown entre intentos de recuperación
    // ============================================
    const cooldownMin = await getCooldownMinutes(user.id);
    if (cooldownMin > 0 && user.last_recovery_attempt) {
      const lastAttempt = moment.tz(user.last_recovery_attempt, "America/Caracas");
      const cooldownEnd = lastAttempt.clone().add(cooldownMin, 'minutes');
      const now = moment.tz("America/Caracas");
      if (now.isBefore(cooldownEnd)) {
        const remainingSec = cooldownEnd.diff(now, 'seconds');
        const remainingMin = Math.ceil(remainingSec / 60);
        return res.status(429).json({
          error: `Debe esperar ${remainingMin} minuto(s) antes de volver a intentar recuperar su contraseña.`,
          cooldown: true,
          remainingSeconds: remainingSec
        });
      }
    }

    // Verificar si la cuenta está suspendida
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: `Su cuenta ha sido suspendida. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Verificar intentos de recuperación (máximo 3)
    if (user.recovery_attempts >= 3) {
      // Suspender cuenta
      await client.query(
        "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1",
        [user.id]
      );
      return res.status(403).json({
        error: `Ha excedido el número máximo de intentos. Su cuenta ha sido suspendida. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Invalidar códigos anteriores
    await client.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [user.id]
    );

    // Generar código de 6 dígitos
    const code = generateResetCode();
    const hashedCode = await hashPassword(code);

    // Guardar código (expira en 10 minutos)
    await client.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'10 minutes\')',
      [user.id, hashedCode]
    );

    // Incrementar intentos de recuperación
    await client.query(
      'UPDATE users SET recovery_attempts = COALESCE(recovery_attempts, 0) + 1, last_recovery_attempt = NOW() WHERE id = $1',
      [user.id]
    );

    // Enviar código por email
    await sendResetCodeEmail(user.email, code);

    const attemptsLeft = 3 - (user.recovery_attempts + 1);
    res.status(200).json({
      message: 'Se ha enviado un código de verificación a su correo electrónico.',
      attemptsLeft
    });
  } catch (err) {
    console.error('Error en requestPasswordReset:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  } finally {
    client.release();
  }
};

// Verificar código de recuperación
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;
  const client = await pool.connect();

  try {
    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son requeridos.' });
    }

    // Buscar usuario
    const userResult = await client.query(
      'SELECT id, status FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: 'Código inválido o expirado.' });
    }

    const user = userResult.rows[0];

    if (user.status === 'suspended') {
      const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'recam@gmail.com';
      return res.status(403).json({
        error: `Su cuenta ha sido suspendida. Comuníquese con el administrador: ${adminContact}`,
        suspended: true,
        adminContact
      });
    }

    // Buscar código válido (no expirado)
    const resetResult = await client.query(
      'SELECT id, token, expires_at FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    if (!resetResult.rows.length) {
      return res.status(400).json({ error: 'Código inválido o expirado.' });
    }

    const resetRecord = resetResult.rows[0];

    // Verificar expiración
    if (new Date(resetRecord.expires_at) < new Date()) {
      await client.query('DELETE FROM password_resets WHERE id = $1', [resetRecord.id]);
      return res.status(400).json({ error: 'El código ha expirado. Solicite uno nuevo.' });
    }

    // Verificar código (comparando hash)
    const isValid = await comparePassword(code, resetRecord.token);
    if (!isValid) {
      return res.status(400).json({ error: 'Código inválido.' });
    }

    // Código válido: generar token temporal de reset (10 min)
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Limpiar el código usado
    await client.query('DELETE FROM password_resets WHERE id = $1', [resetRecord.id]);

    res.status(200).json({
      message: 'Código verificado correctamente.',
      resetToken
    });
  } catch (err) {
    console.error('Error en verifyResetCode:', err);
    res.status(500).json({ error: 'Error al verificar el código.' });
  } finally {
    client.release();
  }
};

// Restablecer contraseña
exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;
  const client = await pool.connect();

  try {
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Token y nueva contraseña son requeridos.' });
    }

    // Verificar token de reset
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ error: 'Token de recuperación inválido.' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Token de recuperación inválido o expirado.' });
    }

    const userId = decoded.userId;

    // Validar fortaleza de la contraseña
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: 'La contraseña no cumple los requisitos.',
        details: passwordErrors
      });
    }

    // Obtener usuario
    const userResult = await client.query(
      'SELECT id, password_hash, status FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: 'Usuario no encontrado.' });
    }

    const user = userResult.rows[0];

    // Verificar contra las últimas 5 contraseñas
    const historyResult = await client.query(
      'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    // También verificar contra la contraseña actual
    const isCurrentPassword = await comparePassword(newPassword, user.password_hash);
    if (isCurrentPassword) {
      return res.status(400).json({
        error: 'La nueva contraseña no puede ser igual a la contraseña actual.'
      });
    }

    // Verificar contra historial
    for (const record of historyResult.rows) {
      const isOldPassword = await comparePassword(newPassword, record.password_hash);
      if (isOldPassword) {
        return res.status(400).json({
          error: 'La nueva contraseña no puede ser igual a ninguna de las últimas 5 contraseñas utilizadas.'
        });
      }
    }

    // Todo válido: actualizar contraseña
    const newHash = await hashPassword(newPassword);

    await client.query('BEGIN');

    // Guardar contraseña actual en historial
    await client.query(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [userId, user.password_hash]
    );

    // Mantener solo las últimas 5 en historial
    await client.query(`
      DELETE FROM password_history
      WHERE user_id = $1 AND id NOT IN (
        SELECT id FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5
      )`,
      [userId]
    );

    // Actualizar contraseña del usuario y reiniciar contadores de intentos
    // Solo reactivar la cuenta si fue suspendida automáticamente por intentos fallidos (failed_login_attempts >= 3)
    // Si fue suspendida por un administrador, el status se mantiene como está
    await client.query(
      `UPDATE users SET password_hash = $1, recovery_attempts = 0,
        status = CASE WHEN failed_login_attempts >= 3 THEN 'active' ELSE status END,
        failed_login_attempts = 0, last_failed_login = NULL,
        is_temporary_password = false, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    // Limpiar cualquier código de reset pendiente
    await client.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    res.status(200).json({ message: 'Contraseña actualizada exitosamente. Ya puede iniciar sesión.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error en resetPassword:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  } finally {
    client.release();
  }
};

// ================================
// Configuración de enfriamiento (cooldown)
// ================================

exports.getCooldownSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT cooldown_minutes FROM session_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ cooldown_minutes: 10 });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener configuración de cooldown:', err);
    res.status(500).json({ error: 'Error al obtener configuración.' });
  } finally {
    client.release();
  }
};

exports.updateCooldownSettings = async (req, res) => {
  const { cooldown_minutes } = req.body;
  if (cooldown_minutes === undefined || cooldown_minutes === null || isNaN(cooldown_minutes) || cooldown_minutes < 0) {
    return res.status(400).json({ error: 'El tiempo de enfriamiento debe ser un número válido mayor o igual a 0 (0 = desactivado).' });
  }

  const client = await pool.connect();
  try {
    await withAuditContext(client, req);

    const check = await client.query('SELECT id FROM session_settings LIMIT 1');

    if (check.rows.length > 0) {
      await client.query(
        'UPDATE session_settings SET cooldown_minutes = $1, updated_at = NOW() WHERE id = $2',
        [cooldown_minutes, check.rows[0].id]
      );
    } else {
      await client.query(
        'INSERT INTO session_settings (cooldown_minutes) VALUES ($1)',
        [cooldown_minutes]
      );
    }

    res.json({ message: 'Configuración de enfriamiento actualizada correctamente.' });
  } catch (err) {
    console.error('Error al actualizar configuración de cooldown:', err);
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  } finally {
    client.release();
  }
};