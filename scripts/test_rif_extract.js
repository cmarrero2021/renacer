// Prueba: extrae data de un RIF real usando el mismo endpoint del registro
const path = require('path');
const fs = require('fs');
const { readRifFromUpload } = require('./auth/src/controllers_rif');

const file = process.argv[2] || 'rif/rif_ministerio.jpeg';
const buf = fs.readFileSync(file);
const base64 = buf.toString('base64');

const req = { body: { archivoBase64: base64, nombreArchivo: path.basename(file) } };
const res = {
  headers: {},
  set(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; },
  json(payload) { console.log('STATUS:', this.statusCode); console.log(JSON.stringify(payload, null, 2)); },
};

(async () => {
  try {
    await readRifFromUpload(req, res);
  } catch (e) {
    console.error('FALLO:', e);
  }
  process.exit(0);
})();
