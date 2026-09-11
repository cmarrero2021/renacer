// src/routes_catalogos.js
const express = require('express');
const router = express.Router();
const {
    listCatalogoMeta,
    listCatalogo,
    getCatalogoItem,
    createCatalogoItem,
    updateCatalogoItem,
    deleteCatalogoItem,
    listParentOptions
} = require('./controllers_catalogos');
const { authenticate } = require('./middlewares');

router.use(authenticate);

// Listar metadatos y permisos de todos los catálogos
router.get('/catalogos', listCatalogoMeta);

// Opciones padre para selects de formularios
router.get('/catalogos/:catalogo/padres', listParentOptions);

// Operaciones CRUD sobre catálogos
router.get('/catalogos/:catalogo', listCatalogo);
router.get('/catalogos/:catalogo/:id', getCatalogoItem);
router.post('/catalogos/:catalogo', createCatalogoItem);
router.put('/catalogos/:catalogo/:id', updateCatalogoItem);
router.delete('/catalogos/:catalogo/:id', deleteCatalogoItem);

module.exports = router;
