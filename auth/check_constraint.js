const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conname = 'centros_tipo_establecimiento_check'
            AND n.nspname = 'public';
        `);
        fs.writeFileSync('constraint.json', JSON.stringify({ constraint: res.rows[0].constraint_def }, null, 2));
    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
