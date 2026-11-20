const fs = require('fs');
const { Pool } = require('pg');

const env = {};
fs.readFileSync('G:/Mi unidad/sistemas/rencam/auth/.env.development', 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
});

const pool = new Pool({
    user: env.DB_USER, host: env.DB_HOST, database: env.DB_NAME,
    password: env.DB_PASSWORD, port: parseInt(env.DB_PORT, 10),
    connectionTimeoutMillis: 8000,
});

(async () => {
    try {
        // Últimas filas guardadas con su extras y updated_at
        const r = await pool.query(`
            SELECT ficha_id, farmacia, medicos, otros, extras, updated_at
            FROM public.ficha_servicios
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 5`);
        console.log('=== últimas filas ficha_servicios ===');
        r.rows.forEach(x => console.log(JSON.stringify(x)));
    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        await pool.end();
    }
})();
