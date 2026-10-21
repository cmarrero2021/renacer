const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const Jimp = require('jimp');
const { createWorker } = require('tesseract.js');

// ─── Helper: renderiza una página del PDF a PNG ───
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

// ─── Helper: preprocesa imagen para mejorar OCR ───
const preprocesarImagen = async (imageBuffer) => {
  try {
    const img = await Jimp.read(imageBuffer);
    const { width } = img.bitmap;
    if (width < 2000) img.scale(2000 / width);
    img.greyscale().normalize().contrast(0.2);
    return await img.getBufferAsync(Jimp.MIME_PNG);
  } catch {
    return imageBuffer;
  }
};

// ─── Helper: OCR de un buffer ───
const ocrBuffer = async (imageBuffer, preprocesar = false) => {
  const source = preprocesar ? await preprocesarImagen(imageBuffer) : imageBuffer;
  const worker = await createWorker('spa', 1, { logger: () => {} });
  const { data: { text } } = await worker.recognize(source);
  await worker.terminate();
  return text;
};

// ─── Helper: busca RIF + nombre en franjas de una imagen Jimp ───
const scanBandsForRif = async (image) => {
  const { width, height } = image.bitmap;
  const worker = await createWorker('spa', 1, { logger: () => {} });
  let found = null;

  try {
    for (let y = 0.08; y < 0.62; y += 0.05) {
      const y1 = Math.round(height * y);
      const y2 = Math.round(height * Math.min(y + 0.12, 1.0));
      const crop = image.clone().crop(0, y1, width, y2 - y1);
      const cropBuf = await crop.getBufferAsync(Jimp.MIME_PNG);
      const { data: { text } } = await worker.recognize(cropBuf);

      const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (let i = 0; i < allLines.length; i++) {
        const res = extractRifFromLine(allLines[i].toUpperCase());
        if (res) {
          const nameParts = [res.rest];
          for (let j = i + 1; j < allLines.length; j++) {
            if (isNameContinuation(allLines[j])) nameParts.push(allLines[j].trim());
            else break;
          }
          found = { rif: res.rif, nombre: cleanNombre(nameParts.join(' ')) };
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

const NAME_STOP = /^\s*(DOMICILIO|FECHA|GERENCIA|N[°º*]\s|REGISTRO|\(ESTE|CONDICI|AGENTE|SERIAL|FIRMA|GEREN)/i;

const isNameContinuation = (line) => {
  const up = line.trim().toUpperCase();
  if (!up) return false;
  if (NAME_STOP.test(up)) return false;
  if (/\d{2}\/\d{2}\/\d{4}/.test(up)) return false;
  if (/COMPROBANTE/.test(up)) return false;
  if (/\d{9,12}-[A-Z0-9]{2,6}/.test(up)) return false;
  return /[A-ZÁÉÍÓÚÑ&]/.test(up);
};

const digitoAPrefijo = (d) => ({ '6': 'G', '3': 'E', '9': 'P', '1': 'J', '7': 'J' }[d] || 'G');

const extractRifFromLine = (line) => {
  let m = line.match(/\b([JVGEP])\s*[-.]?\s*(\d{9})\s+([A-Z][A-Z&.\s]{2,})/);
  if (m) return { rif: `${m[1]}-${m[2]}`, rest: m[3] };

  m = line.match(/\b([JVGEP])\s*[-.]?\s*(\d{7,8})\s*[-.]?\s*(\d)\s+([A-Z][A-Z&.\s]{2,})/);
  if (m) return { rif: `${m[1]}-${m[2]}${m[3]}`, rest: m[4] };

  m = line.match(/\b(\d)(\d{9})\s+([A-Z][A-Z&.\s]{2,})/);
  if (m) return { rif: `${digitoAPrefijo(m[1])}-${m[2]}`, rest: m[3] };

  return null;
};

// ─── Parser de texto OCR de RIF ───
const parseRifText = (text) => {
  const rifData = {
    comprobante: '', rif: '', nombre: '',
    domicilioFiscal: '', fechaInscripcion: '',
    fechaUltimaActualizacion: '', fechaVencimiento: '', serial: ''
  };

  if (!text) return rifData;

  const mComp = text.match(/COMPROBANTE:\s*([A-Z0-9]+)/i);
  if (mComp) rifData.comprobante = mComp[1];

  let rifLineIdx = text.search(/^\s*[JVGEP]\s?-?\d{9}/m);
  let mRif = null;
  if (rifLineIdx !== -1) {
    mRif = text.slice(rifLineIdx).match(/^\s*([JVGEP])\s?-?(\d{9})\s+(.+)/m);
    if (mRif) rifData.rif = `${mRif[1]}-${mRif[2]}`;
  }
  if (!rifData.rif) {
    rifLineIdx = text.search(/^\s*\d{10}\s+[A-Z]/m);
    if (rifLineIdx !== -1) {
      mRif = text.slice(rifLineIdx).match(/^\s*(\d)(\d{9})\s+(.+)/m);
      if (mRif) rifData.rif = `${digitoAPrefijo(mRif[1])}-${mRif[2]}`;
    }
  }
  if (mRif) {
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

  const mDom = text.match(/DOMICILIO\s+FISCAL\s+([\s\S]*?)(?:\(Este|FECHA DE)/i);
  if (mDom) rifData.domicilioFiscal = mDom[1].replace(/\s+/g, ' ').trim();

  const mInsc = text.match(/INSCRIPCI[OÓ]N:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mInsc) rifData.fechaInscripcion = mInsc[1];

  const mAct = text.match(/ACTUALIZACI[OÓ]N:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mAct) rifData.fechaUltimaActualizacion = mAct[1];

  const mVen = text.match(/VENCIMIENTO:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mVen) rifData.fechaVencimiento = mVen[1];

  const serialStartIdx = rifData.rif
    ? text.search(new RegExp(rifData.rif.replace('-', '[-]?')))
    : 0;
  const searchZone = serialStartIdx > 0 ? text.slice(serialStartIdx) : text;
  const mSerial = searchZone.match(/\b(\d{9,12})-([A-Z][A-Z0-9]{1,5})\b/);
  if (mSerial) rifData.serial = `${mSerial[1]}-${mSerial[2]}`;

  return rifData;
};

// ─── Lógica core de extracción de RIF (reutilizada por ambos endpoints) ───
const extractRifData = async (fileBuffer, isPdf) => {
  const rifData = {
    comprobante: '', rif: '', nombre: '',
    domicilioFiscal: '', fechaInscripcion: '',
    fechaUltimaActualizacion: '', fechaVencimiento: '', serial: ''
  };
  let metodo = '';

  // Intento 1: texto directo (solo PDF digital)
  if (isPdf) {
    try {
      const parsed = await pdf(fileBuffer);
      const text = parsed.text || '';
      if (text.trim()) {
        rifData.comprobante = parseRifText(text).comprobante;
        rifData.rif = parseRifText(text).rif;
        rifData.nombre = parseRifText(text).nombre;
        rifData.domicilioFiscal = parseRifText(text).domicilioFiscal;
        rifData.fechaInscripcion = parseRifText(text).fechaInscripcion;
        rifData.fechaUltimaActualizacion = parseRifText(text).fechaUltimaActualizacion;
        rifData.fechaVencimiento = parseRifText(text).fechaVencimiento;
        rifData.serial = parseRifText(text).serial;
        metodo = 'texto';
      }
    } catch { /* seguir a OCR */ }
  }

  // Intento 2: OCR (imágenes preprocesadas; PDFs renderizados a escala 2)
  if (!rifData.rif || !rifData.nombre) {
    const source = isPdf ? await renderPdfPage(fileBuffer, 1, 2) : fileBuffer;
    const ocrText = await ocrBuffer(source, !isPdf);
    if (ocrText) {
      const ocrData = parseRifText(ocrText);
      for (const k of Object.keys(rifData)) {
        if (!rifData[k] && ocrData[k]) rifData[k] = ocrData[k];
      }
      metodo = isPdf ? 'ocr' : 'ocr-imagen';
    }
  }

  // Intento 3: franjas a alta resolución para RIF + nombre multilínea
  if (!rifData.rif) {
    const imgSource = isPdf
      ? await renderPdfPage(fileBuffer, 1, 3)
      : await preprocesarImagen(fileBuffer);
    const image = await Jimp.read(imgSource);
    const band = await scanBandsForRif(image);
    if (band) {
      if (band.rif) rifData.rif = band.rif;
      if (band.nombre && !rifData.nombre) rifData.nombre = band.nombre;
    }
  }

  return { rifData, metodo };
};

// ─── Endpoint 1: Lee RIF desde la carpeta rif/ (heredado, para LEER RIF) ───
const readRIF = async (req, res) => {
  try {
    const rifPath = path.join(__dirname, '..', '..', 'rif');
    const files = fs.readdirSync(rifPath).filter(f => /\.(pdf|png|jpe?g)$/i.test(f));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No se encontró archivo RIF (.pdf/.png/.jpg/.jpeg) en la carpeta rif/' });
    }

    const filePath = path.join(rifPath, files[0]);
    const fileBuffer = fs.readFileSync(filePath);
    const isPdf = /\.pdf$/i.test(files[0]);

    const { rifData, metodo } = await extractRifData(fileBuffer, isPdf);

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: rifData, filename: files[0], metodo });
  } catch (error) {
    console.error('Error al leer RIF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo RIF' });
  }
};

// ─── Endpoint 2: Recibe archivo RIF (base64) y extrae data (para CARGAR RIF en registro) ───
const readRifFromUpload = async (req, res) => {
  try {
    const { archivoBase64, nombreArchivo } = req.body || {};

    if (!archivoBase64) {
      return res.status(400).json({ error: 'El archivo RIF es requerido.' });
    }

    const buf = Buffer.from(archivoBase64, 'base64');
    if (buf.length === 0) {
      return res.status(400).json({ error: 'Archivo vacío o inválido.' });
    }

    const nombre = String(nombreArchivo || 'rif.pdf').toLowerCase();
    const isPdf = /\.pdf$/i.test(nombre);

    const { rifData, metodo } = await extractRifData(buf, isPdf);

    // Validación básica: al menos el RIF debe estar presente
    if (!rifData.rif) {
      return res.status(422).json({
        error: 'No se pudo extraer el RIF del documento. Verifique que el archivo sea legible e intente nuevamente.',
        data: rifData,
        filename: nombreArchivo
      });
    }

    // Sólo se permiten RIF jurídicos (J), de gobierno (G) o de comuna (C);
    // se rechazan RIF personales (V - Natural, E - Extranjero, P - Pasaporte)
    const tipoRif = String(rifData.rif).charAt(0).toUpperCase();
    if (!['J', 'G', 'C'].includes(tipoRif)) {
      return res.status(422).json({
        error: `El documento corresponde a un RIF tipo ${tipoRif} (persona). Sólo se permiten RIF jurídicos (J), de gobierno (G) o de comuna (C); no se aceptan RIF personales.`,
        tipoRif: tipoRif
      });
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: rifData,
      filename: nombreArchivo,
      metodo
    });
  } catch (error) {
    console.error('Error al procesar RIF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo RIF.' });
  }
};

// ─── Endpoint 3: Guarda el archivo RIF asociado a un centro ───
// Se exporta para reutilizar desde controllers_registro.js al completar el registro
const guardarArchivoRif = async (centroId, archivoBase64, nombreArchivo) => {
  if (!archivoBase64 || !centroId) return null;

  try {
    const uploadsPath = path.resolve(process.cwd(), process.env.UPLOADS_PATH || './uploads');
    const centroDocsPath = path.join(uploadsPath, 'documentos', String(centroId));
    if (!fs.existsSync(centroDocsPath)) {
      fs.mkdirSync(centroDocsPath, { recursive: true });
    }

    const nombre = String(nombreArchivo || 'rif.pdf').toLowerCase();
    const extMatch = nombre.match(/\.([a-z0-9]+)$/);
    const ext = extMatch && ext.length === 2 ? extMatch[1] : 'pdf';
    const destPath = path.join(centroDocsPath, `rif.${ext}`);
    const buf = Buffer.from(archivoBase64, 'base64');
    fs.writeFileSync(destPath, buf);

    // Ruta relativa a UPLOADS_BASE (misma convención que writeFileToDisk en controllers_centros)
    const relativePath = path.relative(uploadsPath, destPath).replace(/\\/g, '/');
    return relativePath;
  } catch (err) {
    console.error('Error al guardar archivo RIF:', err.message);
    return null;
  }
};

module.exports = { readRIF, readRifFromUpload, guardarArchivoRif };
