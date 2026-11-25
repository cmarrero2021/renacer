// src/routes_verificacion.js
// Rutas PÚBLICAS de verificación (sin middleware de autenticación).
// Montar ANTES de routes_centros (que aplica authenticate globalmente).
const express = require('express');
const router = express.Router();
const { getCentroVerificacion } = require('./controllers_verificacion');

router.get('/verificacion/centros/:id', getCentroVerificacion);

module.exports = router;
