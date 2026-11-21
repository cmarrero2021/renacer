require('dotenv').config({ path: require('path').join(__dirname, '.env.development') });
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_DATABASE, password: process.env.DB_PASSWORD,
  port: +process.env.DB_PORT,
});
(async () => {
  try {
    const c = await p.query("SELECT id, rif, rif_archivo FROM public.centros WHERE id = 510");
    console.log('centro 510:', JSON.stringify(c.rows[0]));
    const u = await p.query("SELECT id, email, centro_id FROM public.users WHERE id = 27");
    console.log('usuario 25:', JSON.stringify(u.rows[0]));
  } catch (e) { console.error('ERR:', e.message); }
  finally { await p.end(); }
})();
