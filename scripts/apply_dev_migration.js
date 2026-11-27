const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: '192.168.0.32',
  database: 'renacer_dev',
  user: 'postgres',
  password: 'postgres',
  port: 5432
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('Connected to renacer_dev');
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../bd/20261126_1200_servicios_catalogo_sin_codigo.sql'),
      'utf8'
    );
    
    console.log('Applying migration...');
    await client.query(sql);
    console.log('✓ Migration applied successfully');
    
    // Verify codigo column is gone
    const cols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'servicios_catalogo' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nRemaining columns in servicios_catalogo:');
    cols.rows.forEach(r => console.log('  -', r.column_name));
    
    if (!cols.rows.find(r => r.column_name === 'codigo')) {
      console.log('✓ Verified: codigo column successfully dropped');
    }
    
    // Check sample extras
    const extrasCheck = await client.query(`
      SELECT id, extras 
      FROM public.ficha_servicios 
      WHERE extras IS NOT NULL 
      LIMIT 3
    `);
    
    console.log('\nSample ficha_servicios.extras after migration:');
    extrasCheck.rows.forEach(row => {
      console.log(`  id=${row.id}: ${JSON.stringify(row.extras)}`);
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
