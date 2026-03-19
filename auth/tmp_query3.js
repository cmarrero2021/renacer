const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'renacer',
  password: 'postgres',
  port: 5432
});

(async () => {
  const perms = await pool.query("SELECT id, name FROM permissions WHERE name LIKE '%permission%'");
  console.log('PERMISSIONS:', JSON.stringify(perms.rows, null, 2));
  process.exit(0);
})();
