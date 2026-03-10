// src/routes_centros.js
const express = require('express');
const router = express.Router();
const {
    listEstados, listMunicipios, listParroquias,
    listCentros, getCentro, createCentro, updateCentro, deleteCentro,
    listFichas, getFichaActual, createFicha, updateFicha, addPoblacion,
    listCentroUsers, grantCentroAccess, revokeCentroAccess,
    getMiCentro, saveCapacidad, saveServicios, savePersonal, saveInfraestructura, saveDocumentos
} = require('./controllers_centros');
const { authenticate, authorize } = require('./middlewares');

router.use(authenticate);

// ─── Catálogos geográficos ─────────────────────────────────────────────────
router.get('/geo/estados', listEstados);
router.get('/geo/municipios', listMunicipios);   // ?estado_id=X
router.get('/geo/parroquias', listParroquias);   // ?municipio_id=X

// ─── Mi centro (verificar ficha única) ────────────────────────────────────
router.get('/mi-centro', getMiCentro);

// ─── Centros CRUD ─────────────────────────────────────────────────────────
router.get('/centros', authorize('list_centros'), listCentros);
router.post('/centros', authorize('create_centro'), createCentro);
router.get('/centros/:id', authorize('view_centro'), getCentro);
router.put('/centros/:id', authorize('edit_centro'), updateCentro);
router.delete('/centros/:id', authorize('delete_centro'), deleteCentro);

// ─── Fichas (versionadas) ─────────────────────────────────────────────────
router.get('/centros/:centroId/fichas', authorize('view_centro'), listFichas);
router.get('/centros/:centroId/fichas/actual', authorize('view_centro'), getFichaActual);
router.post('/centros/:centroId/fichas', authorize('edit_centro'), createFicha);
router.put('/fichas/:fichaId', authorize('edit_centro'), updateFicha);

// ─── Upserts por sección (guardado parcial) ───────────────────────────────
router.put('/fichas/:fichaId/capacidad', authorize('edit_centro'), saveCapacidad);
router.put('/fichas/:fichaId/servicios', authorize('edit_centro'), saveServicios);
router.put('/fichas/:fichaId/personal', authorize('edit_centro'), savePersonal);
router.put('/fichas/:fichaId/infraestructura', authorize('edit_centro'), saveInfraestructura);
router.put('/fichas/:fichaId/documentos', authorize('edit_centro'), saveDocumentos);

// ─── Población (histórico) ─────────────────────────────────────────────────
router.post('/fichas/:fichaId/poblacion', authorize('edit_centro'), addPoblacion);

// ─── Acceso delegado ──────────────────────────────────────────────────────
router.get('/centros/:centroId/usuarios', authorize('manage_centro_access'), listCentroUsers);
router.post('/centros/:centroId/usuarios', authorize('manage_centro_access'), grantCentroAccess);
router.delete('/centros/:centroId/usuarios/:userId', authorize('manage_centro_access'), revokeCentroAccess);

module.exports = router;
