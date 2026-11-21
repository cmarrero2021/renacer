// Dump OCR raw text + parser results for a RIF image
const fs = require('fs');
const path = require('path');
const Jimp = require(path.join(__dirname, '..', 'auth', 'node_modules', 'jimp'));

// reuse helpers from the controller by requiring it? It doesn't export them.
// So replicate the OCR call:
const { createWorker } = require(path.join(__dirname, '..', 'auth', 'node_modules', 'tesseract.js'));

const preprocesar = async (buf) => {
  const img = await Jimp.read(buf);
  const { width } = img.bitmap;
  if (width < 2000) img.scale(2000 / width);
  img.greyscale().normalize().contrast(0.2);
  return img.getBufferAsync(Jimp.MIME_PNG);
};

(async () => {
  const file = process.argv[2];
  const buf = fs.readFileSync(file);
  const src = await preprocesar(buf);
  const worker = await createWorker('spa', 1, { logger: () => {} });
  const { data: { text } } = await worker.recognize(src);
  await worker.terminate();
  console.log('===== OCR RAW =====');
  console.log(text);
  console.log('===== END =====');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
