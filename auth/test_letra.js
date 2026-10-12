const fs = require('fs');
const Jimp = require('jimp');
const { createWorker } = require('tesseract.js');

(async () => {
  const img = await Jimp.read('../rif/rif_inass.png');
  const buf = await img.getBufferAsync(Jimp.MIME_PNG);
  const wk = await createWorker('spa', 1, { logger: () => {} });
  const { data } = await wk.recognize(buf, {}, { blocks: true });
  await wk.terminate();

  // buscar el token del RIF: letra/dígito + 9 dígitos seguidos de nombre
  let found = null;
  for (const block of data.blocks || []) {
    for (const par of block.paragraphs || []) {
      for (const line of par.lines || []) {
        for (const word of line.words || []) {
          const t = word.text.trim();
          if (/^[A-Z0-9]\d{9}$/.test(t) || /^([JVGEP])[-.]?(\d{8})[-.]?(\d)$/.test(t)) {
            if (!found || word.bbox.y0 < found.bbox.y0) found = word;
          }
        }
      }
    }
  }
  if (!found) { console.log('no se encontro token RIF'); process.exit(1); }
  console.log('token:', found.text, 'bbox:', JSON.stringify(found.bbox));

  // recortar SOLO el primer carácter y ampliarlo
  const w = found.bbox.x1 - found.bbox.x0;
  const h = found.bbox.y1 - found.bbox.y0;
  const charW = w / found.text.length;
  const crop = img.clone().crop(
    Math.max(0, found.bbox.x0 - 2),
    Math.max(0, found.bbox.y0 - 4),
    Math.ceil(charW) + 8,
    h + 10
  );
  const big = crop.resize(150, Jimp.AUTO);
  const cb = await big.getBufferAsync(Jimp.MIME_PNG);

  const wk2 = await createWorker('eng', 1, { logger: () => {} });
  await wk2.setParameters({ tessedit_char_whitelist: 'JVGEPS', tessedit_pageseg_mode: '10' });
  const { data: { text } } = await wk2.recognize(cb);
  await wk2.terminate();
  const letra = (text.trim() || '').toUpperCase();
  console.log('letra detectada:', JSON.stringify(letter(text)));

  function letter(t) {
    const c = t.trim().toUpperCase();
    return ['J','V','G','E','P'].includes(c) ? c : '';
  }
  await wk.terminate();
})().catch(e => console.error('FALLO:', e.message));