// src/services/user.service.js
import { authApi } from 'boot/axios';

export const userService = {
    /**
     * Lista usuarios del sistema (con búsqueda y paginación opcional)
     * @param {Object} params { search, limit, offset }
     */
    list: (params) => authApi.get('/users', { params }),
    /**
     * Lista centros a los que un usuario tiene acceso
     * @param {Number|String} userId 
     */
    listCentros: (userId) => authApi.get(`/usuarios/${userId}/centros`),
};

