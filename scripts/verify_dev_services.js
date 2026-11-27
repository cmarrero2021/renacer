const path = require('path');
require(path.resolve(__dirname, '../auth/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../auth/.env.development') });
const pool = require('../auth/src/db');

(async () => {
    const cat = await pool.query("SELECT id, nombre, categoria FROM public.servicios_catalogo ORDER BY id");
    console.log(`Servicios (${cat.rows.length}):`);
    cat.rows.forEach(r => console.log(`  ${r.id}  ${r.nombre}  [${r.categoria}]`));

    const col = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='servicios_catalogo' ORDER BY ordinal_position");
    console.log('Columnas:', col.rows.map(r => r.column_name).join(', '));

    const con = await pool.query("SELECT conname FROM pg_constraint WHERE conrelid='public.servicios_catalogo'::regclass ORDER BY conname");
    console.log('Restricciones:', con.rows.map(r => r.conname).join(', '));

    const ex = await pool.query("SELECT id, extras FROM public.ficha_servicios WHERE extras IS NOT NULL ORDER BY id LIMIT 10");
    console.log('Extras (primeras 10 fichas):');
    ex.rows.forEach(r => console.log(`  ficha ${r.id}: ${JSON.stringify(r.extras)}`));

    // Validar que toda clave de extras corresponda a un id existente
    const inv = await pool.query(`
        SELECT fs.id, k.key
          FROM public.ficha_servicios fs
         CROSS JOIN LATERAL jsonb_object_keys(fs.extras) k(key)
         WHERE fs.extras IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.servicios_catalogo sc WHERE sc.id::text = k.key)
    `);
    console.log(inv.rows.length === 0 ? 'OK: todas las claves de extras son IDs válidos.' : 'INVÁLIDAS: ' + JSON.stringify(inv.rows));

    await pool.end();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
