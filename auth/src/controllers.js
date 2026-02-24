// Eliminar revista (borrado físico)
exports.deleteRevista = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM revistas WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revista no encontrada.' });
    }
    res.status(200).json({ message: 'Revista eliminada exitosamente.' });
  } catch (err) {
    console.error('Error al eliminar la revista:', err);
    res.status(500).json({ error: 'Error al eliminar la revista.' });
  } finally {
    client.release();
  }
};
// Obtener una revista por ID
exports.getRevista = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM revistas WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Revista no encontrada' });
    }
    const revista = result.rows[0];
    // Construir la URL pública de la portada si existe
    let portadaUrl = null;
    if (revista.portada) {
      // Usar la variable VITE_IMAGE_BASE_URL para la URL pública
      portadaUrl = `${process.env.VITE_IMAGE_BASE_URL}${revista.portada}`;
    } else {
      revista.portadaUrl = null;
    }
    res.json({ ...revista, portadaUrl });
  } catch (err) {
    console.error('Error al obtener la revista por ID:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};
const jwt = require("jsonwebtoken");
const pool = require("./db");
const {
  hashPassword,
  comparePassword,
  generateToken, // may be used elsewhere
  generateSecureToken,
  sendEmail,
  validatePassword,
  getSessionTimeout,
} = require("./utils");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const moment = require("moment-timezone");

// Ensure destination directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Multer configuration (10 MB max)
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Usar variable de entorno PORTADAS_PATH si está definida (producción)
    // Si no, usar la ruta relativa (desarrollo local)
    const dir = process.env.PORTADAS_PATH || path.join(__dirname, "../../backend/public/portadas");
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Generar UUID lowercase para evitar problemas de case-sensitivity en Linux
    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    const newFilename = `${uuid}${ext}`;
    cb(null, newFilename);
  },
});
const uploadAny = multer({
  storage: uploadStorage,
  limits: { fileSize: 1024 * 1024 * 2 }, // Límite de 2MB
}).any();

const REVISTA_ALLOWED_COLUMNS = [
  "area_conocimiento_id",
  "indice_id",
  "idioma_id",
  "revista",
  "correo_revista",
  "editorial_id",
  "periodicidad_id",
  "formato_id",
  "estado_id",
  "nombres_editor",
  "apellidos_editor",
  "correo_editor",
  "deposito_legal_impreso",
  "deposito_legal_digital",
  "issn_impreso",
  "issn_digital",
  "url",
  "anio_inicial",
  "direccion",
  "telefono",
  "resumen",
  "portada",
];

// Simple health/prueba endpoint
exports.prueba = async (req, res) => {
  res.status(200).json({ message: "Prueba exitosa." });
};

// Endpoint de prueba para upload de archivos (sin DB)
exports.testUpload = [
  uploadAny,
  async (req, res) => {
    try {
      const file = req.file || (Array.isArray(req.files) && req.files[0]);
      if (!file) {
        return res.status(400).json({ error: "No se proporcionó archivo" });
      }
      res.status(200).json({ filename: file.originalname });
    } catch (err) {
      console.error("[testUpload] Error:", err);
      res.status(500).json({ error: "Error al subir el archivo" });
    }
  },
];

// Upload de portada y actualización en DB (revistas.portada)
exports.uploadPortada = [
  uploadAny,
  async (req, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "ID de revista es requerido" });
    }

    const file = req.file || (Array.isArray(req.files) && req.files[0]);
    if (!file) {
      return res.status(400).json({ error: "No se proporcionó archivo" });
    }

    // Usar file.filename (el nombre UUID generado por multer) en lugar de originalname
    const savedFilename = file.filename;
    const client = await pool.connect();

    try {
      // Obtener la portada anterior
      const oldRevista = await client.query("SELECT portada FROM revistas WHERE id = $1", [id]);
      const oldFilename = oldRevista.rows[0]?.portada;

      const result = await client.query(
        "UPDATE revistas SET portada = $1 WHERE id = $2 RETURNING *",
        [savedFilename, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Revista no encontrada" });
      }

      // Eliminar archivo anterior si existe y es diferente
      if (oldFilename && oldFilename !== savedFilename) {
        const dir = process.env.PORTADAS_PATH || path.join(__dirname, "../../backend/public/portadas");
        const oldFilePath = path.join(dir, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (unlinkErr) {
            console.error("[uploadPortada] Error al eliminar portada anterior:", unlinkErr);
          }
        }
      }

      res.status(200).json({
        message: "Portada subida y actualizada exitosamente",
        filename: savedFilename,
        revista: result.rows[0],
      });
    } catch (err) {
      // Eliminar archivo subido si la DB falla
      try {
        const f = req.file || (Array.isArray(req.files) && req.files[0]);
        if (f?.path && fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
        }
      } catch (unlinkErr) {
        console.error("[uploadPortada] Error al eliminar archivo temporal:", unlinkErr);
      }
      console.error("[uploadPortada] Error:", err);
      res.status(500).json({ error: "Error al subir la portada" });
    } finally {
      client.release();
    }
  },
];

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
      "SELECT id, first_name,last_name,cedula,email, is_email_verified, status, session_timeout_min FROM users WHERE deleted_at IS NULL"
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
  const { first_name, last_name, cedula, email, password, session_timeout_min } = req.body;

  const client = await pool.connect();
  try {
    // Convertir session_timeout_min a número o null
    const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;

    if (password) {
      // Validar fortaleza de la contraseña si se proporciona
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ error: passwordErrors.join(" ") });
      }
      const hashedPassword = await hashPassword(password);

      await client.query(
        "UPDATE users SET first_name = $1, last_name = $2, cedula = $3, email = $4, password_hash = $5, session_timeout_min = $6, updated_at = NOW() WHERE id = $7",
        [first_name, last_name, cedula, email, hashedPassword, timeout, userId]
      );
    } else {
      await client.query(
        "UPDATE users SET first_name = $1, last_name = $2, cedula = $3, email = $4, session_timeout_min = $5, updated_at = NOW() WHERE id = $6",
        [first_name, last_name, cedula, email, timeout, userId]
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

// Login
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
      "SELECT id, password_hash, status, failed_login_attempts, last_failed_login FROM users WHERE email = $1",
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
      return res.status(403).json({ error: "El usuario está suspendido." });
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
        error:
          "El usuario ha sido bloqueado debido a múltiples intentos fallidos.",
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

    // Reiniciar contador de intentos fallidos
    await client.query(
      "UPDATE users SET failed_login_attempts = 0, last_failed_login = NULL WHERE id = $1",
      [user.id]
    );

    // Duración de sesión
    const timeoutMin = await getSessionTimeout(user.id);
    const expiresInSeconds = Math.max(parseInt(timeoutMin, 10) || 20, 1) * 60; // fallback seguro
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });

    // Registrar sesión
    await client.query(
      "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + $3 * INTERVAL '1 minute')",
      [user.id, token, parseInt(timeoutMin, 10) || 20]
    );

    // Permisos del usuario (combinando permisos directos y permisos del rol)
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

    // Log de permisos del usuario
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Usuario logueado: ${username} (ID: ${user.id})`);
    console.log(`📋 Permisos del usuario (${permissions.length} permisos):`);
    if (permissions.length > 0) {
      permissions.forEach((perm, index) => {
        console.log(`   ${index + 1}. ${perm.name} - ${perm.description || 'Sin descripción'} (Acción: ${perm.action})`);
      });
    } else {
      console.log('   ⚠️  El usuario no tiene permisos asignados');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Rol del usuario
    const roleQuery = `
      SELECT r.name
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1
      LIMIT 1
    `;
    const roleResult = await client.query(roleQuery, [user.id]);
    const role = roleResult.rows[0]?.name || null;

    // Auditoría
    await client.query(
      "INSERT INTO login_logs (user_id, username, ip_address, login_status, session_token) VALUES ($1, $2, $3, $4, $5)",
      [user.id, username, ip, "success", token]
    );

    res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      sessionDuration: expiresInSeconds / 60,
      role,
      permissions,
    });
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    res.status(500).json({ error: "Error en el inicio de sesión." });
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

// Insertar revista (con upload de portada opcional)
// exports.insertRevista = [
//   uploadAny,
//   async (req, res) => {
//     const insertFields = req.body || {};

//     // Si viene archivo, usar su nombre como portada (el archivo ya fue guardado por multer)
//     const file = req.file || (Array.isArray(req.files) && req.files[0]);
//     if (file) {
//       insertFields.portada = file.originalname;
//     } else if (!("portada" in insertFields)) {
//       insertFields.portada = null;
//     }

//     // Campos a forzar en minúsculas
//     const columnasMinusculas = ["correo_revista", "correo_editor", "url"];

//     for (const key in insertFields) {
//       if (typeof insertFields[key] === "string") {
//         if (columnasMinusculas.includes(key)) {
//           insertFields[key] = insertFields[key].toLowerCase();
//         } else {
//           insertFields[key] = insertFields[key].toUpperCase();
//         }
//       }
//     }

//     const client = await pool.connect();
//     try {
//       const keys = Object.keys(insertFields);
//       if (keys.length === 0) {
//         return res
//           .status(400)
//           .json({ error: "No se proporcionaron campos para insertar." });
//       }

//       const columns = keys.join(", ");
//       const placeholders = keys.map((_, index) => `${index + 1}`).join(", ");
//       const values = keys.map((key) => insertFields[key]);

//       const query = `
//         INSERT INTO revistas (${columns})
//         VALUES (${placeholders})
//         RETURNING *;
//       `;

//       const result = await client.query(query, values);

//       if (result.rows.length === 0) {
//         return res.status(500).json({ error: "Error al insertar la revista." });
//       }

//       res.status(201).json({
//         message: "Revista insertada exitosamente.",
//         revista: result.rows[0],
//         filename: file ? file.originalname : null,
//       });
//     } catch (err) {
//       console.error("Error al insertar la revista:", err);
//       // Si ocurrió un error y se subió archivo, eliminarlo
//       try {
//         if (file?.path && fs.existsSync(file.path)) {
//           fs.unlinkSync(file.path);
//         }
//       } catch (unlinkErr) {
//         console.error("[insertRevista] Error al eliminar archivo temporal:", unlinkErr);
//       }
//       res.status(500).json({ error: "Error al insertar la revista." });
//     } finally {
//       client.release();
//     }
//   },
// ];
exports.insertRevista = async (req, res) => {
  const insertFields = req.body; // Campos a insertar

  // Lista de columnas que deben estar en minúsculas
  const columnasMinusculas = ["correo_revista", "correo_editor", "url", "portada"];

  // Convertir cadenas a mayúsculas o minúsculas según corresponda
  for (const key in insertFields) {
    if (typeof insertFields[key] === "string") {
      if (columnasMinusculas.includes(key)) {
        // Forzar a minúsculas para columnas específicas
        insertFields[key] = insertFields[key].toLowerCase();
      } else {
        // Convertir a mayúsculas para el resto de las columnas
        insertFields[key] = insertFields[key].toUpperCase();
      }
    }
  }

  const client = await pool.connect();
  try {
    // Construir la consulta dinámicamente
    // Filtrar claves permitidas para evitar SQL Injection
    const keys = Object.keys(insertFields).filter(key => REVISTA_ALLOWED_COLUMNS.includes(key));

    if (keys.length === 0) {
      return res
        .status(400)
        .json({ error: "No se proporcionaron campos válidos para insertar." });
    }

    const columns = keys.join(", ");
    // Corregir los placeholders para usar $1, $2, etc.
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
    const values = keys.map((key) => insertFields[key]);

    const query = `
            INSERT INTO revistas (${columns})
            VALUES (${placeholders})
            RETURNING *;
        `;

    // console.log('Consulta SQL:', query); // Para depuración
    // console.log('Valores:', values); // Para depuración

    // Ejecutar la consulta
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      console.log("No se pudo insertar la revista.");
      return res.status(500).json({ error: "Error al insertar la revista." });
    }

    res.status(201).json({
      message: "Revista insertada exitosamente.",
      revista: result.rows[0],
    });
  } catch (err) {
    console.error("Error al insertar la revista:", err);
    res.status(500).json({ error: "Error al insertar la revista." });
  } finally {
    client.release();
  }
};
// Actualizar revista (PATCH)
exports.updateRevista = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  console.log('🔍 [updateRevista] Datos recibidos ANTES de sanitizar:', JSON.stringify(updateFields, null, 2));

  // Sanitizar campos que vienen de q-select (pueden venir como objetos {label, value})
  const selectFields = [
    'area_conocimiento_id',
    'idioma_id',
    'indice_id',
    'editorial_id',
    'periodicidad_id',
    'formato_id',
    'estado_id'
  ];

  selectFields.forEach(field => {
    if (updateFields[field]) {
      console.log(`🔍 Campo ${field}:`, typeof updateFields[field], updateFields[field]);
      if (typeof updateFields[field] === 'object' && updateFields[field].value !== undefined) {
        console.log(`✅ Extrayendo value de ${field}:`, updateFields[field].value);
        updateFields[field] = updateFields[field].value;
      }
    }
  });

  console.log('🔍 [updateRevista] Datos DESPUÉS de sanitizar:', JSON.stringify(updateFields, null, 2));

  if (updateFields.portada) {
    const match = updateFields.portada.match(/\/([^\/?]+)\?/);
    if (match && match[1]) {
      updateFields.portada = match[1].toLowerCase();
    }
  }

  const columnasMinusculas = [
    "correo_revista",
    "correo_editor",
    "url",
    "portada",
  ];

  for (const key in updateFields) {
    if (typeof updateFields[key] === "string") {
      if (columnasMinusculas.includes(key)) {
        updateFields[key] = updateFields[key].toLowerCase();
      } else {
        updateFields[key] = updateFields[key].toUpperCase();
      }
    }
  }

  const client = await pool.connect();
  try {
    // Filtrar claves permitidas para evitar SQL Injection
    const keys = Object.keys(updateFields).filter(key => REVISTA_ALLOWED_COLUMNS.includes(key));

    if (keys.length === 0) {
      return res
        .status(400)
        .json({ error: "No se proporcionaron campos válidos para actualizar." });
    }

    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
    const values = keys.map((key) => updateFields[key]);
    values.push(id);

    const query = `
      UPDATE revistas
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Revista no encontrada." });
    }

    res.status(200).json({
      message: "Revista actualizada exitosamente.",
      revista: result.rows[0],
    });
  } catch (err) {
    console.error("Error al actualizar la revista:", err);
    res.status(500).json({ error: "Error al actualizar la revista." });
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

// ================================
// Placeholders para endpoints no implementados en este refactor
// ================================

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
    // Verificar si el usuario ya existe
    const userExist = await client.query(
      "SELECT id FROM users WHERE email = $1 OR cedula = $2",
      [email, cedula]
    );
    if (userExist.rows.length > 0) {
      return res.status(409).json({ error: "El usuario ya existe (email o cédula)." });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Convertir session_timeout_min a número o null
    const timeout = session_timeout_min ? parseInt(session_timeout_min, 10) : null;

    // Insertar usuario
    const newUser = await client.query(
      "INSERT INTO users (first_name, last_name, cedula, email, password_hash, session_timeout_min, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id, first_name, last_name, email",
      [first_name, last_name, cedula, email, hashedPassword, timeout]
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

// Eliminar Rol (Borrado Lógico) - No hay columna deleted_at en roles según dump, pero sí en users.
// Revisando dump: roles tiene created_at, updated_at, session_timeout_min. NO tiene deleted_at.
// Se hará borrado físico si no hay dependencias, o se agregará columna deleted_at si se requiere.
// Por ahora, asumiremos borrado físico con validación de dependencias o borrado en cascada (user_roles tiene ON DELETE CASCADE).
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
  console.log("Assigning role:", { userId, roleId }); // Debug log

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
  console.log("Assigning permission to role:", { roleId, permissionId });

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
  console.log("Removing permission from role:", { roleId, permissionId });

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
      console.warn("No se encontró la asignación para eliminar:", { roleId, permissionId });
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

// Inserta una revista con su portada en una sola operación
exports.insertRevistaWithUpload = [
  uploadAny, // Middleware de Multer para procesar el archivo
  async (req, res) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Datos recibidos en req.body:', Object.keys(req.body));
    console.log('📄 Valores completos de req.body:', req.body);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const insertFields = req.body; // Datos de la revista
    const file = req.file || (Array.isArray(req.files) && req.files[0]);

    // VALIDAR CAMPOS OBLIGATORIOS ANTES DE PROCESAR
    if (!insertFields.area_conocimiento_id || insertFields.area_conocimiento_id === '') {
      return res.status(400).json({
        error: 'El campo "Área de Conocimiento" es obligatorio. Por favor selecciona un área de conocimiento.'
      });
    }

    if (!insertFields.idioma_id || insertFields.idioma_id === '') {
      return res.status(400).json({
        error: 'El campo "Idioma" es obligatorio. Por favor selecciona un idioma.'
      });
    }

    // Si se subió un archivo, usar el nombre UUID generado por multer (file.filename)
    if (file) {
      console.log('📁 Archivo recibido:');
      console.log('   - originalname:', file.originalname);
      console.log('   - filename (UUID):', file.filename);
      console.log('   - path:', file.path);
      insertFields.portada = file.filename;
      console.log('   - portada asignada:', insertFields.portada);
    }

    // Limpiar y validar datos antes de insertar
    const columnasMinusculas = ["correo_revista", "correo_editor", "url", "portada"];

    // Límites de longitud para campos varchar
    const fieldLimits = {
      'deposito_legal_impreso': 25,
      'deposito_legal_digital': 25,
      'issn_impreso': 25,
      'issn_digital': 25,
      'portada': 255
    };

    for (const key in insertFields) {
      // Convertir cadenas vacías a null para campos numéricos
      if (insertFields[key] === '' || insertFields[key] === undefined) {
        insertFields[key] = null;
        continue;
      }

      if (typeof insertFields[key] === "string") {
        // Trim para eliminar espacios
        insertFields[key] = insertFields[key].trim();

        // Si después del trim queda vacío, convertir a null
        if (insertFields[key] === '') {
          insertFields[key] = null;
          continue;
        }

        // Aplicar límites de longitud si existen
        if (fieldLimits[key] && insertFields[key].length > fieldLimits[key]) {
          console.warn(`Campo ${key} truncado de ${insertFields[key].length} a ${fieldLimits[key]} caracteres`);
          insertFields[key] = insertFields[key].substring(0, fieldLimits[key]);
        }

        if (columnasMinusculas.includes(key)) {
          insertFields[key] = insertFields[key].toLowerCase();
        } else {
          insertFields[key] = insertFields[key].toUpperCase();
        }
      }
    }

    const client = await pool.connect();
    try {
      // Filtrar campos null y validar columnas permitidas antes de construir la query
      const validFields = {};
      for (const key in insertFields) {
        if (insertFields[key] !== null && REVISTA_ALLOWED_COLUMNS.includes(key)) {
          validFields[key] = insertFields[key];
        }
      }

      const keys = Object.keys(validFields);
      if (keys.length === 0) {
        return res.status(400).json({ error: "No se proporcionaron campos válidos para insertar." });
      }

      const columns = keys.join(", ");
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
      const values = keys.map((key) => validFields[key]);

      const query = `INSERT INTO revistas (${columns}) VALUES (${placeholders}) RETURNING *;`;

      console.log('Insertando revista con campos:', keys);
      console.log('Valores:', values);

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return res.status(500).json({ error: "Error al insertar la revista." });
      }

      res.status(201).json({
        message: "Revista y portada insertadas exitosamente.",
        revista: result.rows[0],
      });
    } catch (err) {
      console.error("Error en insertRevistaWithUpload:", err);
      // Si algo falla, eliminar el archivo que se subió
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({
        error: "Error al insertar la revista.",
        details: err.message
      });
    } finally {
      client.release();
    }
  },
];
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
    const result = await client.query('SELECT global_timeout FROM session_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      // Si por alguna razón no hay registro, devolver default
      return res.json({ global_timeout: 60 });
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
  const { global_timeout } = req.body;
  if (!global_timeout || isNaN(global_timeout) || global_timeout < 1) {
    return res.status(400).json({ error: 'El tiempo de espera debe ser un número válido mayor a 0.' });
  }

  const client = await pool.connect();
  try {
    await withAuditContext(client, req);

    // Asumimos que siempre editamos el primer registro o insertamos si no existe (upsert check simple)
    const check = await client.query('SELECT id FROM session_settings LIMIT 1');

    if (check.rows.length > 0) {
      await client.query(
        'UPDATE session_settings SET global_timeout = $1, updated_at = NOW() WHERE id = $2',
        [global_timeout, check.rows[0].id]
      );
    } else {
      await client.query(
        'INSERT INTO session_settings (global_timeout) VALUES ($1)',
        [global_timeout]
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