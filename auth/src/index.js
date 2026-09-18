const path = require('path');
const http = require('http');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `../auth/.env.${ambiente}`) });
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes');
const routesCentros = require('./routes_centros');
const routesCatalogos = require('./routes_catalogos');
const pool = require('./db');
const listEndpoints = require('./endpointlister');
const { setupWebSocket } = require('./websocket');

dotenv.config();

const app = express();

// Confiar en el proxy inverso (Nginx) para obtener la IP real del cliente
app.set('trust proxy', true);

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

// Middleware para parsear JSON y URL-encoded (con límite de 50MB para PDFs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rutas principales
app.use('/auth', routes);
app.use('/auth', routesCentros);
app.use('/auth', routesCatalogos);

// Endpoint para listar rutas (sin autenticación)
app.get('/list-endpoints', (req, res) => {
    const endpoints = listEndpoints(app);
    res.json(endpoints);
});

// Crear servidor HTTP y montar WebSocket en el mismo puerto
const PORT = process.env.PORT_AUTH || 4110;
const server = http.createServer(app);

// Montar WebSocket server en path /ws
setupWebSocket(server);

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`WebSocket disponible en ws://localhost:${PORT}/ws`);
});