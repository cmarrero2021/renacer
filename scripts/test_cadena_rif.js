// Verifica la cadena completa: login → GET /centros/:id → rif_archivo disponible para el tab DOCUMENTOS
const BASE = 'http://localhost:4110/auth';
const j = async (url, opts) => {
  const r = await fetch(url, opts);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t.slice(0, 200); }
  return { status: r.status, data: d };
};
(async () => {
  // 1. Login con el usuario de prueba
  let r = await j(`${BASE}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'diag-rif-e2e4@correo.com', password: 'Clave*Test2026' })
  });
  console.log('1. login:', r.status);
  let token = null;
  const token0 = r.data?.token || r.data?.access_token || r.data?.data?.token;
  if (!token0 && r.data?.requires2FA) {
    // 2FA: leer el código de MailDev y verificarlo
    await new Promise(res => setTimeout(res, 1500));
    const mails = await (await fetch('http://localhost:1080/email')).json().catch(() => null);
    const mine = (mails || []).filter(m => m.to?.some(t => t.address === 'diag-rif-e2e4@correo.com'));
    mine.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    const mail = mine[0];
    const code = (mail?.text || mail?.html || '').match(/\b(\d{6})\b/);
    console.log('   2FA: código', code ? code[1] : 'NO ENCONTRADO', '| correos del usuario:', mine.length);
    const r2 = await j(`${BASE}/verify-2fa`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: r.data.tempToken, code: code?.[1] })
    });
    console.log('   2FA verify:', r2.status, JSON.stringify(r2.data).slice(0, 120));
    token = r2.data?.token || r2.data?.access_token || r2.data?.data?.token;
  }
  const tokenFinal = token0 || token;
  if (!tokenFinal) { console.log('   respuesta:', JSON.stringify(r.data).slice(0, 250)); process.exit(1); }
  const auth = { Authorization: `Bearer ${tokenFinal}` };

  // 2. GET /centros/510 (lo que consume CentroFormPage en modo edición)
  r = await j(`${BASE}/centros/510`, { headers: auth });
  console.log('2. GET /centros/510:', r.status, '| rif_archivo:', r.data?.rif_archivo, '| rif:', r.data?.rif);

  // 3. GET /mi-centro (redirección post-autorregistro)
  r = await j(`${BASE}/mi-centro`, { headers: auth });
  console.log('3. GET /mi-centro:', r.status, '| id:', r.data?.id, '| rif_archivo:', r.data?.rif_archivo);

  // 4. Endpoint de descarga del RIF precargado
  r = await j(`${BASE}/centros/510/rif-archivo?download=1`, { headers: auth });
  console.log('4. GET /centros/510/rif-archivo:', r.status, '| tipo:', r.headers?.get?.('content-type') || r.data?.message || 'binario');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
