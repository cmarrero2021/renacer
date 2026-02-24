/**
 * Módulo de Auditoría
 * 
 * Proporciona funciones para establecer el contexto de auditoría
 * en PostgreSQL antes de ejecutar operaciones CRUD.
 * 
 * El contexto permite que los triggers de auditoría capturen
 * información del usuario, IP y sesión.
 */

/**
 * Establece el contexto de auditoría en la conexión de PostgreSQL.
 * Debe llamarse al inicio de cada transacción que requiera auditoría.
 * 
 * @param {Object} client - Cliente de PostgreSQL (de pool.connect())
 * @param {Object} context - Contexto de auditoría
 * @param {number} context.userId - ID del usuario
 * @param {string} context.username - Nombre de usuario
 * @param {string} context.ipAddress - Dirección IP
 * @param {string} context.sessionToken - Token de sesión
 */
const setAuditContext = async (client, context = {}) => {
    const { userId, username, ipAddress, sessionToken } = context;

    try {
        await client.query("SELECT public.set_audit_context($1, $2, $3, $4)", [
            userId || null,
            username || null,
            ipAddress || null,
            sessionToken || null
        ]);
    } catch (err) {
        // Si la función no existe, fallar silenciosamente
        // Esto permite que el código funcione aunque la auditoría no esté instalada
        console.warn('[Audit] No se pudo establecer contexto de auditoría:', err.message);
    }
};

/**
 * Extrae información de auditoría del request de Express
 * 
 * @param {Object} req - Request de Express
 * @returns {Object} Contexto de auditoría
 */
const extractAuditContext = (req) => {
    return {
        userId: req.userId || null,
        username: req.username || req.user?.email || null,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
        sessionToken: req.headers.authorization?.replace('Bearer ', '') || null
    };
};

/**
 * Middleware wrapper que establece el contexto de auditoría
 * antes de ejecutar operaciones en la base de datos.
 * 
 * Uso:
 * const { withAuditContext } = require('./audit');
 * 
 * exports.updateRecord = async (req, res) => {
 *   const client = await pool.connect();
 *   try {
 *     await withAuditContext(client, req);
 *     // ... realizar operaciones CRUD
 *   } finally {
 *     client.release();
 *   }
 * };
 */
const withAuditContext = async (client, req) => {
    const context = extractAuditContext(req);
    await setAuditContext(client, context);
};

module.exports = {
    setAuditContext,
    extractAuditContext,
    withAuditContext
};
