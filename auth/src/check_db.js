const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require('dotenv').config({ path: path.resolve(process.cwd(), `.env.${ambiente}`) });
const pool = require('./db');


(async () => {
  const client = await pool.connect();
  try {
    console.log('--- USERS AND CENTRO_ID ---');
    const users = await client.query('SELECT id, first_name, last_name, email, centro_id FROM users WHERE deleted_at IS NULL');
    console.table(users.rows);

    console.log('\n--- ROLES AND PERMISSIONS ---');
    const rolePerms = await client.query(`
      SELECT r.name as role, p.name as permission
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'usuario'
      ORDER BY r.name, p.name
    `);
    console.table(rolePerms.rows);


  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit();
  }
})();

