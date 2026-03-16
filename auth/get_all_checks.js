const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) AS def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            JOIN pg_class cl ON cl.oid = c.conrelid
            WHERE n.nspname = 'public' 
            AND (cl.relname LIKE 'ficha_%' OR cl.relname LIKE 'centro_%' OR cl.relname = 'fichas_establecimiento')
            AND c.contype = 'c';
        `);
        res.rows.forEach(r => console.log(`${r.conname}: ${r.def}`));
    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
