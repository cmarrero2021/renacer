#!/usr/bin/env node
/**
 * Inspecciona y aplica la migración de servicios_catalogo en producción.
 * Ejecuta: bd/20261126_1200_servicios_catalogo_sin_codigo.sql (idempotente).
 * Uso:
 *   node scripts/apply_services_production.js          # inspecciona y aplica
 *   node scripts/apply_services_production.js --check  # solo inspecciona
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const NODE_PATH_OK = (() => { try { require.resolve('pg'); return true; } catch { return false; } })();

const CLIENT_CFG = {
    host: '192.168.0.32',
    database: 'renacer',
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    connectionTimeoutMillis: 8000,
};

async function inspect(client, label) {
    console.log(`\n--- Estado ${label} ---`);
    const col = await client.query(`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='servicios_catalogo'
         ORDER BY ordinal_position`);
    console.log('Columnas servicios_catalogo:', col.rows.map(r => r.column_name).join(', '));
    const hasCodigo = col.rows.some(r => r.column_name === 'codigo');

    const con = await client.query("SELECT conname FROM pg_constraint WHERE conrelid='public.servicios_catalogo'::regclass ORDER BY conname");
    console.log('Restricciones:', con.rows.map(r => r.conname).join(', '));

    const cat = await client.query('SELECT id, nombre FROM public.servicios_catalogo ORDER BY id');
    console.log(`Servicios (${cat.rows.length}):`, cat.rows.map(r => `${r.id}:${r.nombre}`).join(' | '));

    const ex = await client.query(`
        SELECT fs.id, fs.extras
          FROM public.ficha_servicios fs
         WHERE fs.extras IS NOT NULL
         ORDER BY fs.id LIMIT 5`);
    console.log(`Fichas con extras (muestra ${ex.rows.length}):`);
    ex.rows.forEach(r => console.log(`  ficha ${r.id}: ${JSON.stringify(r.extras)}`));

    // Claves de extras que no corresponden a ningún id del catálogo
    const invalid = await client.query(`
        SELECT fs.id, k.key
          FROM public.ficha_servicios fs
         CROSS JOIN LATERAL jsonb_object_keys(fs.extras) k(key)
         WHERE fs.extras IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.servicios_catalogo sc WHERE sc.id::text = k.key)
         LIMIT 20`);
    console.log(invalid.rows.length === 0
        ? 'Todas las claves de extras son IDs válidos.'
        : `Claves NO válidas (${invalid.rows.length}): ` + JSON.stringify(invalid.rows));

    return { hasCodigo };
}

async function main() {
    if (!NODE_PATH_OK) {
        console.error('✗ No se encuentra el módulo pg. Ejecuta con:');
        console.error('  $env:NODE_PATH="G:\\Mi unidad\\sistemas\\rencam\\auth\\node_modules"; node scripts/apply_services_production.js');
        process.exit(1);
    }

    const onlyCheck = process.argv.includes('--check');
    const client = new Client(CLIENT_CFG);

    try {
        console.log(`Conectando a producción (${CLIENT_CFG.host}/${CLIENT_CFG.database})...`);
        await client.connect();
        console.log('✓ Conectado');

        const { hasCodigo } = await inspect(client, 'ANTES');
        if (onlyCheck) { await client.end(); return; }

        const sqlPath = path.resolve(__dirname, '../bd/20261126_1200_servicios_catalogo_sin_codigo.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('\nAplicando migración (idempotente)...');
        await client.query(sqlContent);
        console.log('✓ Migración ejecutada');

        await inspect(client, 'DESPUÉS');
        console.log('\n✓ Migración completada en producción');
        await client.end();
    } catch (error) {
        console.error('\n✗ Error:', error.message);
        try { await client.end(); } catch {}
        process.exit(1);
    }
}

main();
