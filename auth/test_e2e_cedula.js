/**
 * E2E: ejecuta readCedula real (4 pasadas OCR + merge) contra cedula/ y
 * guarda la respuesta JSON.  node test_e2e_cedula.js
 */
const { readCedula } = require('./src/controllers_cedula.js');
const fs = require('fs');

const req = {};
const res = {
  statusCode: 200,
  status(c) { this.statusCode = c; return this; },
  json(obj) {
    const { data, antiCopy, filename } = req._capture = { data: obj.data, antiCopy: obj.antiCopy, filename: obj.filename };
    const clean = { ...data };
    delete clean.rawText;
    fs.writeFileSync(__dirname + '/e2e_out.json', JSON.stringify({ status: this.statusCode, filename, data: clean, antiCopy }, null, 2));
    console.log(`HTTP ${this.statusCode}  archivo: ${filename}`);
    console.log(JSON.stringify(clean, null, 2));
    console.log('antiCopy:', antiCopy.verdict.label, '| razones:', antiCopy.verdict.reasons.join('; ') || 'ninguna');
  }
};

readCedula(req, res).catch(e => { console.error('FALLO:', e); process.exit(1); });
