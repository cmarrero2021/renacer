// Ejecuta un archivo SQL contra la base definida en auth/.env.development
require('dotenv').config({ path: require('path').join(__dirname, '..', 'auth', process.argv[3] || '.env.development') });
const fs = require('fs');
const { Client } = require(require('path').join(__dirname, '..', 'auth', 'node_modules', 'pg'));

(async () => {
    const file = process.argv[2];
    if (!file) { console.error('Uso: node scripts/run_migration_dev.js <archivo.sql>'); process.exit(1); }
    const sql = fs.readFileSync(file, 'utf8');
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });
    await client.connect();
    try {
        await client.query(sql);
        console.log(`OK: ${file} aplicado en ${process.env.DB_NAME}`);
    } catch (e) {
        console.error('FALLO (la transaccion de la migracion no se confirmo):', e.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
})();
