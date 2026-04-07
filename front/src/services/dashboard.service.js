// src/services/dashboard.service.js
import { analyticsApi } from 'boot/axios';

// ─── GraphQL ──────────────────────────────────────────────────────────────────
export const graphqlService = {
    query: (query, variables = {}) =>
        analyticsApi.post('/graphql', { query, variables }, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json' }
        }),
};

// ─── Dashboard Data ───────────────────────────────────────────────────────────
export const dashboardService = {
    /**
     * Obtener datos para la tabla pivote via GraphQL dashboardData query
     */
    getData: ({ fields, filters, groupBy, values, limit }) => {
        const query = `
            query DashboardData($fields: [String], $filters: [FilterInput], $groupBy: [String], $values: [FieldConfigInput], $limit: Int) {
                dashboardData(fields: $fields, filters: $filters, groupBy: $groupBy, values: $values, limit: $limit) {
                    columns
                    rows
                    totalRows
                }
            }
        `;
        return graphqlService.query(query, { fields, filters, groupBy, values, limit });
    },

    /**
     * Obtener campos disponibles
     */
    getAvailableFields: () => {
        const query = `{ availableFields }`;
        return graphqlService.query(query);
    },

    /**
     * Obtener lista de centros
     */
    getCentros: (filters = {}) => {
        const args = Object.entries(filters)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: "${v}"`)
            .join(', ');
        const query = `{
            centros${args ? `(${args})` : ''} {
                id nombre_establecimiento tipo_establecimiento tipo_clasificacion
                estado_centro rif estado municipio parroquia latitud longitud
            }
        }`;
        return graphqlService.query(query);
    },
};

// ─── Consultas Guardadas ──────────────────────────────────────────────────────
export const savedQueriesService = {
    list: () => analyticsApi.get('/saved-queries'),
    get: (id) => analyticsApi.get(`/saved-queries/${id}`),
    create: (data) => analyticsApi.post('/saved-queries', data),
    update: (id, data) => analyticsApi.put(`/saved-queries/${id}`, data),
    delete: (id) => analyticsApi.delete(`/saved-queries/${id}`),
    grantAccess: (id, data) => analyticsApi.post(`/saved-queries/${id}/grant`, data),
    revokeAccess: (id, data) => analyticsApi.delete(`/saved-queries/${id}/grant`, { data }),
};
