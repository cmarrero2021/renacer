// Test E2E del autorregistro contra el backend local (puerto 4110)
const BASE = 'http://localhost:4110/auth';
const EMAIL = 'diag-rif-e2e4@correo.com';

const j = async (url, opts) => {
  const r = await fetch(url, opts);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  return { status: r.status, data };
};

(async () => {
  // 1. request-code
  let r = await j(`${BASE}/registro/request-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL })
  });
  console.log('1. request-code:', r.status, JSON.stringify(r.data).slice(0, 150));

  // 2. leer código de MailDev (API en :1080)
  await new Promise(res => setTimeout(res, 1500));
  const mails = await (await fetch('http://localhost:1080/email')).json().catch(() => null);
  if (!mails || !mails.length) { console.log('MailDev no disponible o sin correos'); process.exit(1); }
  const mail = mails.find(m => m.to?.some(t => t.address === EMAIL)) || mails[0];
  const body = mail.text || mail.html || '';
  const codeMatch = body.match(/\b(\d{6})\b/);
  console.log('2. código leído de MailDev:', codeMatch ? codeMatch[1] : 'NO ENCONTRADO');
  if (!codeMatch) process.exit(1);

  // 3. verify-code
  r = await j(`${BASE}/registro/verify-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, code: codeMatch[1] })
  });
  console.log('3. verify-code:', r.status, JSON.stringify(r.data).slice(0, 200));
  const token = r.data?.registroToken || r.data?.token;
  if (!token) process.exit(1);

  // 4. read-rif con el jpeg del formato nuevo
  const fs = require('fs');
  const path = require('path');
  const buf = fs.readFileSync(path.join(__dirname, '..', 'recursos', 'rif', 'minaamp_nuevo.jpeg'));
  const base64 = buf.toString('base64');
  r = await j(`${BASE}/registro/read-rif`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ archivoBase64: base64, nombreArchivo: 'minaamp_nuevo.jpeg' })
  });
  console.log('4. read-rif:', r.status, JSON.stringify(r.data).slice(0, 300));

  // 5. completar con archivoRif
  r = await j(`${BASE}/registro/completar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      identidad: {
        cedula: 34567891, primer_nombre: 'DIAG', primer_apellido: 'E2E4',
        nacionalidad: 'V', sexo: 'M', fecha_nacimiento: '1990-01-01'
      },
      telefono: '02125551122', celular: '04125551122',
      password: 'Clave*Test2026',
      centro: {
        tipo_rif: 'G', numero_rif: '200171774',
        nombre: 'CENTRO DIAG E2E', direccion: 'CALLE PRUEBA',
        telefono: '02125551122', correo: 'diag-rif-e2e@correo.com'
      },
      archivoRif: { base64, nombre: 'minaamp_nuevo.jpeg' }
    })
  });
  console.log('5. completar:', r.status, JSON.stringify(r.data).slice(0, 300));
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
