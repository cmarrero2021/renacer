// Alcance del borrado masivo del 23/09: qué tablas se afectaron
// Uso: node auth/diag_centros.js
require('dotenv').config({ path: require('path').join(__dirname, '.env.development') });
const pool = require('./src/db');

(async () => {
    const client = await pool.connect();
    try {
        const aud = await client.query(
            `SELECT table_name, action, COUNT(*)::int AS n
             FROM audit_logs
             WHERE action_timestamp::date = '2026-09-23'
             GROUP BY table_name, action
             ORDER BY COUNT(*) DESC LIMIT 20`);
        console.log('Acciones auditadas el 23/09 (por tabla):');
        for (const x of aud.rows) console.log(' ', x.table_name, '|', x.action, '|', x.n);

        // Estado de fichas de centros borrados
        const f = await client.query(
            `SELECT (c.deleted_at IS NULL) AS centro_vivo, COUNT(*)::int AS fichas
             FROM fichas_establecimiento f
             JOIN centros c ON c.id = f.centro_id
             WHERE f.deleted_at IS NULL
             GROUP BY 1`);
        console.log('\nFichas vivas por estado del centro:', JSON.stringify(f.rows));

        // usuarios activos con centro asignado
        const u = await client.query(
            `SELECT u.id, u.email, u.centro_id FROM users u
             WHERE u.centro_id IS NOT NULL AND u.deleted_at IS NULL LIMIT 10`);
        console.log('Usuarios activos con centro asignado:', u.rows.length);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally { client.release(); await pool.end(); }
})();
