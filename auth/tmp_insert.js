const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'renacer',
  password: 'postgres',
  port: 5432
});

(async () => {
  // Esperar 10 segundos para dar tiempo al login
  console.log("Esperando 10 segundos antes de asignar el permiso...");
  await new Promise(r => setTimeout(r, 10000));
  
  // Limpiar permiso previo por si quedó de una corrida anterior
  await pool.query("DELETE FROM user_permissions WHERE user_id = 14 AND permission_id = 75");

  // Asignar permiso 75 a user 14
  console.log("INSERTANDO permiso 75 (view_audit_menu) a usuario 14 (siul@correo.com)...");
  await pool.query("INSERT INTO user_permissions (user_id, permission_id) VALUES (14, 75)");
  console.log("Permiso asignado. El WebSocket deberia empujarlo.");
  
  process.exit(0);
})();
