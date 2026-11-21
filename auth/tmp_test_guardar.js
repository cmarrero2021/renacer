// Prueba aislada de guardarArchivoRif replicando el entorno del servidor (cwd = auth/)
const path = require('path');
process.chdir(path.join(__dirname)); // cwd = auth/
const { guardarArchivoRif } = require('./src/controllers_rif');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'recursos', 'rif', 'minaamp_nuevo.jpeg'));
  const base64 = buf.toString('base64');
  console.log('cwd:', process.cwd());
  console.log('UPLOADS_PATH env:', JSON.stringify(process.env.UPLOADS_PATH));
  const ruta = await guardarArchivoRif(508, base64, 'minaamp_nuevo.jpeg');
  console.log('resultado guardarArchivoRif:', ruta);
  process.exit(0);
})();
