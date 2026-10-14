// src/controllers_registro.js
// Controladores para el sistema de autorregistro de usuarios
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('./db');
const {
  hashPassword,
  comparePassword,
  generateResetCode,
  sendEmail,
} = require('./utils');
const moment = require('moment-timezone');
const { guardarArchivoRif } = require('./controllers_rif');

// ============================================================
// Constantes
// ============================================================

// Validez del token JWT que permite completar el formulario (4 horas)
const REGISTRO_TOKEN_HORAS = 4;
// Máximo de solicitudes de código por ventana de validez
const MAX_SOLICITUDES = 3;
// Máximo de intentos de verificación del código
const MAX_INTENTOS_CODIGO = 5;
// API de identificación
const IDENTIFICACION_API_URL =
  process.env.IDENTIFICACION_API_URL || 'https://166-0-112-41.sslip.io/api/identificacion/identificacion';
const IDENTIFICACION_API_TOKEN = process.env.IDENTIFICACION_API_TOKEN || '';
const IDENTIFICACION_API_TIMEOUT = parseInt(process.env.IDENTIFICACION_API_TIMEOUT, 10) || 15000;

// ============================================================
// Helper: Validación de contraseña del autorregistro
// - Al menos 8 caracteres
// - Al menos una minúscula y una mayúscula
// - Al menos un número
// - No más de dos caracteres iguales consecutivos
// - Al menos un carácter especial de: #$%&/@.-
// ============================================================
const validateRegistroPassword = (password) => {
  const errors = [];
  const pwd = password || '';
  if (pwd.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres.');
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula.');
  }
  if (!/[a-z]/.test(pwd)) {
    errors.push('La contraseña debe contener al menos una letra minúscula.');
  }
  if (!/[0-9]/.test(pwd)) {
    errors.push('La contraseña debe contener al menos un número.');
  }
  if (/(.)\1{2,}/.test(pwd)) {
    errors.push('La contraseña no debe contener más de dos caracteres iguales consecutivos.');
  }
  if (!/[$#%&/@.-]/.test(pwd)) {
    errors.push('La contraseña debe contener al menos uno de los siguientes caracteres especiales: #$%&/@.-');
  }
  return errors;
};

// ============================================================
// Helper: Genera el JWT de registro (tras verificar el código)
// ============================================================
function generarRegistroToken(email, verificacionId) {
  return jwt.sign(
    { email, verificacionId, purpose: 'self-register' },
    process.env.JWT_SECRET,
    { expiresIn: `${REGISTRO_TOKEN_HORAS}h` }
  );
}

// Verifica el token temporal de autorregistro
function verificarRegistroToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'self-register') return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

// ============================================================
// PASO 1: Solicitar código de confirmación
// POST /auth/registro/request-code  { email }
// ============================================================
exports.requestRegistroCode = async (req, res) => {
  const { email } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const client = await pool.connect();

  try {
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
    }

    // No permitir autorregistro con un correo ya registrado
    const existente = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [emailNorm]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe una cuenta registrada con este correo electrónico. Utilice la opción "¿Olvidaste tu contraseña?" para recuperar el acceso.',
        emailExists: true,
      });
    }

    // Buscar verificación activa (código vigente, no usado)
    const activa = await client.query(
      `SELECT id, expires_at, verified, created_at
       FROM registro_verificaciones
       WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [emailNorm]
    );

    if (activa.rows.length > 0) {
      const activaRow = activa.rows[0];
      // Código ya verificado: permitir continuar sin reenviar
      if (activaRow.verified) {
        const registroToken = generarRegistroToken(emailNorm, activaRow.id);
        return res.status(200).json({
          alreadyVerified: true,
          message: 'Este correo ya fue verificado previamente. Puede continuar con el registro.',
          registroToken,
        });
      }
      // Código vigente NO verificado: informar sin reenviar
      const expira = moment.tz(activaRow.expires_at, 'America/Caracas').format('DD/MM/YYYY HH:mm');
      return res.status(200).json({
        alreadyRequested: true,
        message: `Ya ha solicitado un código de confirmación. El mismo fue enviado a ${emailNorm} y es válido hasta las ${expira}. Revise su correo electrónico.`,
      });
    }

    // Verificar límite de solicitudes de código en las últimas 24 h
    const recientes = await client.query(
      `SELECT COALESCE(MAX(request_count), 0) AS max_requests
       FROM registro_verificaciones
       WHERE email = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [emailNorm]
    );
    const solicitudesPrevias = recientes.rows[0]?.max_requests || 0;
    if (solicitudesPrevias >= MAX_SOLICITUDES) {
      return res.status(429).json({
        error: `Ha excedido el número máximo de solicitudes de código (${MAX_SOLICITUDES}) en 24 horas. Intente nuevamente más tarde.`,
      });
    }

    // Generar código de 6 dígitos (se almacena hasheado)
    const code = generateResetCode();
    const hashedCode = await hashPassword(code);

    // Marcar verificaciones anteriores no usadas (expiradas) para que no interfieran
    await client.query(
      `UPDATE registro_verificaciones SET used_at = NOW(), updated_at = NOW()
       WHERE email = $1 AND used_at IS NULL`,
      [emailNorm]
    );

    await client.query(
      `INSERT INTO registro_verificaciones (email, code_hash, expires_at, request_count, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, $4::inet)`,
      [emailNorm, hashedCode, solicitudesPrevias + 1, ip]
    );

    // Enviar código por correo (validez 24 horas)
    const expiracion = moment.tz('America/Caracas').add(24, 'hours');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="cid:logo@app" alt="${process.env.APP_NAME || 'Logo'}" style="max-width: 300px; height: auto;" />
        </div>
        <h2 style="color: #273984; text-align: center;">Confirmación de Correo Electrónico</h2>
        <p>Gracias por registrarse en ${process.env.APP_NAME || 'nuestro sistema'}. Use el siguiente código para confirmar su correo electrónico:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #273984; background: #f5f5f5; padding: 12px 24px; border-radius: 8px;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">Este código es válido por <strong>24 horas</strong> (hasta las ${expiracion.format('DD/MM/YYYY HH:mm')}).</p>
        <p style="color: #666; font-size: 14px;">Si no solicitó este registro, ignore este mensaje.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">${process.env.APP_NAME || 'Sistema'}</p>
      </div>
    `;
    await sendEmail(
      emailNorm,
      'Código de Confirmación - Registro de Usuario',
      `Su código de confirmación es: ${code}. Válido por 24 horas.`,
      html
    );

    console.log(`\n==========================================`);
    console.log(`📧 CÓDIGO AUTORREGISTRO (DEBUG): ${code}`);
    console.log(`📧 DESTINATARIO: ${emailNorm}`);
    console.log(`⏳ EXPIRA: ${expiracion.format('DD/MM/YYYY HH:mm')}`);
    console.log(`==========================================\n`);

    res.status(200).json({
      message: 'Se ha enviado un código de confirmación a su correo electrónico. El código es válido por 24 horas.',
    });
  } catch (err) {
    console.error('Error en requestRegistroCode:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud de registro.' });
  } finally {
    client.release();
  }
};

// ============================================================
// PASO 2: Verificar código de confirmación
// POST /auth/registro/verify-code  { email, code }
// ============================================================
exports.verifyRegistroCode = async (req, res) => {
  const { email, code } = req.body;
  const client = await pool.connect();

  try {
    if (!email || !code) {
      return res.status(400).json({ error: 'El correo y el código son requeridos.' });
    }
    const emailNorm = String(email).toLowerCase().trim();

    const verifResult = await client.query(
      `SELECT id, code_hash, expires_at, verified, attempts
       FROM registro_verificaciones
       WHERE email = $1 AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [emailNorm]
    );

    if (!verifResult.rows.length) {
      return res.status(400).json({
        error: 'No hay un código pendiente para este correo. Solicite uno nuevo.',
        expired: true,
      });
    }

    const verif = verifResult.rows[0];

    // Código expirado (24 h): el usuario podrá generar uno distinto
    if (new Date(verif.expires_at) < new Date()) {
      await client.query(
        'UPDATE registro_verificaciones SET used_at = NOW(), updated_at = NOW() WHERE id = $1',
        [verif.id]
      );
      return res.status(400).json({
        error: 'El código ha expirado. Solicite uno nuevo para continuar.',
        expired: true,
      });
    }

    // Límite de intentos de verificación
    if (verif.attempts >= MAX_INTENTOS_CODIGO) {
      await client.query(
        'UPDATE registro_verificaciones SET used_at = NOW(), updated_at = NOW() WHERE id = $1',
        [verif.id]
      );
      return res.status(400).json({
        error: 'Ha excedido el número máximo de intentos. Solicite un nuevo código.',
        codeInvalidated: true,
      });
    }

    const isValid = await comparePassword(String(code), verif.code_hash);
    if (!isValid) {
      const newAttempts = verif.attempts + 1;
      await client.query(
        'UPDATE registro_verificaciones SET attempts = $1, updated_at = NOW() WHERE id = $2',
        [newAttempts, verif.id]
      );
      const remaining = MAX_INTENTOS_CODIGO - newAttempts;
      if (remaining <= 0) {
        await client.query(
          'UPDATE registro_verificaciones SET used_at = NOW() WHERE id = $1',
          [verif.id]
        );
        return res.status(400).json({
          error: 'Código incorrecto. Ha excedido el número máximo de intentos. Solicite un nuevo código.',
          codeInvalidated: true,
        });
      }
      return res.status(400).json({
        error: `Código incorrecto. Le quedan ${remaining} intento(s).`,
        attemptsLeft: remaining,
      });
    }

    // Código correcto: marcar verificación y emitir token de registro
    await client.query(
      `UPDATE registro_verificaciones
       SET verified = TRUE, verified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [verif.id]
    );

    const registroToken = generarRegistroToken(emailNorm, verif.id);

    res.status(200).json({
      message: 'Correo electrónico verificado correctamente.',
      registroToken,
      email: emailNorm,
    });
  } catch (err) {
    console.error('Error en verifyRegistroCode:', err);
    res.status(500).json({ error: 'Error al verificar el código.' });
  } finally {
    client.release();
  }
};

// ============================================================
// PASO 3: Consultar identidad (API externa)
// POST /auth/registro/consultar-identidad
// Headers: Authorization: Bearer <registroToken>
// Body: { nacionalidad: 'V'|'E', cedula: 12345678 }
// ============================================================
exports.consultarIdentidad = async (req, res) => {
  // El token de registro viene en el header Authorization (middleware authenticateRegistro)
  const registroToken = req.headers['authorization']?.split(' ')[1];
  if (!registroToken || !verificarRegistroToken(registroToken)) {
    return res.status(401).json({ error: 'Sesión de registro inválida o expirada. Inicie nuevamente el proceso de registro.' });
  }

  const { nacionalidad, cedula } = req.body;

  // Validación del body (equivalente a los errores 400 de la API externa)
  if (!nacionalidad || !['V', 'E'].includes(String(nacionalidad).toUpperCase())) {
    return res.status(400).json({ error: 'La nacionalidad es requerida y sólo puede ser V o E.' });
  }
  const cedulaNum = Number(cedula);
  if (cedula === undefined || cedula === null || cedula === '' || !Number.isInteger(cedulaNum) || cedulaNum <= 0) {
    return res.status(400).json({ error: 'El número de cédula debe ser un número entero.' });
  }

  if (!IDENTIFICACION_API_TOKEN) {
    console.error('IDENTIFICACION_API_TOKEN no está configurado en el archivo .env');
    return res.status(500).json({ error: 'Servicio de identificación no configurado.' });
  }

  try {
    let respuesta;
    try {
      respuesta = await axios.post(
        IDENTIFICACION_API_URL,
        {
          nacionalidad: String(nacionalidad).toUpperCase(),
          cedula: cedulaNum,
        },
        {
          headers: {
            Authorization: `Bearer ${IDENTIFICACION_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: IDENTIFICACION_API_TIMEOUT,
        }
      );
    } catch (apiErr) {
      const status = apiErr.response?.status;
      if (status === 400) {
        return res.status(400).json({ error: 'Datos de identidad inválidos. Verifique la nacionalidad y el número de cédula.' });
      }
      if (status === 401 || status === 403) {
        console.error('Token de la API de identificación inválido o suspendido.');
        return res.status(502).json({ error: 'El servicio de identificación no está disponible en este momento. Intente más tarde.' });
      }
      if (status === 429) {
        return res.status(429).json({ error: 'Se ha superado el límite de consultas de identidad. Intente en unos minutos.' });
      }
      console.error('Error al consultar API de identificación:', apiErr.message);
      return res.status(502).json({ error: 'No se pudo consultar el servicio de identificación. Intente nuevamente.' });
    }

    const { success, data } = respuesta.data || {};

    // Cédula/nacionalidad no encontrados: data en null
    if (!success || !data) {
      return res.status(404).json({
        encontrado: false,
        message: 'No se encontraron datos de identidad para la cédula y nacionalidad indicadas. Verifique los datos e intente nuevamente.',
      });
    }

    // Datos encontrados
    res.status(200).json({
      encontrado: true,
      identidad: {
        cedula: data.cedula,
        primer_nombre: data.primer_nombre || '',
        segundo_nombre: data.segundo_nombre || '',
        primer_apellido: data.primer_apellido || '',
        segundo_apellido: data.segundo_apellido || '',
        sexo: data.sexo || null,
        nacionalidad: data.nacionalidad || String(nacionalidad).toUpperCase(),
        fecha_nacimiento: data.fecha_nacimiento || null,
      },
    });
  } catch (err) {
    console.error('Error en consultarIdentidad:', err.message);
    res.status(500).json({ error: 'Error al consultar la identidad.' });
  }
};

// ============================================================
// PASO 4: Completar registro (crear usuario + centro)
// POST /auth/registro/completar
// Headers: Authorization: Bearer <registroToken>
// Body: {
//   identidad: { cedula, primer_nombre, segundo_nombre, primer_apellido,
//                segundo_apellido, sexo, nacionalidad, fecha_nacimiento },
//   telefono, celular,
//   password,
//   centro: { tipo_rif, numero_rif, nombre, direccion, telefono, correo }
// }
// ============================================================
exports.completarRegistro = async (req, res) => {
  const registroToken = req.headers['authorization']?.split(' ')[1];
  const decoded = registroToken ? verificarRegistroToken(registroToken) : null;
  if (!decoded) {
    return res.status(401).json({ error: 'Sesión de registro inválida o expirada. Inicie nuevamente el proceso de registro.' });
  }
  const email = decoded.email;

  const {
    identidad,
    telefono,
    celular,
    password,
    centro,
    archivoRif,
  } = req.body || {};

  const client = await pool.connect();
  try {
    // ============================================
    // 1. Validaciones de la identidad
    // ============================================
    if (!identidad || !identidad.cedula || !identidad.primer_nombre || !identidad.primer_apellido) {
      return res.status(400).json({ error: 'Los datos de identidad son requeridos. Consulte primero la cédula en el paso anterior.' });
    }
    if (!['V', 'E'].includes(String(identidad.nacionalidad || '').toUpperCase())) {
      return res.status(400).json({ error: 'La nacionalidad sólo puede ser V o E.' });
    }

    // ============================================
    // 2. Validaciones de los teléfonos del usuario
    // ============================================
    if (!telefono || !String(telefono).trim()) {
      return res.status(400).json({ error: 'El número de teléfono del usuario es requerido.' });
    }
    if (!celular || !String(celular).trim()) {
      return res.status(400).json({ error: 'El número de celular del usuario es requerido.' });
    }

    // ============================================
    // 3. Validación de la contraseña
    // ============================================
    const passwordErrors = validateRegistroPassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'La contraseña no cumple los requisitos.', details: passwordErrors });
    }

    // ============================================
    // 4. Validaciones del centro
    // ============================================
    if (!centro) {
      return res.status(400).json({ error: 'Los datos del centro son requeridos.' });
    }
    const { tipo_rif, numero_rif, nombre, direccion, telefono: centroTelefono, correo: centroCorreo } = centro;

    const tipoRifNorm = String(tipo_rif || '').toUpperCase().trim();
    const TIPOS_RIF_PERMITIDOS = ['J', 'G', 'C'];
    if (!TIPOS_RIF_PERMITIDOS.includes(tipoRifNorm)) {
      return res.status(400).json({ error: 'El tipo de RIF sólo puede ser J (Jurídico), G (Gobierno) o C (Comuna).' });
    }
    const numRifDigits = String(numero_rif || '').replace(/\D/g, '');
    if (!numero_rif || numRifDigits.length < 8 || numRifDigits.length > 9) {
      return res.status(400).json({ error: 'El número del RIF debe contener entre 8 y 9 dígitos.' });
    }
    // RIF completo (formato estándar: J-12345678-9)
    const rifCompleto = `${tipoRifNorm}-${numRifDigits.slice(0, 8)}-${numRifDigits.slice(8) || ''}`.replace(/-$/, '');

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del centro es requerido.' });
    }
    if (!direccion || !String(direccion).trim()) {
      return res.status(400).json({ error: 'La dirección del centro es requerida.' });
    }
    if (!centroTelefono || !String(centroTelefono).trim()) {
      return res.status(400).json({ error: 'El número de teléfono del centro es requerido.' });
    }
    const centroCorreoNorm = String(centroCorreo || '').toLowerCase().trim();
    if (!centroCorreoNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(centroCorreoNorm)) {
      return res.status(400).json({ error: 'El correo electrónico del centro es requerido y debe ser válido.' });
    }

    // ============================================
    // 5. Verificar que la verificación de correo sigue vigente
    // ============================================
    const verifResult = await client.query(
      `SELECT id, verified, used_at FROM registro_verificaciones
       WHERE id = $1 AND email = $2`,
      [decoded.verificacionId, email]
    );
    if (!verifResult.rows.length || !verifResult.rows[0].verified || verifResult.rows[0].used_at) {
      return res.status(401).json({ error: 'La verificación del correo ya fue utilizada. Inicie nuevamente el proceso de registro.' });
    }

    // ============================================
    // 6. Unicidad: cada usuario registra un solo centro
    //    y cédula/correo no pueden repetirse
    // ============================================
    await client.query('BEGIN');

    const cedulaNum = parseInt(identidad.cedula, 10);

    const cedulaExist = await client.query(
      'SELECT id FROM users WHERE cedula = $1 AND deleted_at IS NULL FOR UPDATE',
      [cedulaNum]
    );
    if (cedulaExist.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un usuario registrado con esta cédula.' });
    }

    const emailExist = await client.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL FOR UPDATE',
      [email]
    );
    if (emailExist.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    // ============================================
    // 7. Crear el centro
    // ============================================
    // Varios centros pueden compartir el mismo RIF (sin restricción de unicidad),
    // pero cada centro queda asignado a un usuario distinto.
    const centroResult = await client.query(
      `INSERT INTO public.centros
         (nombre_establecimiento, rif, estado_centro)
       VALUES ($1, $2, 'activo')
       RETURNING id`,
      [String(nombre).trim().toUpperCase(), rifCompleto]
    );
    const centroId = centroResult.rows[0].id;

    // Guardar archivo RIF si fue cargado por el usuario (base64)
    let rifArchivoPath = null;
    if (archivoRif && archivoRif.base64 && archivoRif.nombre) {
      rifArchivoPath = await guardarArchivoRif(centroId, archivoRif.base64, archivoRif.nombre);
      if (rifArchivoPath) {
        await client.query(
          `UPDATE public.centros SET rif_archivo = $1, updated_at = NOW() WHERE id = $2`,
          [rifArchivoPath, centroId]
        );
        console.log(`  → Archivo RIF guardado en: ${rifArchivoPath}`);
      }
    }

    // Teléfono del centro
    await client.query(
      `INSERT INTO public.centro_telefonos (centro_id, telefono, tipo)
       VALUES ($1, $2, 'general')`,
      [centroId, String(centroTelefono).trim()]
    );

    // Correo del centro
    await client.query(
      `INSERT INTO public.centro_correos (centro_id, correo, tipo)
       VALUES ($1, $2, 'general')`,
      [centroId, centroCorreoNorm]
    );

    // Ficha inicial del centro con la dirección (texto libre)
    await client.query(
      `INSERT INTO public.fichas_establecimiento
         (centro_id, version, direccion, is_current)
       VALUES ($1, 1, $2, TRUE)`,
      [centroId, String(direccion).trim()]
    );

    // ============================================
    // 8. Crear el usuario vinculado al centro
    // ============================================
    const primerNombre = String(identidad.primer_nombre || '').trim();
    const segundoNombre = String(identidad.segundo_nombre || '').trim();
    const primerApellido = String(identidad.primer_apellido || '').trim();
    const segundoApellido = String(identidad.segundo_apellido || '').trim();

    const firstName = [primerNombre, segundoNombre].filter(Boolean).join(' ').toUpperCase();
    const lastName = [primerApellido, segundoApellido].filter(Boolean).join(' ').toUpperCase();

    const hashedPassword = await hashPassword(password);

    const userResult = await client.query(
      `INSERT INTO users
         (first_name, last_name, cedula, nacionalidad, email, password_hash,
          is_email_verified, is_temporary_password, status, sexo, fecha_nacimiento,
          telefono, celular, centro_id)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, 'active', $7, $8, $9, $10, $11)
       RETURNING id, first_name, last_name, email`,
      [
        firstName,
        lastName,
        cedulaNum,
        String(identidad.nacionalidad).toUpperCase(),
        email,
        hashedPassword,
        identidad.sexo ? String(identidad.sexo).toUpperCase() : null,
        identidad.fecha_nacimiento || null,
        String(telefono).trim(),
        String(celular).trim(),
        centroId,
      ]
    );
    const newUser = userResult.rows[0];

    // ============================================
    // 9. Asignar el rol "Usuario" (id 2) por defecto
    // ============================================
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE LOWER(name) = 'usuario' LIMIT 1`,
      [newUser.id]
    );

    // ============================================
    // 10. Consumir la verificación de correo
    // ============================================
    await client.query(
      `UPDATE registro_verificaciones SET used_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND used_at IS NULL`,
      [decoded.verificacionId]
    );

    await client.query('COMMIT');

    console.log(`✅ AUTORREGISTRO EXITOSO: ${email} (ID: ${newUser.id}) -> Centro: ${centroId}`);

    res.status(201).json({
      message: 'Registro completado exitosamente. Ya puede iniciar sesión.',
      userId: newUser.id,
      centroId,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en completarRegistro:', err);
    res.status(500).json({ error: 'Error al completar el registro.', detail: err.message });
  } finally {
    client.release();
  }
};
