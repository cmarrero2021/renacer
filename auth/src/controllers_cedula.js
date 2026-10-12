const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { createWorker } = require('tesseract.js');

// Análisis anti-copia: color, contraste, nitidez y proporción de grises
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

  // Nitidez: varianza del Laplaciano (fotocopias salen borrosas)
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

  // Veredicto
  const reasons = [];

  if (grayscaleRatio > 0.97) {
    reasons.push('La imagen está en escala de grises (típico de fotocopia)');
  } else if (colorfulness < 8) {
    reasons.push('Color muy débil, posible fotocopia o escaneo B/N');
  }

  if (sharpness < 35) {
    reasons.push('Imagen borrosa (posible copia o fotografía de pantalla)');
  }

  if (contrast < 25) {
    reasons.push('Contraste bajo (típico de fotocopia)');
  }

  let label;
  if (reasons.length === 0) {
    label = 'ORIGINAL (a color)';
  } else if (grayscaleRatio > 0.98) {
    label = 'POSIBLE COPIA (sin color)';
  } else {
    label = 'NO DETERMINADO (revisar manualmente)';
  }

  return {
    colorfulness: Number(colorfulness.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    sharpness: Number(sharpness.toFixed(2)),
    grayscalePercent: Number((grayscaleRatio * 100).toFixed(1)),
    verdict: { label, reasons }
  };
};

const parseCedulaText = (text) => {
  const parsed = {
    cedula: '',
    apellidos: '',
    nombres: '',
    fechaNacimiento: '',
    lugarEmision: '',
    fechaEmision: '',
    fechaVencimiento: ''
  };

  const clean = text.replace(/\r/g, '');
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Número de cédula: V-12345678 / V12345678
  const mCed = clean.match(/\b[VJE]\s*[-.]?\s*(\d{5,8})\b/);
  if (mCed) parsed.cedula = mCed[0].replace(/[\s.]/g, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (!parsed.apellidos && /APELLIDOS/.test(upper)) {
      const after = line.replace(/^.*?APELLIDOS\s*:?\s*/i, '').trim();
      parsed.apellidos = after || (lines[i + 1] || '').trim();
    }
    if (!parsed.nombres && /NOMBRES/.test(upper) && !/APELLIDOS/.test(upper)) {
      const after = line.replace(/^.*?NOMBRES\s*:?\s*/i, '').trim();
      parsed.nombres = after || (lines[i + 1] || '').trim();
    }
    if (!parsed.fechaNacimiento && /NACIMIENTO/.test(upper)) {
      const m = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (m) parsed.fechaNacimiento = m[1];
    }
    if (!parsed.fechaEmision && /FECHA\s+DE\s+EMISI/i.test(upper)) {
      const m = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m) parsed.fechaEmision = m[1];
    }
    if (!parsed.fechaVencimiento && /VENCIMIENTO/i.test(upper)) {
      const m = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m) parsed.fechaVencimiento = m[1];
    }
    if (!parsed.lugarEmision && /LUGAR\s+DE\s+EMISI/i.test(upper)) {
      const after = line.replace(/^.*?EMISI[OÓ]N\s*:?\s*/i, '').trim();
      if (after) parsed.lugarEmision = after;
    }
  }

  return parsed;
};

const readCedula = async (req, res) => {
  try {
    const cedulaPath = path.join(__dirname, '..', '..', 'cedula');

    const files = fs.readdirSync(cedulaPath).filter(f => /\.(png|jpe?g)$/i.test(f));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No se encontró imagen de cédula (.png/.jpg/.jpeg) en la carpeta cedula/' });
    }

    const imgPath = path.join(cedulaPath, files[0]);
    const imageBuffer = fs.readFileSync(imgPath);

    // ─── Análisis anti-copia ───
    const image = await Jimp.read(imageBuffer);
    const metrics = analyzeImage(image);

    // ─── OCR (datos de idioma cacheados en la carpeta temporal del sistema) ───
    const worker = await createWorker('spa', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    const fields = parseCedulaText(text);

    res.json({
      success: true,
      filename: files[0],
      data: { ...fields, rawText: text.trim() },
      antiCopy: metrics
    });
  } catch (error) {
    console.error('Error al leer cédula:', error);
    res.status(500).json({ error: 'Error al procesar la imagen de la cédula' });
  }
};

module.exports = { readCedula };