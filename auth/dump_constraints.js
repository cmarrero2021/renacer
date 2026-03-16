const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

pool.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE n.nspname = 'public' 
    AND (cl.relname LIKE 'ficha_%' OR cl.relname LIKE 'centro_%' OR cl.relname = 'fichas_establecimiento')
    AND c.contype = 'c';
`).then(res => {
    const out = {};
    res.rows.forEach(r => out[r.conname] = r.def);
    fs.writeFileSync(path.join(__dirname, 'constraints.json'), JSON.stringify(out, null, 2), 'utf8');
}).finally(() => pool.end());
