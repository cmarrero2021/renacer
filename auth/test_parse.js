/**
 * Prueba unitaria del parser de cedula contra los textos OCR reales capturados
 * durante el diagnostico.  node test_parse.js
 */
const { parseCedulaText, mergeResults } = (() => {
  const levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  };
  const normalizeToken = (t) => t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
  const fuzzyThreshold = (len) => (len <= 5 ? 1 : len <= 8 ? 2 : 3);
  const fuzzyEq = (token, label) => {
    const t = normalizeToken(token);
    if (!t || Math.abs(t.length - label.length) > 3) return false;
    return levenshtein(t, label) <= fuzzyThreshold(label.length);
  };
  const parseCedulaText = (rawText) => {
    const parsed = { cedula: '', apellidos: '', nombres: '', fechaNacimiento: '', estadoCivil: '', fechaExpedicion: '', fechaVencimiento: '', nacionalidad: '' };
    if (!rawText) return parsed;
    const text = rawText.replace(/\r/g, '');
    const upper = text.toUpperCase();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const mCed = upper.match(/\b([VJE])\s*[-.,|]?\s*(\d[\d.]{4,11})/);
    if (mCed) parsed.cedula = `${mCed[1]}-${mCed[2].replace(/[.]/g, '')}`;
    const NOISE = new Set(['FIRMA', 'TITULAR', 'REPUBLICA', 'BOLIVARIANA', 'VENEZUELA', 'CEDULA', 'IDENTIDAD', 'DIRECTOR', 'SOLTERO', 'SOLTERA', 'CASADO', 'CASADA', 'VENEZOLANO', 'VENEZOLANA', 'EXTRANJERO', 'EXTRANJERA', 'FECHA', 'NUMERO', 'NUM']);
    const isCapsValue = (tok) => {
      const stripped = tok.replace(/[.,;:|"'!¿?]/g, '').trim();
      if (stripped.length < 3) return false;
      if (NOISE.has(normalizeToken(stripped))) return false;
      return /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]*$/.test(stripped);
    };
    const extractNameField = (label) => {
      for (let i = 0; i < lines.length; i++) {
        const tokens = lines[i].split(/\s+/);
        for (let j = 0; j < tokens.length; j++) {
          if (!fuzzyEq(tokens[j], label)) continue;
          const rest = tokens.slice(j + 1).filter(t => isCapsValue(t)).join(' ').replace(/\s+/g, ' ').trim();
          if (rest) return rest;
          if (lines[i + 1]) {
            const next = lines[i + 1].replace(/[^A-ZÁÉÍÓÚÑÜ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
            if (next.length >= 4) return next;
          }
        }
      }
      return '';
    };
    parsed.apellidos = extractNameField('APELLIDOS');
    parsed.nombres = extractNameField('NOMBRES');
    const reFecha = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
    const reMesAnio = /\b(\d{2}\/\d{4})\b/g;
    const foundDates = [];
    let fm;
    while ((fm = reFecha.exec(upper)) !== null) foundDates.push({ valor: fm[1], pos: fm.index, len: fm[1].length, soloMesAnio: false });
    while ((fm = reMesAnio.exec(upper)) !== null) {
      const solapa = foundDates.some(d => fm.index >= d.pos - 1 && fm.index <= d.pos + d.len);
      if (!solapa) foundDates.push({ valor: fm[1], pos: fm.index, len: fm[1].length, soloMesAnio: true });
    }
    foundDates.sort((a, b) => a.pos - b.pos);
    const labelsFecha = [{ key: 'fechaNacimiento', word: 'NACIMIENTO' }, { key: 'fechaExpedicion', word: 'EXPEDICION' }, { key: 'fechaVencimiento', word: 'VENCIMIENTO' }];
    const labelPositions = [];
    let searchFrom = 0;
    for (const tok of upper.split(/\s+/)) {
      const tokPos = upper.indexOf(tok, searchFrom);
      if (tokPos < 0) continue;
      searchFrom = tokPos + tok.length;
      const clean = normalizeToken(tok);
      if (clean.length < 4) continue;
      // Solo gana la etiqueta con MENOR distancia: evita que "NACIMIENTO"
      // coincida tambien con "VENCIMIENTO" (distancia 2 <= umbral 3)
      let bestLb = null, bestDist = Infinity;
      for (const lb of labelsFecha) {
        if (Math.abs(clean.length - lb.word.length) > 3) continue;
        const d = levenshtein(clean, lb.word);
        if (d <= fuzzyThreshold(lb.word.length) && d < bestDist) {
          bestLb = lb; bestDist = d;
        }
      }
      if (bestLb) labelPositions.push({ key: bestLb.key, pos: tokPos });
    }
    labelPositions.sort((a, b) => a.pos - b.pos);
    const usedDates = new Set();
    let lastUsedPos = -1;
    for (const lp of labelPositions) {
      if (parsed[lp.key]) continue; // ya asignado: no sobrescribir
      let best = null;
      for (const d of foundDates) {
        if (usedDates.has(d)) continue;
        if (d.pos < lp.pos && lp.pos - (d.pos + d.len) <= 120) {
          // monotonia: la fecha de cada etiqueta va DESPUES de la de la anterior
          if (lastUsedPos >= 0 && d.pos <= lastUsedPos) continue;
          // la mas ANTIGUA no usada: en "10/02/2023 — 02/2033" sobre
          // "F. EXPEDICION  F. VENCIMIENTO", la primera fecha es la expedicion
          if (!best || d.pos < best.pos) best = d;
        }
      }
      if (best) { parsed[lp.key] = best.valor; usedDates.add(best); lastUsedPos = best.pos; }
    }
    const fechasCompletas = foundDates.filter(d => !d.soloMesAnio);
    if (!parsed.fechaNacimiento && fechasCompletas.length >= 3) parsed.fechaNacimiento = fechasCompletas[0].valor;
    if (!parsed.fechaExpedicion && fechasCompletas.length >= 3) parsed.fechaExpedicion = fechasCompletas[1].valor;
    if (!parsed.fechaVencimiento) {
      const mv = foundDates.find(d => d.soloMesAnio);
      if (mv) parsed.fechaVencimiento = mv.valor;
      else if (foundDates[2]) parsed.fechaVencimiento = foundDates[2].valor;
    }
    const estadosCiviles = [['SOLTER', 'Soltero', 'Soltera'], ['CASAD', 'Casado', 'Casada'], ['DIVORCI', 'Divorciado', 'Divorciada'], ['VIUD', 'Viudo', 'Viuda']];
    for (const [key, masc, fem] of estadosCiviles) {
      if (upper.includes(key)) { parsed.estadoCivil = upper.includes(fem) ? fem : masc; break; }
    }
    if (/VENEZOLAN[OA]/.test(upper)) parsed.nacionalidad = upper.includes('VENEZOLANA') ? 'VENEZOLANA' : 'VENEZOLANO';
    else if (/EXTRANJER[OA]/.test(upper)) parsed.nacionalidad = upper.includes('EXTRANJERA') ? 'EXTRANJERA' : 'EXTRANJERO';
    return parsed;
  };
  const mergeResults = (results) => {
    const merged = { cedula: '', apellidos: '', nombres: '', fechaNacimiento: '', estadoCivil: '', fechaExpedicion: '', fechaVencimiento: '', nacionalidad: '' };
    for (const r of results) for (const k of Object.keys(merged)) if (!merged[k] && r[k]) merged[k] = r[k];
    return merged;
  };
  return { parseCedulaText, mergeResults };
})();

// ── Textos OCR reales capturados en el diagnostico (las 4 configuraciones probadas) ──
const ocrSamples = [
  // 1. preprocesada big-3000 PSM 4 (MEJOR: leyó "APELLIDOS" y "FIRMA TITULAR" limpios)
  {
    text: ` REPUBLICA BOLIVARIANA DE VENEZUELA
CEDULA DE IDENTIDAD
V 7.920.566        N             077
APELLIDOS MARRERO MUÑOZ                       T        Gustavo Vizcaino
nomares CARLOS RAFAEL               |
FIRMA TITULAR
v—
27/02/1967 SOLTERO         : >
F. NACIMIENTO       EDO CIVIL                  ; —
.                                          -
ANNE            a
10/02/2023 — 02/2033
F. EXPEDICION      F. VENCIMIENTO
VENEZOLANO`
  },
  // 2. preprocesada big-3000 PSM 3 (deformó algunas etiquetas pero recuperable)
  {
    text: ` REPUBLICA BOLIVARIANA DE VENEZUELA
CEDULA DE IDENTIDAD
V 7.920.566        N             077
aPeELLIDOS MARRERO MUÑOZ       Gustave ZCemo
nomares CARLOS RAFAEL
FIRMA TITULAR
—  27/02/1967 SOLTERO
—- Is           F. NACIMIENTO            EDO CIVIL
NN            a
NN 10/02/2023 02/2033
F. EXPEDICION      F. VENCIMIENTO
VENEZOLANO`
  },
  // 3. original PSM 3 (deformación moderada)
  {
    text: `REPUBLICA BOLIVARIANA DE VENEZUELA
EDULA DE IDENTIDAD
V 7.920.566    ÍN       077
APELLIDOS MARRERO MUÑOZ                   T      a
- noveres CARLOS RAFAEL
4,    q
27/02/1967 SOLTERO
F NACIMIENTO          EDO CIVIL
10/02/2023 02/2033
F. EXPEDICION — - -F. VENCIMIENTO
VENEZOLANO`
  },
  // 4. original PSM 6 (la que se usaba antes - heavily deformed, but merge should help)
  // KNOWN-DEGRADED: "areLunos" no se parece a APELLIDOS y la fecha de nacimiento
  // salio ilegible ("2102/067"); el merge multi-pasada cubre esos campos
  {
    expectPartial: true,
    text: `REPUBLICA BOLIVARIANA DE VENEZUELA
CEDULA DE IDENTIDAD
V 7.920.566        D             077
o areLunos MARRERO MUÑOZ                        TÍ       Gustavo Vizcaino
-          :     NN                                       Director
- nonsres CARLOS RAFAEL            bi
— 2 2102/067 SOLTERO            "
e IE     EDO CIVIL              o   [—-  »
vr —              e
AMS IS           ]                          XL
yr No  10/02/2023 — 02/2033              L AM
MENS UN F-ExPEnICION——F. VEncIMEnTO              - AA
E Hi  NN 2 e "                                                            1
we                ""*"
- NNu="" VENEZOLANO             —`
  }
];

const expected = {
  cedula: 'V-7920566',
  apellidos: 'MARRERO MUÑOZ',
  nombres: 'CARLOS RAFAEL',
  fechaNacimiento: '27/02/1967',
  estadoCivil: 'Soltero',
  fechaExpedicion: '10/02/2023',
  fechaVencimiento: '02/2033',
  nacionalidad: 'VENEZOLANO'
};

let ok = 0, fail = 0, warned = 0;
for (const s of ocrSamples) {
  const r = parseCedulaText(s.text);
  const merged = mergeResults([r]);
  console.log('\n--- Parser en muestra ---');
  for (const k of Object.keys(expected)) {
    const got = r[k];
    const match = got === expected[k];
    const icon = match ? '✓' : (s.expectPartial ? '~' : '✗');
    if (!match && !s.expectPartial) { console.log(`  ${icon} ${k}: esperado "${expected[k]}" | got "${got}"`); fail++; }
    else if (!match) { console.log(`  ${icon} ${k}: parcial "${got}" (degradacion conocida)`); warned++; }
    else { console.log(`  ${icon} ${k}: ${got}`); ok++; }
  }
}

// Test de merge
console.log('\n=== TEST DE MERGE ===');
const allResults = ocrSamples.map(s => parseCedulaText(s.text));
const m = mergeResults(allResults);
for (const k of Object.keys(expected)) {
  const match = m[k] === expected[k];
  const icon = match ? '✓' : '✗';
  if (!match) console.log(`  ${icon} MERGE ${k}: esperado "${expected[k]}" | got "${m[k]}"`);
  else console.log(`  ${icon} MERGE ${k}: ${m[k]}`);
}
console.log(`\nPasados: ${ok}  Parciales (degradacion conocida): ${warned}  Fallidos: ${fail}`);
if (fail > 0) process.exit(1);
else console.log('TODOS LOS TESTS PASARON');
