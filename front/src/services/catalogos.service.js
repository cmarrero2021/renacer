// src/services/catalogos.service.js
import { authApi } from 'boot/axios';

export const catalogosService = {
    // Obtener metadatos y permisos de todos los catálogos
    getMeta: () => authApi.get('/catalogos'),

    // Listar registros con paginación, filtros y búsqueda
    list: (catalogo, params = {}) => authApi.get(`/catalogos/${catalogo}`, { params }),

    // Obtener un registro por ID
    get: (catalogo, id) => authApi.get(`/catalogos/${catalogo}/${id}`),

    // Crear un nuevo registro
    create: (catalogo, data) => authApi.post(`/catalogos/${catalogo}`, data),

    // Actualizar un registro existente
    update: (catalogo, id, data) => authApi.put(`/catalogos/${catalogo}/${id}`, data),

    // Eliminar registro (borrado lógico)
    delete: (catalogo, id) => authApi.delete(`/catalogos/${catalogo}/${id}`),

    // Obtener opciones padre (ej: estados para municipios)
    getParents: (catalogo) => authApi.get(`/catalogos/${catalogo}/padres`),
};
