// Parser de dumps pg_dump: extrae estructura por tabla (DEV vs PROD).
const fs = require('fs');

function parseDump(file) {
    const txt = fs.readFileSync(file, 'utf8');
    const db = { tables: {}, constraints: [], indexes: [], sequences: [], funciones: [], triggers: [] };
    let m;

    // CREATE TABLE (definiciones separadas por comas top-level)
    const re = /CREATE TABLE (public\.\w+) \(\r?\n([\s\S]*?)\r?\n\);/g;
    while ((m = re.exec(txt)) !== null) {
        const nombre = m[1].replace('public.', '');
        const tabla = { columnas: {}, constraints: {} };
        db.tables[nombre] = tabla;
        let depth = 0, cur = '';
        const partes = [];
        for (const ch of m[2]) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === ',' && depth === 0) { partes.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        if (cur.trim()) partes.push(cur.trim());
        for (const parte of partes) {
            if (parte.startsWith('CONSTRAINT ')) {
                const cm = parte.match(/CONSTRAINT (\w+) (PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)\s*([\s\S]*)/i);
                if (cm) tabla.constraints[cm[1]] = { tipo: cm[2].toUpperCase(), def: cm[3].replace(/\s+/g, ' ').trim() };
            } else {
                const cs = parte.match(/^(\w+)\s+([\s\S]+)$/);
                if (cs) tabla.columnas[cs[1]] = colInfo(cs[2]);
            }
        }
    }

    // ALTER TABLE ONLY ... ADD CONSTRAINT
    const reC = /ALTER TABLE ONLY public\.(\w+)\s*\r?\n?\s*ADD CONSTRAINT (\w+) ([^;]+);/g;
    while ((m = reC.exec(txt)) !== null) {
        const t = m[1];
        if (!db.tables[t]) continue;
        db.constraints.push({ tabla: t, nombre: m[2], def: m[3].replace(/\s+/g, ' ').trim() });
    }

    // ALTER TABLE ... ALTER COLUMN ... SET DEFAULT / SET NOT NULL / DROP DEFAULT
    const reD = /ALTER TABLE ONLY public\.(\w+)\s*ALTER COLUMN (\w+) (SET DEFAULT [^;]+|SET NOT NULL|DROP DEFAULT);/g;
    db.alters = [];
    while ((m = reD.exec(txt)) !== null) {
        db.alters.push({ tabla: m[1], col: m[2], accion: m[3].replace(/\s+/g, ' ').trim() });
    }

    // CREATE [UNIQUE] INDEX (sentencia completa normalizada)
    const reI = /CREATE (UNIQUE )?INDEX [^;\r\n]+(?:\r?\n[^;]+?)*;/g;
    while ((m = reI.exec(txt)) !== null) {
        db.indexes.push(m[0].replace(/CREATE (?:UNIQUE )?INDEX /, '').replace(/\s+/g, ' ').replace(/;$/, '').trim());
    }

    // CREATE SEQUENCE
    const reS = /CREATE SEQUENCE public\.(\w+)/g;
    while ((m = reS.exec(txt)) !== null) db.sequences.push(m[1]);

    // CREATE FUNCTION (solo nombre para reporte) y TRIGGER
    const reF = /CREATE (OR REPLACE )?FUNCTION public\.(\w+)/g;
    while ((m = reF.exec(txt)) !== null) db.funciones.push(m[2]);
    const reT = /CREATE TRIGGER (\w+)[\s\S]*?ON (?:ONLY )?public\.(\w+)/g;
    while ((m = reT.exec(txt)) !== null) db.triggers.push({ tabla: m[2], nombre: m[1] });

    return db;
}

function colInfo(def) {
    const notNull = /\bNOT NULL\b/i.test(def);
    const dm = def.match(/\bDEFAULT\s+([\s\S]*?)(?=\s+COLLATE\s|\s+GENERATED\s|\s+NOT NULL\b|$)/i);
    const deflt = dm ? dm[1].trim() : null;
    const tipo = def
        .replace(/\s+DEFAULT\s+[\s\S]*$/i, '')
        .replace(/\s+COLLATE\s+\S+/gi, '')
        .replace(/\s+NOT NULL/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    return { tipo, notNull, default: deflt === null ? null : deflt.replace(/\s+/g, ' ') };
}

module.exports = { parseDump };
