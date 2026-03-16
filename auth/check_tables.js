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
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'ficha_%' OR table_name LIKE 'centro_%' OR table_name = 'fichas_establecimiento')
            ORDER BY table_name, ordinal_position
        `);
        
        const tables = {};
        for(let row of res.rows) {
            if(!tables[row.table_name]) tables[row.table_name] = [];
            tables[row.table_name].push({ column: row.column_name, type: row.data_type, nullable: row.is_nullable });
        }
        
        console.log(JSON.stringify(tables, null, 2));
    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
