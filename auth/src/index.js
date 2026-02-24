const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `../auth/.env.${ambiente}`) });
// require('dotenv').config({ path: path.resolve(process.cwd(), `../.env.${process.env.NODE_ENV || 'development'}`) });
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // Importar el paquete cors
const routes = require('./routes');
const pool = require('./db');
const listEndpoints = require('./endpointlister'); // Importar la función listEndpoints

dotenv.config();

const app = express();

// Configuración de CORS
// const defaultOrigins = [
//     'http://localhost:9000',
//     'http://localhost:4000',
//     'http://localhost:4100',
//     'https://directorio.minaamp.gob.ve',
//     'https://backdirectorio.minaamp.gob.ve',
//     'https://authdirectorio.minaamp.gob.ve'
// ];

if (!process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS no está definido en el archivo .env');
}
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');

console.log('allowedOrigins: ', allowedOrigins);

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'], // Cabeceras permitidas
    credentials: true // Permite el envío de credenciales (cookies, tokens, etc.)
}));

// Middleware para parsear JSON
app.use(express.json());
// Servir archivos estáticos desde la carpeta uploads
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public/portadas', express.static(path.join(__dirname, 'uploads')));

// Rutas de mantenedores
const mantenedoresRoutes = require('./mantenedores');
app.use('/auth/mantenedor', mantenedoresRoutes);

// Rutas principales
// app.use('/api', routes);
app.use('/auth', routes);

// Endpoint para listar rutas (sin autenticación)
app.get('/list-endpoints', (req, res) => {
    const endpoints = listEndpoints(app); // Llamar a la función para listar endpoints
    res.json(endpoints);
});

const PORT = process.env.PORT_AUTH || 4100;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});