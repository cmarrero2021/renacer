// src/utils.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const pool = require('./db'); // Importar pool al inicio

// Generar hash de contraseña
exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Validar contraseña
exports.comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Validar formato del password
exports.validatePassword = (password) => {
  const errors = [];

  // Longitud mínima de 8 caracteres
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres.');
  }

  // Al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula.');
  }

  // Al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula.');
  }

  // Al menos un número
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número.');
  }

  // Al menos un carácter especial
  if (!/[!"#$%&/=.\-*;]/.test(password)) {
    errors.push('La contraseña debe contener al menos uno de los siguientes caracteres especiales: !"#$%&/=.-*;');
  }

  return errors;
};

// Generar token seguro
exports.generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Crear transporter SMTP reutilizable
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Enviar correo electrónico
exports.sendEmail = async (to, subject, text, html = null) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Sistema'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  };
  if (html) mailOptions.html = html;

  // Adjuntar logo como CID si existe la ruta configurada
  if (process.env.EMAIL_LOGO_PATH) {
    const logoPath = path.resolve(process.cwd(), process.env.EMAIL_LOGO_PATH);
    if (fs.existsSync(logoPath)) {
      mailOptions.attachments = [{
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo@app'
      }];
    }
  }

  await transporter.sendMail(mailOptions);
};

// Generar código numérico de 6 dígitos
exports.generateResetCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Enviar email con código de recuperación
exports.sendResetCodeEmail = async (to, code) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 16px;">
        <img src="cid:logo@app" alt="${process.env.APP_NAME || 'Logo'}" style="max-width: 300px; height: auto;" />
      </div>
      <h2 style="color: #273984; text-align: center;">Recuperación de Contraseña</h2>
      <p>Ha solicitado recuperar su contraseña. Use el siguiente código de verificación:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #273984; background: #f5f5f5; padding: 12px 24px; border-radius: 8px;">${code}</span>
      </div>
      <p style="color: #666; font-size: 14px;">Este código es válido por <strong>10 minutos</strong>.</p>
      <p style="color: #666; font-size: 14px;">Si no solicitó este cambio, ignore este correo.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">${process.env.APP_NAME || 'Sistema'}</p>
    </div>
  `;
  await exports.sendEmail(
    to,
    'Código de Recuperación de Contraseña',
    `Su código de recuperación es: ${code}. Válido por 10 minutos.`,
    html
  );
};

// Obtener duración de sesión (en minutos)
// Prioridad: users.session_timeout_min > roles.session_timeout_min > session_settings.global_timeout
exports.getSessionTimeout = async (userId) => {
  const client = await pool.connect();
  try {
    // 1. Verificar si el usuario tiene configuración específica (no null y mayor a 0)
    const userRes = await client.query(
      'SELECT session_timeout_min FROM users WHERE id = $1',
      [userId]
    );
    const userTimeout = userRes.rows[0]?.session_timeout_min;
    if (userTimeout !== null && userTimeout !== undefined && userTimeout > 0) {
      return userTimeout;
    }

    // 2. Verificar si el rol del usuario tiene configuración específica (no null y mayor a 0)
    const roleRes = await client.query(`
      SELECT r.session_timeout_min 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
      ORDER BY r.session_timeout_min DESC
      LIMIT 1
    `, [userId]);
    const roleTimeout = roleRes.rows[0]?.session_timeout_min;
    if (roleTimeout !== null && roleTimeout !== undefined && roleTimeout > 0) {
      return roleTimeout;
    }

    // 3. Usar configuración global
    const globalRes = await client.query(
      'SELECT global_timeout FROM session_settings WHERE id = 1'
    );
    return globalRes.rows[0]?.global_timeout || 120; // Fallback de 120 minutos si no hay configuración
  } finally {
    client.release();
  }
};

// Obtener tiempo de enfriamiento (cooldown) en minutos
// Prioridad: users.cooldown_minutes > roles.cooldown_minutes > session_settings.cooldown_minutes
// Valor 0 = cooldown desactivado, NULL = hereda del nivel superior
exports.getCooldownMinutes = async (userId) => {
  const client = await pool.connect();
  try {
    // 1. Verificar si el usuario tiene configuración específica (no null)
    const userRes = await client.query(
      'SELECT cooldown_minutes FROM users WHERE id = $1',
      [userId]
    );
    const userCooldown = userRes.rows[0]?.cooldown_minutes;
    if (userCooldown !== null && userCooldown !== undefined) {
      return userCooldown; // 0 = desactivado, >0 = tiempo en minutos
    }

    // 2. Verificar si el rol del usuario tiene configuración específica (no null)
    const roleRes = await client.query(`
      SELECT r.cooldown_minutes 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND r.cooldown_minutes IS NOT NULL
      ORDER BY r.cooldown_minutes DESC
      LIMIT 1
    `, [userId]);
    const roleCooldown = roleRes.rows[0]?.cooldown_minutes;
    if (roleCooldown !== null && roleCooldown !== undefined) {
      return roleCooldown; // 0 = desactivado, >0 = tiempo en minutos
    }

    // 3. Usar configuración global
    const globalRes = await client.query(
      'SELECT cooldown_minutes FROM session_settings WHERE id = 1'
    );
    return globalRes.rows[0]?.cooldown_minutes ?? 10; // Fallback de 10 minutos
  } finally {
    client.release();
  }
};

// Generar token JWT con duración dinámica
exports.generateToken = async (userId) => {
  const timeoutMin = await exports.getSessionTimeout(userId);
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: `${timeoutMin}m`
  });
};

/**
 * Verifica si el 2FA está habilitado para un usuario específico.
 */
exports.isTwoFactorEnabled = async (userId) => {
  const client = await pool.connect();
  try {
    // 1. Verificar configuración global (primer registro)
    const globalRes = await client.query(
      'SELECT two_factor_enabled FROM session_settings ORDER BY id ASC LIMIT 1'
    );
    if (globalRes.rows.length > 0 && globalRes.rows[0].two_factor_enabled === false) {
      console.log(`[DEBUG] 2FA deshabilitado GLOBALMENTE`);
      return false;
    }

    // 2. Verificar configuración del usuario
    const userRes = await client.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length > 0) {
      console.log(`[DEBUG] 2FA para usuario ${userId}: ${userRes.rows[0].two_factor_enabled}`);
      if (userRes.rows[0].two_factor_enabled === false) {
        return false;
      }
    }

    return true; // Por defecto habilitado
  } catch (err) {
    console.error("Error al verificar si 2FA está habilitado:", err);
    return true; // En caso de error, preferir seguridad
  } finally {
    client.release();
  }
};
