const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'renacer',
  password: 'postgres',
  port: 5432
});

(async () => {
  try {
    const sql = fs.readFileSync('../bd/migration_user_permissions_crud.sql', 'utf8');
    await pool.query(sql);
    console.log("Migración ejecutada exitosamente.");
    process.exit(0);
  } catch (err) {
    console.error("Error ejecutando migración", err);
    process.exit(1);
  }
})();
