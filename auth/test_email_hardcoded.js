// d:\proyectos\rencam\auth\test_email_hardcoded.js
const nodemailer = require('nodemailer');

// ==========================================
// CONFIGURACIÓN HARDCODEADA (Ajusta si es necesario)
// ==========================================
const config = {
    host: 'correo.minaamp.gob.ve',
    port: 587,
    secure: false, // false para TLS (STARTTLS)
    user: 'renacer@minaamp.gob.ve',
    pass: 'Renacer123.',
    from: 'renacer@minaamp.gob.ve',
    to: 'renacer@gmail.com' // Correo donde recibirás la prueba
};

async function sendTest() {
    console.log('--- Iniciando prueba de envío de correo (Hardcoded) ---');
    console.log(`Intentando conectar a ${config.host}:${config.port}...`);

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
        tls: {
            rejectUnauthorized: false // Permite certificados internos/auto-firmados
        }
    });

    try {
        // Verificar conexión primero
        console.log('Verificando conexión con el servidor SMTP...');
        await transporter.verify();
        console.log('✅ Conexión con el servidor SMTP establecida correctamente.');

        // Enviar correo
        console.log(`Enviando correo de prueba a ${config.to}...`);
        const info = await transporter.sendMail({
            from: `"Prueba RENACER" <${config.from}>`,
            to: config.to,
            subject: "Prueba de Conexión SMTP - Hardcoded",
            text: "Si recibes este correo, el puerto 587 está abierto y pfSense permite la salida desde el servidor de aplicaciones.",
            html: "<b>Prueba de conexión exitosa</b><p>El servidor ya tiene salida al puerto 587.</p>"
        });

        console.log('✅ ¡Correo enviado con éxito!');
        console.log('ID del mensaje:', info.messageId);
    } catch (error) {
        console.error('❌ Error detallado:');
        if (error.code === 'ETIMEDOUT' || error.command === 'CONN') {
            console.error('ERROR DE CONEXIÓN: No se pudo llegar al servidor (posible bloqueo de Firewall/pfSense).');
        }
        console.error(error);
    }
}

sendTest();
