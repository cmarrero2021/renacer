const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const readRIF = async (req, res) => {
  try {
    const rifPath = path.join(__dirname, '..', '..', 'rif');

    const files = fs.readdirSync(rifPath).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No se encontró archivo RIF en la carpeta rif/' });
    }

    const pdfPath = path.join(rifPath, files[0]);
    const dataBuffer = fs.readFileSync(pdfPath);
    const { text } = await pdf(dataBuffer);

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

    // N° COMPROBANTE: 202406R0000064506550
    const mComp = text.match(/COMPROBANTE:\s*([A-Z0-9]+)/i);
    if (mComp) rifData.comprobante = mComp[1];

    // Línea RIF + nombre: "V079205660  CARLOS RAFAEL MARRERO MUñOZ"
    const mRif = text.match(/^\s*([JVGEP])\s?-?(\d{9})\s+(.+)$/m);
    if (mRif) {
      rifData.rif = `${mRif[1]}-${mRif[2]}`;
      rifData.nombre = mRif[3].trim().toUpperCase();
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

    res.json({ success: true, data: rifData, filename: files[0] });
  } catch (error) {
    console.error('Error al leer RIF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo RIF' });
  }
};

module.exports = { readRIF };