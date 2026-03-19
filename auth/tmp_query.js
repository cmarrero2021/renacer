const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'renacer',
  password: 'postgres',
  port: 5432
});

(async () => {
  const users = await pool.query("SELECT id, email FROM users WHERE email IN ('siul@correo.com','admin@correo.com')");
  console.log('USERS:', JSON.stringify(users.rows));
  
  const perms = await pool.query("SELECT id, name FROM permissions WHERE name = 'view_admin_panel'");
  console.log('PERMISSIONS:', JSON.stringify(perms.rows));
  
  const userRoles = await pool.query("SELECT ur.user_id, ur.role_id, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id IN (SELECT id FROM users WHERE email IN ('siul@correo.com','admin@correo.com'))");
  console.log('USER_ROLES:', JSON.stringify(userRoles.rows));
  
  process.exit(0);
})();
