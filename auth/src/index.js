const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `../auth/.env.${ambiente}`) });
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes');
const pool = require('./db');
const listEndpoints = require('./endpointlister');

dotenv.config();

const app = express();

// Configuración de CORS
if (!process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS no está definido en el archivo .env');
}
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');

console.log('allowedOrigins: ', allowedOrigins);

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware para parsear JSON
app.use(express.json());

// Rutas principales
app.use('/auth', routes);

// Endpoint para listar rutas (sin autenticación)
app.get('/list-endpoints', (req, res) => {
    const endpoints = listEndpoints(app);
    res.json(endpoints);
});

const PORT = process.env.PORT_AUTH || 4110;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});