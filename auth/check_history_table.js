const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function check() {
    try {
        const res = await pool.query("SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_history'");
        if (res.rows.length === 0) {
            console.log("TABLE_MISSING");
        } else {
            console.log("TABLE_EXISTS");
        }
    } catch (err) {
        console.error("ERROR", err.message);
    } finally {
        await pool.end();
    }
}

check();
