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
            SELECT table_name, column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('centro_propietarios', 'centro_representantes', 'fichas_establecimiento', 'ficha_personal', 'ficha_poblacion', 'ficha_infraestructura', 'ficha_servicios')
            ORDER BY table_name, ordinal_position
        `);
        const tables = {};
        for(let r of res.rows) {
            if(!tables[r.table_name]) tables[r.table_name] = [];
            tables[r.table_name].push(r.column_name);
        }
        console.log(JSON.stringify(tables, null, 2));
    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
