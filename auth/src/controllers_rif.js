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

  // Formato nuevo (RIF Digital v2.0): "RIF: G200171774" puede quedar solo en la
  // línea; el nombre va en las líneas siguientes, no al lado del número.
  m = line.match(/\bRIF\s*[:.]?\s*([JVGEP])\s*[-.\s]?\s*(\d{8})\s*[-.\s]?\s*(\d)(?!\d)/);
  if (m) return { rif: `${m[1]}-${m[2]}${m[3]}`, rest: '' };

  return null;
};

// ─── Parser del formato nuevo de RIF (SENIAT "RIF Digital v2.0") ───
// Estructura: "RIF: G200171774" en su propia línea (el nombre ya no va al lado
// del número), nombre en la(s) línea(s) siguiente(s), y "DOMICILIO FISCAL:" con
// la dirección debajo. El OCR puede mal leer el prefijo (G→6, 3→E, etc.); usamos
// tryParseRifPrefix() para corregirlo. Las basuras comunes se filtran con
// BASURA_RIF_NUEVO. Las líneas suelen venir entrelazadas de las dos columnas.
tryParseRifPrefix = (line) => {
  // Intento 1: coincidir con la etiqueta RIF y capturar el número completo.
  // El OCR puede leer la letra como dígito (G→6). El dígito check puede aparecer
  // o no (a veces va seguido de FECHA/OTROS textos). Hacemos todo opcional para ser tolerantes.
  let m = line.match(/RIF\s*[:.]?\s*([A-Z0-9])?\s*(\d{8,10})?\s*(\d)?/i);
  if (!m) return null;

  // m[1] = letra o dígito que OCR capturó (puede ser "6" en lugar de "G")
  // m[2] = número de 8-10 dígitos
  // m[3] = dígito check (puede ser undefined si va seguido de FECHA u otros textos)
  let letra = m[1] ? m[1].toUpperCase() : null;
  const numero = m[2] ? m[2] : null;
  const digito = m[3] ? m[3] : null;

  // Validar/mapear la letra: debe ser J, V, G, E o P.
  // Si el OCR capturó un dígito (ej. "6" en lugar de "G"), usar el mapa inverso.
  if (letra && !/[JVGEP]/.test(letra)) {
    const invMap = { '6': 'G', '3': 'E', '9': 'P', '1': 'J', '7': 'J' };
    if (invMap[letra]) {
      // La letra fue mal leída como dígito (G→6, E→3, etc.): convertir directo.
      letra = invMap[letra];
    } else if (digito && invMap[digito]) {
      letra = invMap[digito];
    } else {
      // Sin dígito check: probar las primeras posiciones del número contra el mapa
      const prefijoMap = { '6': 'G', '3': 'E', '9': 'P', '1': 'J', '7': 'J' };
      if (numero) {
        // Probar posición 0 y la última posición (dígito check potencial)
        for (const pos of [0, numero.length - 1]) {
          const d = numero.charAt(pos);
          if (prefijoMap[d]) { letra = prefijoMap[d]; break; }
        }
      }
    }
  }

  // Si aun no tenemos una letra válida, abortar
  if (!letra || !/[JVGEP]/.test(letra)) return null;

  return { letra, numero, digito };
};

// Estructuras de expresión regular para el formato nuevo
const RIF_NUEVO_RX = /\bRIF\s*[:.]?\s*([JVGEP])\s*[-.\s]?\s*(\d{8})\s*[-.\s]?\s*(\d)(?!\d)/;
const RIF_SOLO_RX = /^\s*([JVGEP])\s*[-.\s]?\s*(\d{8})\s*[-.\s]?\s*(\d)(?!\d)\s*$/;
const RIF_LINEA_RX = /^\s*([JVGEP])\s*[-.\s]?\s*(\d{8})\s*[-.\s]?\s*(\d)(?!\d)/;

const BASURA_RIF_NUEVO = [
  /\d{2}\/\d{2}\/\d{4}/g,                                     // fechas
  /\b(N[°º*"”'’]?\s*)?COMPROBANTE\s*:?\s*[A-Z0-9€$¢©®ª]*/gi,  // N° COMPROBANTE: ...
  /\b\d{9,12}-[A-Z][A-Z0-9]{1,5}\b/g,                         // serial (firma autorizada)
  /FECHA\s+DE\s+INSCRIPCI[OÓ]N/gi,
  /[ÚU]LTIMA\s+ACTUALIZACI[OÓ]N/gi,
  /FECHA\s+DE\s+VENCIMIENTO/gi,
  /\b(GERENCIA|SEDE)\s+REGIONAL.*$/gi,                        // bloque de la oficina SENIAT
  /\bTRIBUTOS\s+INTERNOS.*$/gi,
  /\bDIVISI[OÓ]N\s+DE\s+CONTRIBUYENTES.*$/gi
];

const RIF_NUEVO_STOP = /^(DOMICILIO|DATOS\s+DE|GERENCIA|DIVISI|IDENTIFICACI|REGISTRO\s+[ÚU]NICO|FIRMA|CI?RMA|DOCUMENTO|CONDICI|SERVICIO\s+NACIONAL|ADMINISTRACI|ECONOMI|VENEZUELA|SENIAT|SENIAIT|MA\s+AUTORIZADA|AUTORIZADA|N?[°º*]?\s*COMPROBANTE|FECHA|[ÚU]LTIMA|SERIAL|CONDICI[OÓ]N)/;

const VOCABULARIO_OFICINA = /\b(GERENCIA|SEDE\s+REGIONAL|TRIBUTOS\s+INTERNOS|DIVISI[OÓ]N\s+DE\s+CONTRIBUYENTES|CONTRIBUYENTES\s+ESPECIALES|LIBERTADOR)\b/;

const DIRECCION_START = /^(CALLE|AVENIDA|AVDA\.?|AV\b|URB\.?|URBANIZACI|EDIF\.?|EDIFICIO|RESID\.?|RESIDENCIA|SECTOR|ESQ\.?|ESQUINA|CARR\.?|CARRETERA|VEREDA|PARQUE|ZONA\s+INDUSTRIAL|POL[IÍ]GONO|CENTRO\s+COMERCIAL|C\.?\s?C\.?|LOCAL|QUINTA|CASA|TORRE|GALP[OÓ]N|ANEXO|KM\b|TERMINAL|ESTACI[OÓ]N|PUERTO|AEROPUERTO|DISTRITO|CIUDAD|PISO|SOLAR|TERRENO|TPS)/;

const limpiarLineaRifNuevo = (linea) => {
  let s = linea;
  for (const rx of BASURA_RIF_NUEVO) s = s.replace(rx, ' ');
  return s.replace(/[^A-ZÁÉÍÓÚÑÜ0-9&.,#/\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const parseRifNuevoFormato = (text) => {
  const out = { rif: '', nombre: '', domicilioFiscal: '' };
  if (!text) return out;

  const lineas = text.toUpperCase().replace(/\r/g, '').split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Localizar la línea donde aparece el RIF (con etiqueta, solo, o a inicio de línea)
  // Estrategia 1: tryParseRifPrefix (tolerante a OCR-malread como G→6)
  // Estrategia 2: regex originales con [JVGEP]
  // Estrategia 3: patrón relajado - cualquier línea con "RIF:" y número de 8+ dígitos
  let idxRif = -1;
  let mRif = null;
  for (let i = 0; i < lineas.length; i++) {
    // Estrategia 1
    const pref = tryParseRifPrefix(lineas[i]);
    if (pref) {
      mRif = pref;
      idxRif = i;
      break;
    }
    // Estrategia 2
    mRif = lineas[i].match(RIF_NUEVO_RX) || lineas[i].match(RIF_SOLO_RX) || lineas[i].match(RIF_LINEA_RX);
    if (mRif) { idxRif = i; break; }
    // Estrategia 3: fallback permisivo - busca "RIF:" seguido de númerosaunque la letra no sea J/V/G/E/P
    const relaxedMatch = lineas[i].match(/RIF\s*[:.]?\s*[\dA-Z]\s*(\d{8,10})/i);
    if (relaxedMatch) {
      mRif = { letra: 'G', numero: relaxedMatch[1], digito: null }; // sin dígito check si OCR no lo capturó
      idxRif = i;
      break;
    }
  }
  if (!mRif) return out;
  // mRif puede ser un array de regex (mRif[1], mRif[2], mRif[3]) u objeto { letra, numero, digito }
  let letra, numero, digito;
  if (Array.isArray(mRif)) {
    letra = mRif[1];
    numero = mRif[2];
    digito = mRif[3];
  } else {
    // objeto del fallback de estrategia 3
    letra = mRif.letra;
    numero = mRif.numero;
    digito = mRif.digito;
  }
  // Construir el RIF: solo añadir el dígito check si existe y es un dígito
  const digitoStr = digito ? String(digito) : '';
  out.rif = `${letra}-${numero}${digitoStr}`;

  // Recorrer desde la línea del RIF: nombre hasta topar con la dirección
  // (o con la etiqueta DOMICILIO FISCAL), y de ahí en adelante la dirección.
  const nombrePartes = [];
  const dirPartes = [];
  let modo = 'nombre';

  for (let i = idxRif; i < lineas.length && modo !== 'fin'; i++) {
    let linea = lineas[i];
    if (i === idxRif) {
      linea = linea.replace(RIF_NUEVO_RX, ' ').replace(RIF_SOLO_RX, ' ').replace(RIF_LINEA_RX, ' ');
      // Relajado: cubre la etiqueta RIF cuando el OCR mal leyó el prefijo
      // (ej. "RIF: 6200171774" en lugar de "RIF: G200171774"), que no casa
      // con los regex estrictos de arriba.
      linea = linea.replace(/\bRIF\s*[:.]?\s*[A-Z0-9]?\s*\d{8,10}\s*\d?/i, ' ');
    }

    const tieneFecha = /\d{2}\/\d{2}\/\d{4}/.test(linea);
    const tieneSerial = /\d{9,12}-[A-Z][A-Z0-9]{1,5}/.test(linea);
    const esStop = RIF_NUEVO_STOP.test(linea);
    const esDireccion = DIRECCION_START.test(linea);

    if (modo === 'nombre') {
      // Una línea que inicia con tipo/torre/calle/etc. marca el comienzo de la
      // dirección (la etiqueta DOMICILIO FISCAL a veces no sale en el OCR),
      // pero sólo si ya recolectamos algo del nombre.
      if (i !== idxRif && esDireccion && nombrePartes.length > 0) { modo = 'direccion'; i--; continue; }
      if (esStop) {
        if (/^DOMICILIO/.test(linea)) modo = 'direccion';
        continue;
      }
      if (i !== idxRif && (tieneFecha || tieneSerial)) continue;
      const parte = limpiarLineaRifNuevo(linea);
      // El nombre no contiene números: descartar series largas de dígitos que
      // el OCR mezcla (fechas sin barras, residuos de comprobante, etc.).
      const parteLimpia = parte.replace(/\d{4,}/g, ' ').replace(/\s+/g, ' ').trim();
      if (parteLimpia && parteLimpia.length >= 3 && !VOCABULARIO_OFICINA.test(parteLimpia)) nombrePartes.push(parteLimpia);
    } else {
      if (i !== idxRif && (esStop || tieneFecha || tieneSerial) && !/^DOMICILIO/.test(linea)) { modo = 'fin'; break; }
      const parte = limpiarLineaRifNuevo(linea).replace(/^DOMICILIO\s*FISCAL\s*[.:]?\s*/, '');
      if (parte && parte.length >= 10) dirPartes.push(parte);
    }
  }

  out.nombre = nombrePartes.join(' ').trim();
  out.domicilioFiscal = dirPartes.join(' ').trim();
  return out;
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
    console.log('[DEBUG2] isPdf:', isPdf, '||ocrText length:', ocrText?.length || 0, '||rifData.rif:', rifData.rif, '||rifData.nombre:', rifData.nombre);
    if (ocrText) {
      console.log('[DEBUG2] ocrText preview:', ocrText.substring(0, 200));
      const ocrData = parseRifText(ocrText);
      for (const k of Object.keys(rifData)) {
        if (!rifData[k] && ocrData[k]) rifData[k] = ocrData[k];
      }
      // Intento 2b: si aún falta nombre o dirección, prueba el parser del formato nuevo (RIF Digital v2.0)
      if (!rifData.nombre || !rifData.domicilioFiscal) {
        console.log('[DEBUG2] Entering parseRifNuevoFormato fallback...');
        const nuevo = parseRifNuevoFormato(ocrText);
        console.log('[DEBUG2] parseRifNuevoFormato result:', JSON.stringify(nuevo));
        if (nuevo.rif) { console.log('[DEBUG] parseRifNuevoFormato gave rif:', nuevo.rif); rifData.rif = nuevo.rif; }
        if (nuevo.nombre && !rifData.nombre) { console.log('[DEBUG] parseRifNuevoFormato gave nombre:', nuevo.nombre); rifData.nombre = nuevo.nombre; }
        if (nuevo.domicilioFiscal && !rifData.domicilioFiscal) { console.log('[DEBUG] parseRifNuevoFormato gave domicilio:', nuevo.domicilioFiscal); rifData.domicilioFiscal = nuevo.domicilioFiscal; }
        // Fallback: si el parser nuevo no capturó nada pero ya teníamos RIF de la etapa 1/2, intenta extraer nombre por banda
        if (!rifData.nombre && rifData.rif) {
          console.log('[DEBUG] Trying band-scan fallback for nombre...');
          const imgSource = await renderPdfPage(fileBuffer, 1, 3);
          const image = await Jimp.read(imgSource);
          const band = await scanBandsForRif(image);
          if (band) {
            if (band.rif) rifData.rif = band.rif;
            if (band.nombre && !rifData.nombre) rifData.nombre = band.nombre;
          }
        }
      }
      metodo = isPdf ? 'ocr' : 'ocr-imagen';
    } else {
      console.log('[DEBUG2] ocrText is empty/falsy, skipping OCR stage');
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
