const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function check() {
    try {
        // Find tables related to states/parishes
        const tablesRes = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('estados', 'municipios', 'parroquias')
        `);
        console.log("Tables found:", tablesRes.rows.map(r => r.tablename));

        if (tablesRes.rows.some(r => r.tablename === 'estados')) {
            const estadosRes = await pool.query(`SELECT id, nombre FROM estados WHERE nombre ILIKE '%aragua%' OR nombre ILIKE '%carabobo%' OR nombre ILIKE '%miranda%' OR nombre ILIKE '%capital%' OR nombre ILIKE '%guaira%' OR nombre ILIKE '%vargas%'`);
            console.log("Central States:", JSON.stringify(estadosRes.rows, null, 2));
        }

    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
