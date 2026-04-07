// analytics/src/tenant-filter.js
// Lógica de filtrado multi-tenant: determina qué centros puede ver un usuario
const pool = require('./db');

/**
 * Obtiene los IDs de centros accesibles para un usuario.
 * Admin: todos. Normal: centro propio + delegados.
 * @returns {number[]|null} null = todos (admin), array = centros permitidos
 */
async function getAccessibleCentroIds(userId, client) {
    // 1. ¿Es admin?
    const adminResult = await client.query(
        `SELECT 1 FROM (
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
        [userId]
    );
    if (adminResult.rows.length > 0) return null; // null = sin filtro (ve todo)

    // 2. ¿Tiene permiso view_all_centros?
    const permResult = await client.query(
        `SELECT 1 FROM (
            SELECT p.name FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1
            UNION
            SELECT p.name FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = $1
        ) perms WHERE name = 'view_all_centros'`,
        [userId]
    );
    if (permResult.rows.length > 0) return null;

    // 3. Centro propio + delegados
    const accessResult = await client.query(
        `SELECT c.id FROM centros c
         WHERE c.id = (SELECT centro_id FROM users WHERE id = $1 AND deleted_at IS NULL)
           AND c.deleted_at IS NULL
         UNION
         SELECT uca.centro_id FROM user_centro_access uca
         WHERE uca.user_id = $1 AND uca.deleted_at IS NULL`,
        [userId]
    );

    return accessResult.rows.map(r => r.id).filter(Boolean);
}

/**
 * Construye la cláusula WHERE para filtrar por centros accesibles
 * @returns {{ clause: string, params: any[] }}
 */
function buildTenantClause(centroIds, tableAlias = 'c', paramOffset = 1) {
    if (centroIds === null) {
        return { clause: '', params: [], nextParam: paramOffset };
    }
    if (centroIds.length === 0) {
        return { clause: `AND ${tableAlias}.id = -1`, params: [], nextParam: paramOffset }; // sin acceso
    }
    return {
        clause: `AND ${tableAlias}.id = ANY($${paramOffset})`,
        params: [centroIds],
        nextParam: paramOffset + 1
    };
}

module.exports = { getAccessibleCentroIds, buildTenantClause };
