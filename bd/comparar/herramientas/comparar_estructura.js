// Comparador de estructura DEV vs PROD a partir de los dumps pg_dump.
// Uso:  node bd/comparar/herramientas/comparar_estructura.js
//       (desde la raíz del repo o desde cualquier carpeta; usa rutas relativas a este archivo)
//
// - Excluye las tablas de usuarios/seguridad (ver lista EXCLUIR).
// - Genera bd/comparar/diff_resultado.json con el detalle completo.
// - Tras aplicar una migración a PROD, regenera el dump de PROD como
//   bd/comparar/renacer.sql y re-ejecuta este script para confirmar diff = 0.
const fs = require('fs');
const path = require('path');
const { parseDump } = require('./parser.js');

const BASE = path.join(__dirname, '..'); // bd/comparar/
const ARCHIVO_DEV = path.join(BASE, 'renacer_dev.sql');
const ARCHIVO_PROD = path.join(BASE, 'renacer.sql');

const EXCLUIR = new Set([
    // Usuarios y seguridad
    'users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'user_permissions',
    'blacklisted_tokens', 'password_resets', 'email_verifications', 'two_factor_codes',
    'login_logs', 'sessions', 'session_settings', 'password_history',
    // Flujo de registro de usuarios (acordado excluirlo)
    'registro_verificaciones',
    // Menús por rol y utilidades de usuario
    'menu_items', 'menu_categories', 'saved_queries', 'saved_query_access',
    // Sistema/auditoría
    'audit_logs', 'maintenance_purge_logs'
]);

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const dev = parseDump(ARCHIVO_DEV);
const prod = parseDump(ARCHIVO_PROD);

const diff = {
    tablasSoloDev: [], tablasSoloProd: [],
    colsFaltanProd: [], colsFaltanDev: [], colsDistintas: [],
    consFaltanProd: [], consDistintos: [], consSoloProd: [],
    idxSoloDev: [], idxSoloProd: [],
    seqSoloDev: [], seqSoloProd: [],
    alterSoloDev: [], alterSoloProd: [],
    funcSoloDev: [], funcSoloProd: [],
    trigSoloDev: [], trigSoloProd: []
};

const tablasDev = Object.keys(dev.tables).filter(t => !EXCLUIR.has(t));
const tablasProd = Object.keys(prod.tables).filter(t => !EXCLUIR.has(t));

diff.tablasSoloDev = tablasDev.filter(t => !prod.tables[t]);
diff.tablasSoloProd = tablasProd.filter(t => !dev.tables[t]);

for (const t of tablasDev) {
    if (!prod.tables[t]) continue;
    const D = dev.tables[t], P = prod.tables[t];
    const faltanProd = Object.keys(D.columnas).filter(c => !P.columnas[c]);
    if (faltanProd.length) diff.colsFaltanProd.push({ tabla: t, cols: faltanProd.map(c => ({ col: c, ...D.columnas[c] })) });
    const faltanDev = Object.keys(P.columnas).filter(c => !D.columnas[c]);
    if (faltanDev.length) diff.colsFaltanDev.push({ tabla: t, cols: faltanDev });
    for (const c of Object.keys(D.columnas)) {
        const b = P.columnas[c];
        if (!b) continue;
        const a = D.columnas[c];
        if (norm(a.tipo) !== norm(b.tipo) || !!a.notNull !== !!b.notNull || norm(a.default) !== norm(b.default)) {
            diff.colsDistintas.push({ tabla: t, col: c, dev: a, prod: b });
        }
    }
}

const consDev = new Map(), consProd = new Map();
for (const t of tablasDev)
    for (const [n, c] of Object.entries(dev.tables[t].constraints))
        if (!consDev.has(t + '.' + n)) consDev.set(t + '.' + n, { tabla: t, nombre: n, tipo: c.tipo, def: c.def });
for (const c of dev.constraints) if (!consDev.has(c.tabla + '.' + c.nombre)) consDev.set(c.tabla + '.' + c.nombre, c);
for (const t of tablasProd)
    for (const [n, c] of Object.entries(prod.tables[t].constraints))
        if (!consProd.has(t + '.' + n)) consProd.set(t + '.' + n, { tabla: t, nombre: n, tipo: c.tipo, def: c.def });
for (const c of prod.constraints) if (!consProd.has(c.tabla + '.' + c.nombre)) consProd.set(c.tabla + '.' + c.nombre, c);

for (const [k, c] of consDev) {
    const p = consProd.get(k);
    if (!p) diff.consFaltanProd.push(c);
    else if (c.tipo !== p.tipo || norm(c.def) !== norm(p.def)) diff.consDistintos.push({ dev: c, prod: p });
}
for (const [k, c] of consProd) if (!consDev.has(k)) diff.consSoloProd.push(c);

function idxNombre(s) {
    const n = s.match(/^(\w+)\s+ON\s/i);
    return n ? n[1] : s.slice(0, 60);
}
const idxDev = new Map(dev.indexes.map(s => [idxNombre(s), s]));
const idxProd = new Map(prod.indexes.map(s => [idxNombre(s), s]));
for (const [k, s] of idxDev) if (!idxProd.has(k)) diff.idxSoloDev.push({ nombre: k, def: s });
for (const [k, s] of idxProd) if (!idxDev.has(k)) diff.idxSoloProd.push({ nombre: k, def: s });

const sDev = new Set(dev.sequences), sProd = new Set(prod.sequences);
diff.seqSoloDev = dev.sequences.filter(s => !sProd.has(s));
diff.seqSoloProd = prod.sequences.filter(s => !sDev.has(s));

const devAlt = new Set(dev.alters.map(a => `${a.tabla}.${a.col}.${a.accion}`));
const prodAlt = new Set(prod.alters.map(a => `${a.tabla}.${a.col}.${a.accion}`));
diff.alterSoloDev = dev.alters.filter(a => !EXCLUIR.has(a.tabla) && !prodAlt.has(`${a.tabla}.${a.col}.${a.accion}`));
diff.alterSoloProd = prod.alters.filter(a => !EXCLUIR.has(a.tabla) && !devAlt.has(`${a.tabla}.${a.col}.${a.accion}`));

const fDev = new Set(dev.funciones), fProd = new Set(prod.funciones);
diff.funcSoloDev = dev.funciones.filter(f => !fProd.has(f));
diff.funcSoloProd = prod.funciones.filter(f => !fDev.has(f));
const tDev = new Map(dev.triggers.map(t => [t.tabla + '.' + t.nombre, t]));
const tProd = new Map(prod.triggers.map(t => [t.tabla + '.' + t.nombre, t]));
for (const [k, t] of tDev) if (!tProd.has(k) && !EXCLUIR.has(t.tabla)) diff.trigSoloDev.push(t);
for (const [k, t] of tProd) if (!tDev.has(k) && !EXCLUIR.has(t.tabla)) diff.trigSoloProd.push(t);

console.log('=== RESUMEN (excluyendo tablas de usuarios) ===');
console.log('Tablas comunes:', tablasDev.filter(t => prod.tables[t]).length);
console.log('Tablas solo en DEV :', diff.tablasSoloDev.length, JSON.stringify(diff.tablasSoloDev));
console.log('Tablas solo en PROD:', diff.tablasSoloProd.length, JSON.stringify(diff.tablasSoloProd));
console.log('Columnas faltantes en PROD:', diff.colsFaltanProd.reduce((a, x) => a + x.cols.length, 0));
console.log('Columnas faltantes en DEV :', diff.colsFaltanDev.reduce((a, x) => a + x.cols.length, 0));
console.log('Columnas con definición distinta:', diff.colsDistintas.length);
console.log('Constraints solo en DEV:', diff.consFaltanProd.length, '| distintos:', diff.consDistintos.length, '| solo en PROD:', diff.consSoloProd.length);
console.log('Índices solo en DEV:', diff.idxSoloDev.length, '| solo en PROD:', diff.idxSoloProd.length);
console.log('Funciones/triggers divergentes:', diff.funcSoloDev.length + diff.funcSoloProd.length + diff.trigSoloDev.length + diff.trigSoloProd.length);

const total = diff.tablasSoloDev.length + diff.tablasSoloProd.length
    + diff.colsFaltanProd.reduce((a, x) => a + x.cols.length, 0)
    + diff.colsFaltanDev.reduce((a, x) => a + x.cols.length, 0)
    + diff.colsDistintas.length + diff.consFaltanProd.length + diff.consDistintos.length
    + diff.consSoloProd.length + diff.idxSoloDev.length + diff.idxSoloProd.length;
console.log(totalDiferencias(total));

function totalDiferencias(n) { return 'Total de diferencias de estructura: ' + n; }

const salida = path.join(__dirname, 'diff_resultado.json');
fs.writeFileSync(salida, JSON.stringify(diff, null, 2), 'utf8');
console.log('Detalle en', salida);
