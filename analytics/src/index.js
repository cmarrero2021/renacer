// analytics/src/index.js
// Micro-servicio Analytics: GraphQL + Dashboard Dinámico
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const express = require('express');
const cors = require('cors');
const dashboardRoutes = require('./routes_dashboard');

const app = express();
const PORT = process.env.PORT_ANALYTICS || 4120;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No autorizado por CORS'));
        }
    },
    credentials: true,
}));

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/analytics/health', (req, res) => {
    res.json({ status: 'ok', service: 'RENACER Analytics', timestamp: new Date().toISOString() });
});

// ─── Mount Routes ─────────────────────────────────────────────────────────────
app.use('/analytics', dashboardRoutes);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Analytics Error:', err.message);
    res.status(500).json({ error: 'Error interno del servicio Analytics' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🔬 Analytics API corriendo en http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/analytics/graphql`);
    console.log(`💾 Consultas guardadas: http://localhost:${PORT}/analytics/saved-queries`);
});
