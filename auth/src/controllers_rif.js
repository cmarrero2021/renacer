const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const Jimp = require('jimp');
const { createWorker } = require('tesseract.js');

const readRIF = async (req, res) => {
  try {
    const rifPath = path.join(__dirname, '..', '..', 'rif');

    const files = fs.readdirSync(rifPath).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No se encontró archivo RIF en la carpeta rif/' });
    }

    const pdfPath = path.join(rifPath, files[0]);
    const dataBuffer = fs.readFileSync(pdfPath);

    // ─── Intento 1: extracción de texto directo (PDF digital) ───
    let text = '';
    try {
      const parsed = await pdf(dataBuffer);
      text = parsed.text || '';
    } catch (e) {
      text = '';
    }

    let rifData = parseRifText(text);
    let metodo = 'texto';

    // ─── Intento 2: OCR página completa (PDF escaneado/imagen) ───
    if (!rifData.rif || !rifData.nombre) {
      const ocrText = await ocrPdfPage(dataBuffer, 2);
      if (ocrText) {
        const ocrData = parseRifText(ocrText);
        for (const k of Object.keys(rifData)) {
          if (!rifData[k] && ocrData[k]) rifData[k] = ocrData[k];
        }
        metodo = 'ocr';
      }
    }

    // ─── Intento 3: franjas a alta resolución para RIF + nombre multilínea ───
    if (!rifData.rif) {
      const band = await ocrRifBand(dataBuffer);
      if (band) {
        if (band.rif) rifData.rif = band.rif;
        if (band.nombre && !rifData.nombre) rifData.nombre = band.nombre;
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: rifData,
      filename: files[0],
      metodo
    });
  } catch (error) {
    console.error('Error al leer RIF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo RIF' });
  }
};

// ─── Renderiza una página del PDF a PNG ───
const renderPdfPage = async (pdfBuffer, pageNumber = 1, scale = 2) => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = require('@napi-rs/canvas');

  const doc = await getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0
  }).promise;

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;
  const pngBuffer = await canvas.encode('png');

  page.cleanup();
  await doc.destroy();

  return pngBuffer;
};

const ocrPdfPage = async (pdfBuffer, scale = 2) => {
  const pngBuffer = await renderPdfPage(pdfBuffer, 1, scale);
  const worker = await createWorker('spa', 1, { logger: () => {} });
  const { data: { text } } = await worker.recognize(pngBuffer);
  await worker.terminate();
  return text;
};

// ─── Busca la línea RIF + nombre recorriendo franjas a alta resolución ───
const ocrRifBand = async (pdfBuffer) => {
  const pngBuffer = await renderPdfPage(pdfBuffer, 1, 3);
  const image = await Jimp.read(pngBuffer);
  const { width, height } = image.bitmap;

  const worker = await createWorker('spa', 1, { logger: () => {} });
  let found = null;

  try {
    // Franjas de 12% de alto, con 5% de solapamiento
    for (let y = 0.08; y < 0.62; y += 0.05) {
      const y1 = Math.round(height * y);
      const y2 = Math.round(height * Math.min(y + 0.12, 1.0));
      const crop = image.clone().crop(0, y1, width, y2 - y1);
      const cropBuf = await crop.getBufferAsync(Jimp.MIME_PNG);
      const { data: { text } } = await worker.recognize(cropBuf);

      // Buscar RIF + recolectar líneas de nombre en el texto completo de la franja
      const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (let i = 0; i < allLines.length; i++) {
        const res = extractRifFromLine(allLines[i].toUpperCase());
        if (res) {
          const nameParts = [res.rest];
          // Recolectar líneas siguientes hasta NAME_STOP
          for (let j = i + 1; j < allLines.length; j++) {
            if (isNameContinuation(allLines[j])) nameParts.push(allLines[j].trim());
            else break;
          }
          found = {
            rif: res.rif,
            nombre: cleanNombre(nameParts.join(' '))
          };
          break;
        }
      }
      if (found && found.rif) break;
    }
  } finally {
    await worker.terminate();
  }

  return found;
};

const cleanNombre = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/\s*FECHA\s+DE\s+.*$/i, '')
    .replace(/[—–\-\s]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[^A-ZÁÉÍÓÚÑÜ&.\-\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

// Líneas que terminan el nombre (etiquetas del comprobante)
const NAME_STOP = /^\s*(DOMICILIO|FECHA|GERENCIA|N[°º*]\s|REGISTRO|\(ESTE|CONDICI|AGENTE|SERIAL|FIRMA|GEREN)/i;

const isNameContinuation = (line) => {
  const up = line.trim().toUpperCase();
  if (!up) return false;
  if (NAME_STOP.test(up)) return false;
  if (/\d{2}\/\d{2}\/\d{4}/.test(up)) return false;       // fechas
  if (/COMPROBANTE/.test(up)) return false;
  if (/\d{9,12}-[A-Z0-9]{2,6}/.test(up)) return false;    // serial
  return /[A-ZÁÉÍÓÚÑ&]/.test(up);
};

// Busca patrón RIF en una línea y devuelve {rif, rest}
// Exige que tras el número haya un nombre (letras) para no confundirlo
// con el N° de comprobante ni con el serial.
const extractRifFromLine = (line) => {
  let m = line.match(/\b([JVGEP])\s*[-.]?\s*(\d{9})\s+([A-Z][A-Z&.\s]{2,})/);
  if (m) {
    return { rif: `${m[1]}-${m[2]}`, rest: m[3] };
  }
  m = line.match(/\b([JVGEP])\s*[-.]?\s*(\d{7,8})\s*[-.]?\s*(\d)\s+([A-Z][A-Z&.\s]{2,})/);
  if (m) {
    return { rif: `${m[1]}-${m[2]}${m[3]}`, rest: m[4] };
  }
  return null;
};

const parseRifText = (text) => {
  const rifData = {
    comprobante: '',
    rif: '',
    nombre: '',
    domicilioFiscal: '',
    fechaInscripcion: '',
    fechaUltimaActualizacion: '',
    fechaVencimiento: '',
    serial: ''
  };

  if (!text) return rifData;

  // N° COMPROBANTE: 202406R0000064506550
  const mComp = text.match(/COMPROBANTE:\s*([A-Z0-9]+)/i);
  if (mComp) rifData.comprobante = mComp[1];

  // RIF + nombre multilínea
  const rifLineIdx = text.search(/^\s*[JVGEP]\s?-?\d{9}/m);
  if (rifLineIdx !== -1) {
    const mRif = text.slice(rifLineIdx).match(/^\s*([JVGEP])\s?-?(\d{9})\s+(.+)/m);
    if (mRif) {
      rifData.rif = `${mRif[1]}-${mRif[2]}`;
      const afterRif = mRif[3];
      const restText = text.slice(rifLineIdx + mRif[0].length);
      const allLines = [afterRif, ...restText.split('\n')];
      const nameParts = [afterRif];
      for (const ln of allLines.slice(1)) {
        if (isNameContinuation(ln)) nameParts.push(ln.trim());
        else break;
      }
      rifData.nombre = cleanNombre(nameParts.join(' '));
    }
  }

  // Domicilio fiscal: desde "DOMICILIO FISCAL" hasta "(Este contribuyente..." o "FECHA"
  const mDom = text.match(/DOMICILIO\s+FISCAL\s+([\s\S]*?)(?:\(Este|FECHA DE)/i);
  if (mDom) {
    rifData.domicilioFiscal = mDom[1].replace(/\s+/g, ' ').trim();
  }

  const mInsc = text.match(/INSCRIPCI[OÓ]N:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mInsc) rifData.fechaInscripcion = mInsc[1];

  const mAct = text.match(/ACTUALIZACI[OÓ]N:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mAct) rifData.fechaUltimaActualizacion = mAct[1];

  const mVen = text.match(/VENCIMIENTO:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mVen) rifData.fechaVencimiento = mVen[1];

  // Código de verificación: "1079205660-OUY"
  const mSerial = text.match(/\b(\d{9,12})-([A-Z0-9]{2,6})\b/);
  if (mSerial) rifData.serial = `${mSerial[1]}-${mSerial[2]}`;

  return rifData;
};

module.exports = { readRIF };