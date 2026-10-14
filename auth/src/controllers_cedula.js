const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { createWorker } = require('tesseract.js');

// ─── Análisis anti-copia: color, contraste, nitidez y proporcion de grises ───
const analyzeImage = (image) => {
  const { width, height, data } = image.bitmap;
  const n = width * height;

  let rgSum = 0, rgSq = 0, ybSum = 0, ybSq = 0;
  let lumSum = 0, lumSq = 0;
  let grayPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg; rgSq += rg * rg;
    ybSum += yb; ybSq += yb * yb;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lumSum += lum; lumSq += lum * lum;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 12) grayPixels++;
  }

  const rgMean = rgSum / n, ybMean = ybSum / n;
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean * rgMean));
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean * ybMean));
  const colorfulness = Math.sqrt(rgStd * rgStd + ybStd * ybStd)
    + 0.3 * Math.sqrt(rgMean * rgMean + ybMean * ybMean);

  const lumMean = lumSum / n;
  const contrast = Math.sqrt(Math.max(lumSq / n - lumMean * lumMean, 0));
  const grayscaleRatio = grayPixels / n;

  const gray = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let lapSum = 0, lapSq = 0, lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap = 4 * gray[idx]
        - gray[(y - 1) * width + x] - gray[(y + 1) * width + x]
        - gray[y * width + x - 1] - gray[y * width + x + 1];
      lapSum += lap;
      lapSq += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapSum / lapCount;
  const sharpness = Math.sqrt(Math.max(lapSq / lapCount - lapMean * lapMean, 0));

  const reasons = [];
  if (grayscaleRatio > 0.97) {
    reasons.push('La imagen esta en escala de grises (tipico de fotocopia)');
  } else if (colorfulness < 8) {
    reasons.push('Color muy debil, posible fotocopia o escaneo B/N');
  }
  if (sharpness < 35) reasons.push('Imagen borrosa (posible copia o fotografia de pantalla)');
  if (contrast < 25) reasons.push('Contraste bajo (tipico de fotocopia)');

  let label;
  if (reasons.length === 0) label = 'ORIGINAL (a color)';
  else if (grayscaleRatio > 0.98) label = 'POSIBLE COPIA (sin color)';
  else label = 'NO DETERMINADO (revisar manualmente)';

  return {
    colorfulness: Number(colorfulness.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    sharpness: Number(sharpness.toFixed(2)),
    grayscalePercent: Number((grayscaleRatio * 100).toFixed(1)),
    verdict: { label, reasons }
  };
};

// ─── Preprocesa imagen para mejorar OCR ───
const preprocesarImagen = async (imageBuffer) => {
  try {
    const img = await Jimp.read(imageBuffer);
    const { width } = img.bitmap;
    if (width < 3000) img.scale(3000 / width);
    img.greyscale().normalize().contrast(0.25);
    return await img.getBufferAsync(Jimp.MIME_PNG);
  } catch {
    return imageBuffer;
  }
};

// ─── Distancia de Levenshtein (para tolerar etiquetas mal leidas por el OCR) ───
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

// Normaliza un token: mayusculas, sin acentos, solo A-Z
const normalizeToken = (t) =>
  t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');

// Umbral de distancia segun longitud de la etiqueta
const fuzzyThreshold = (len) => (len <= 5 ? 1 : len <= 8 ? 2 : 3);

// ¿El token se parece a la etiqueta? (etiqueta con ruido OCR: "APELUIDOS" ≈ "APELLIDOS")
const fuzzyEq = (token, label) => {
  const t = normalizeToken(token);
  if (!t || Math.abs(t.length - label.length) > 3) return false;
  return levenshtein(t, label) <= fuzzyThreshold(label.length);
};

// ─── Extrae datos de la cedula venezolana del texto OCR ───
const parseCedulaText = (rawText) => {
  const parsed = {
    cedula: '', apellidos: '', nombres: '',
    fechaNacimiento: '', estadoCivil: '', fechaExpedicion: '',
    fechaVencimiento: '', nacionalidad: ''
  };

  if (!rawText) return parsed;

  const text = rawText.replace(/\r/g, '');
  const upper = text.toUpperCase();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Numero de cedula
  const mCed = upper.match(/\b([VJE])\s*[-.,|]?\s*(\d[\d.]{4,11})/);
  if (mCed) parsed.cedula = `${mCed[1]}-${mCed[2].replace(/[.]/g, '')}`;

  // Solo tokens en MAYUSCULAS son valores validos (descarta "Gustavo Vizcaino" del firmante)
  const NOISE = new Set(['FIRMA', 'TITULAR', 'REPUBLICA', 'BOLIVARIANA', 'VENEZUELA',
    'CEDULA', 'IDENTIDAD', 'DIRECTOR', 'SOLTERO', 'SOLTERA', 'CASADO', 'CASADA',
    'VENEZOLANO', 'VENEZOLANA', 'EXTRANJERO', 'EXTRANJERA', 'FECHA', 'NUMERO', 'NUM']);
  const isCapsValue = (tok) => {
    const stripped = tok.replace(/[.,;:|"'!¿?]/g, '').trim();
    if (stripped.length < 3) return false;
    if (NOISE.has(normalizeToken(stripped))) return false;
    return /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]*$/.test(stripped);
  };

  // Extrae valor de un campo con etiqueta fuzzy (busca etiqueta + valor en mayusculas)
  const extractNameField = (label) => {
    for (let i = 0; i < lines.length; i++) {
      const tokens = lines[i].split(/\s+/);
      for (let j = 0; j < tokens.length; j++) {
        if (!fuzzyEq(tokens[j], label)) continue;
        const rest = tokens.slice(j + 1)
          .filter(t => isCapsValue(t))
          .join(' ').replace(/\s+/g, ' ').trim();
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

  // Fechas: en la cedula la fecha aparece ENCIMA de la etiqueta
  const reFecha = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
  const reMesAnio = /\b(\d{2}\/\d{4})\b/g;
  const foundDates = [];
  let fm;
  while ((fm = reFecha.exec(upper)) !== null) {
    foundDates.push({ valor: fm[1], pos: fm.index, len: fm[1].length, soloMesAnio: false });
  }
  while ((fm = reMesAnio.exec(upper)) !== null) {
    const solapa = foundDates.some(d => fm.index >= d.pos - 1 && fm.index <= d.pos + d.len);
    if (!solapa) foundDates.push({ valor: fm[1], pos: fm.index, len: fm[1].length, soloMesAnio: true });
  }
  foundDates.sort((a, b) => a.pos - b.pos);

  // Posiciones de etiquetas de fecha (fuzzy)
  const labelsFecha = [
    { key: 'fechaNacimiento', word: 'NACIMIENTO' },
    { key: 'fechaExpedicion', word: 'EXPEDICION' },
    { key: 'fechaVencimiento', word: 'VENCIMIENTO' }
  ];
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
        // monotonia: la fecha de cada etiqueta va DESPUES de la de la etiqueta anterior
        if (lastUsedPos >= 0 && d.pos <= lastUsedPos) continue;
        // la mas ANTIGUA no usada: en la linea "10/02/2023 — 02/2033" sobre las
        // etiquetas "F. EXPEDICION  F. VENCIMIENTO", la primera fecha es la expedicion
        if (!best || d.pos < best.pos) best = d;
      }
    }
    if (best) { parsed[lp.key] = best.valor; usedDates.add(best); lastUsedPos = best.pos; }
  }

  // Fallback: fechas en orden de aparicion. Solo si hay 3 fechas completas
  // (d/m/a) hay evidencia de que siguen el orden nacimiento/expedicion/vencimiento;
  // con menos fechas, asignar la primera podria poner la expedicion como nacimiento
  const fechasCompletas = foundDates.filter(d => !d.soloMesAnio);
  if (!parsed.fechaNacimiento && fechasCompletas.length >= 3) parsed.fechaNacimiento = fechasCompletas[0].valor;
  if (!parsed.fechaExpedicion && fechasCompletas.length >= 3) parsed.fechaExpedicion = fechasCompletas[1].valor;
  if (!parsed.fechaVencimiento) {
    const mv = foundDates.find(d => d.soloMesAnio);
    if (mv) parsed.fechaVencimiento = mv.valor;
    else if (foundDates[2]) parsed.fechaVencimiento = foundDates[2].valor;
  }

  // Estado civil
  const estadosCiviles = [
    ['SOLTER', 'Soltero', 'Soltera'], ['CASAD', 'Casado', 'Casada'],
    ['DIVORCI', 'Divorciado', 'Divorciada'], ['VIUD', 'Viudo', 'Viuda']
  ];
  for (const [key, masc, fem] of estadosCiviles) {
    if (upper.includes(key)) {
      parsed.estadoCivil = upper.includes(fem) ? fem : masc;
      break;
    }
  }

  // Nacionalidad
  if (/VENEZOLAN[OA]/.test(upper)) {
    parsed.nacionalidad = upper.includes('VENEZOLANA') ? 'VENEZOLANA' : 'VENEZOLANO';
  } else if (/EXTRANJER[OA]/.test(upper)) {
    parsed.nacionalidad = upper.includes('EXTRANJERA') ? 'EXTRANJERA' : 'EXTRANJERO';
  }

  return parsed;
};

// ─── Merge de resultados de multiples pasadas de OCR ───
const mergeResults = (results) => {
  const merged = { cedula: '', apellidos: '', nombres: '', fechaNacimiento: '',
    estadoCivil: '', fechaExpedicion: '', fechaVencimiento: '', nacionalidad: '' };

  for (const r of results) {
    for (const k of Object.keys(merged)) {
      if (!merged[k] && r[k]) merged[k] = r[k];
    }
  }
  return merged;
};

// ─── Ejecuta una pasada de OCR ───
const runOcr = async (imageBuffer, preproc, psm) => {
  const data = preproc ? await preprocesarImagen(imageBuffer) : imageBuffer;
  const worker = await createWorker('spa', 1, { logger: () => {} });
  if (psm) await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  const { data: { text } } = await worker.recognize(data);
  await worker.terminate();
  return text;
};

const readCedula = async (req, res) => {
  try {
    const cedulaPath = path.join(__dirname, '..', '..', 'cedula');

    const files = fs.readdirSync(cedulaPath).filter(f => /\.(png|jpe?g)$/i.test(f));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No se encontro imagen de cedula (.png/.jpg/.jpeg) en la carpeta cedula/' });
    }

    const imgPath = path.join(cedulaPath, files[0]);
    const imageBuffer = fs.readFileSync(imgPath);

    // Analisis anti-copia
    const image = await Jimp.read(imageBuffer);
    const metrics = analyzeImage(image);

    // OCR multi-pasada: combina resultados de diferentes configuraciones para
    // maximizar la extraction de datos (en pruebas, ninguna configuracion sola
    // extrae todos los campos correctamente; el merge cubre los huecos)
    const rawTexts = await Promise.all([
      runOcr(imageBuffer, true,  4),   // preprocesada + PSM 4 (lineas de texto)
      runOcr(imageBuffer, true,  3),   // preprocesada + PSM 3 (auto-deteccion)
      runOcr(imageBuffer, false, 3),   // original + PSM 3
      runOcr(imageBuffer, false, 6),   // original + PSM 6 (orientacion uniforme)
    ]);

    const results = rawTexts.map(t => parseCedulaText(t));
    const fields  = mergeResults(results);

    res.json({
      success: true,
      filename: files[0],
      data: { ...fields, rawText: rawTexts[0].trim() },
      antiCopy: metrics
    });
  } catch (error) {
    console.error('Error al leer cedula:', error);
    res.status(500).json({ error: 'Error al procesar la imagen de la cedula' });
  }
};

module.exports = { readCedula };