const fs = require('fs');
const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `.env.${ambiente}`) });
const pool = require('./db');


(async () => {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, '../sql/fix_usuario_role.sql'), 'utf-8');
        await client.query(sql);
        console.log('✅ SQL fix applied successfully.');
    } catch (err) {
        console.error('❌ Error applying SQL fix:', err);
    } finally {
        client.release();
        process.exit();
    }
})();
