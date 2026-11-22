// Prueba: cédula ya existente en users → debe bloquear el registro (409)
const BASE = 'http://localhost:4110/auth';
const EMAIL = 'diag-duplicado@correo.com';
const NACIONALIDAD = process.argv[2] || 'V';
const CEDULA = parseInt(process.argv[3] || '7920566', 10);

const j = async (url, opts) => {
  const r = await fetch(url, opts);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t.slice(0, 200); }
  return { status: r.status, data: d };
};

(async () => {
  // 1. request-code
  let r = await j(`${BASE}/registro/request-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL })
  });
  console.log('1. request-code:', r.status);

  // 2. código desde MailDev (el más reciente de este correo)
  await new Promise(res => setTimeout(res, 1500));
  const mails = await (await fetch('http://localhost:1080/email')).json().catch(() => null);
  const mine = (mails || []).filter(m => m.to?.some(t => t.address === EMAIL));
  mine.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  const code = (mine[0]?.text || mine[0]?.html || '').match(/\b(\d{6})\b/);
  console.log('2. código:', code?.[1] || 'NO ENCONTRADO');
  if (!code) process.exit(1);

  // 3. verify-code → registroToken
  r = await j(`${BASE}/registro/verify-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, code: code[1] })
  });
  const token = r.data?.registroToken;
  console.log('3. verify-code:', r.status, token ? '(token OK)' : JSON.stringify(r.data));
  if (!token) process.exit(1);

  // 4. consultar-identidad con la cédula ya registrada
  r = await j(`${BASE}/registro/consultar-identidad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nacionalidad: NACIONALIDAD, cedula: CEDULA })
  });
  console.log(`4. consultar-identidad (${NACIONALIDAD}-${CEDULA}):`, r.status);
  console.log('   respuesta:', JSON.stringify(r.data));
  console.log(r.status === 409
    ? '   ✔ BLOQUEADO: usuario ya registrado, no puede continuar'
    : '   ✘ NO bloqueado (se esperaba 409)');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
