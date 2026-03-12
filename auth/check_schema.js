const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `.env.${ambiente}`) });

const pool = require('./src/db');

async function checkSchema() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log(res.rows.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
