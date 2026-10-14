// src/routes_registro.js
// Rutas públicas del sistema de autorregistro de usuarios
// src/routes_registro.js
// Rutas públicas del sistema de autorregistro de usuarios
const express = require('express');
const router = express.Router();
const {
  requestRegistroCode,
  verifyRegistroCode,
  consultarIdentidad,
  completarRegistro,
} = require('./controllers_registro');
const { readRifFromUpload } = require('./controllers_rif');

// Rutas Públicas de Autorregistro
router.post('/registro/request-code', requestRegistroCode);          // Paso 1: solicitar código
router.post('/registro/verify-code', verifyRegistroCode);            // Paso 2: verificar código
router.post('/registro/consultar-identidad', consultarIdentidad);    // Paso 3: consultar API de identidad
router.post('/registro/read-rif', readRifFromUpload);                // Paso 4: extraer datos del RIF cargado
router.post('/registro/completar', completarRegistro);               // Paso 4: crear usuario + centro

module.exports = router;
