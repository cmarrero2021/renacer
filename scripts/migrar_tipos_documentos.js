const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const target = process.argv.includes('--prod')
    ? { host: '192.168.0.32', database: 'renacer', label: 'PRODUCCIÓN' }
    : { host: '192.168.0.32', database: 'renacer_dev', label: 'DESARROLLO' };

const client = new Client({
    host: target.host, database: target.database,
    user: 'postgres', password: 'postgres', port: 5432,
    connectionTimeoutMillis: 8000,
});

async function resumen() {
    const col = await client.query(`SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='tipos_documentos' ORDER BY ordinal_position`);
    console.log('Columnas tipos_documentos:', col.rows.map(r => r.column_name).join(', '));
    const cat = await client.query('SELECT id, nombre, activo, deleted_at FROM public.tipos_documentos ORDER BY id');
    console.log(`Catálogo (${cat.rows.length}):`);
    cat.rows.forEach(r => console.log(`  ${r.id} | ${r.nombre}${r.deleted_at ? ' (eliminado)' : ''}${r.activo ? '' : ' [inactivo]'}`));
    const con = await client.query("SELECT conname FROM pg_constraint WHERE conrelid='public.tipos_documentos'::regclass ORDER BY conname");
    console.log('Restricciones:', con.rows.map(r => r.conname).join(', '));
    const fd = await client.query('SELECT id, ficha_id, tipo_documento, archivo_ruta IS NOT NULL AS con_archivo FROM public.ficha_documentos ORDER BY ficha_id, id');
    console.log(`ficha_documentos (${fd.rows.length}):`);
    fd.rows.forEach(r => console.log(`  fila ${r.id} ficha ${r.ficha_id}: tipo='${r.tipo_documento}'${r.con_archivo ? ' [con archivo]' : ''}`));
    const inv = fd.rows.filter(r => !/^\d+$/.test(String(r.tipo_documento)));
    console.log(inv.length === 0 ? 'OK: todos los tipo_documento son ids.' : `SIN CONVERTIR (${inv.length}): ${JSON.stringify(inv)}`);
}

(async () => {
    await client.connect();
    console.log(`Conectado a ${target.label} (${target.database})`);
    if (!process.argv.includes('--check')) {
        const sql = fs.readFileSync(path.join(__dirname, '../bd/20261126_2100_tipos_documentos_sin_codigo.sql'), 'utf8');
        console.log('Aplicando migración...');
        await client.query(sql);
        console.log('✓ Migración ejecutada\n');
    }
    await resumen();
    await client.end();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
