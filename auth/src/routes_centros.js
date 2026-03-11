// src/routes_centros.js
const express = require('express');
const router = express.Router();
const {
    listEstados, listMunicipios, listParroquias,
    listCentros, getCentro, createCentro, updateCentro, deleteCentro,
    listFichas, getFichaActual, createFicha, updateFicha, addPoblacion,
    listCentroUsers, grantCentroAccess, revokeCentroAccess, listUserCentros,
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
router.get('/centros/:id', getCentro); // Protegido por verifyCentroAccess
router.put('/centros/:id', updateCentro); // Protegido por verifyCentroAccess
router.delete('/centros/:id', deleteCentro); // Protegido por verifyCentroAccess

// ─── Fichas (versionadas) ─────────────────────────────────────────────────
router.get('/centros/:centroId/fichas', listFichas); // Protegido por verifyCentroAccess
router.get('/centros/:centroId/fichas/actual', getFichaActual); // Protegido por verifyCentroAccess
router.post('/centros/:centroId/fichas', createFicha); // Protegido por verifyCentroAccess
router.put('/fichas/:fichaId', updateFicha); // Protegido por verifyCentroAccess

// ─── Upserts por sección (guardado parcial) ───────────────────────────────
router.put('/fichas/:fichaId/capacidad', saveCapacidad);
router.put('/fichas/:fichaId/servicios', saveServicios);
router.put('/fichas/:fichaId/personal', savePersonal);
router.put('/fichas/:fichaId/infraestructura', saveInfraestructura);
router.put('/fichas/:fichaId/documentos', saveDocumentos);


// ─── Población (histórico) ─────────────────────────────────────────────────
router.post('/fichas/:fichaId/poblacion', authorize('edit_centro'), addPoblacion);

// ─── Acceso delegado ──────────────────────────────────────────────────────
router.get('/centros/:centroId/usuarios', authorize('manage_centro_access'), listCentroUsers);
router.post('/centros/:centroId/usuarios', authorize('manage_centro_access'), grantCentroAccess);
router.delete('/centros/:centroId/usuarios/:userId', authorize('manage_centro_access'), revokeCentroAccess);
router.get('/usuarios/:userId/centros', listUserCentros); // Permiso interno verificado en controlador


module.exports = router;
