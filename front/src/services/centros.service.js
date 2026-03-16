// src/services/centros.service.js
// Servicio para comunicación con el backend del módulo de centros
import { authApi } from 'boot/axios';

// ─── Geo-catálogos ──────────────────────────────────────────────────────────
export const geoService = {
    getEstados: () => authApi.get('/geo/estados'),
    getMunicipios: (estadoId) => authApi.get('/geo/municipios', { params: { estado_id: estadoId } }),
    getParroquias: (municipioId) => authApi.get('/geo/parroquias', { params: { municipio_id: municipioId } }),
    // Proxy Nominatim (CORS bypass)
    proxySearch: (query) => authApi.get('/geo/proxy/search', { params: { q: query } }),
    proxyReverse: (lat, lon) => authApi.get('/geo/proxy/reverse', { params: { lat, lon } }),
    resolveGeo: (data) => authApi.post('/geo/resolve', data),
};

// ─── Mi centro (ficha única) ─────────────────────────────────────────────────
export const miCentroService = {
    get: () => authApi.get('/mi-centro'),
};

// ─── Centros ─────────────────────────────────────────────────────────────────
export const centrosService = {
    list: () => authApi.get('/centros'),
    get: (id) => authApi.get(`/centros/${id}`),
    create: (data) => authApi.post('/centros', data),
    update: (id, data) => authApi.put(`/centros/${id}`, data),
    delete: (id) => authApi.delete(`/centros/${id}`),
};

// ─── Fichas ───────────────────────────────────────────────────────────────────
export const fichasService = {
    list: (centroId) => authApi.get(`/centros/${centroId}/fichas`),
    getActual: (centroId) => authApi.get(`/centros/${centroId}/fichas/actual`),
    create: (centroId, data) => authApi.post(`/centros/${centroId}/fichas`, data),
    update: (fichaId, data) => authApi.put(`/fichas/${fichaId}`, data),
    // Guardado parcial por sección
    saveCapacidad: (fichaId, data) => authApi.put(`/fichas/${fichaId}/capacidad`, data),
    saveServicios: (fichaId, data) => authApi.put(`/fichas/${fichaId}/servicios`, data),
    savePersonal: (fichaId, data) => authApi.put(`/fichas/${fichaId}/personal`, data),
    saveInfraestructura: (fichaId, data) => authApi.put(`/fichas/${fichaId}/infraestructura`, data),
    saveDocumentos: (fichaId, data) => authApi.put(`/fichas/${fichaId}/documentos`, data),
    addPoblacion: (fichaId, data) => authApi.post(`/fichas/${fichaId}/poblacion`, data),
};

// ─── Acceso delegado ──────────────────────────────────────────────────────────
export const centroAccessService = {
    listUsers: (centroId) => authApi.get(`/centros/${centroId}/usuarios`),
    grant: (centroId, data) => authApi.post(`/centros/${centroId}/usuarios`, data),
    revoke: (centroId, userId) => authApi.delete(`/centros/${centroId}/usuarios/${userId}`),
};

// ─── Mantenimiento ──────────────────────────────────────────────────────────
export const maintenanceService = {
    purgeDeleted: () => authApi.post('/maintenance/purge'),
    getMaintenanceLogs: () => authApi.get('/maintenance/logs'),
};



