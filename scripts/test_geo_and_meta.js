require('../auth/node_modules/dotenv').config({ path: 'd:/proyectos/rencam/auth/.env.development' });
const pool = require('../auth/src/db');

async function test() {
    // 1. Iniciar sesión directamente en BD para obtener token o consultar endpoints
    const jwt = require('../auth/node_modules/jsonwebtoken');
    const u = await pool.query("SELECT id, email FROM users WHERE email = 'marrero.c@gmail.com'");
    const user = u.rows[0];
    const sess = await pool.query("SELECT token FROM public.sessions WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [user.id]);
    let token = sess.rows[0]?.token;
    if (!token) {
        token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        await pool.query("INSERT INTO public.sessions (user_id, token, ip_address, user_agent, expires_at) VALUES ($1, $2, '127.0.0.1', 'test', NOW() + INTERVAL '1 hour')", [user.id, token]);
    }

    console.log('Testing APIs...');
    const baseUrl = 'http://localhost:4110/auth';

    // Meta catálogos
    const metaRes = await fetch(`${baseUrl}/catalogos`, { headers: { Authorization: `Bearer ${token}` } });
    const meta = await metaRes.json();
    console.log('Catalogs meta count:', meta.length, 'keys:', meta.map(c => c.key));

    // Estados
    const edosRes = await fetch(`${baseUrl}/geo/estados`, { headers: { Authorization: `Bearer ${token}` } });
    const edos = await edosRes.json();
    console.log('Estados count:', edos.length);
    console.log('Distrito Capital:', edos.find(e => e.id === '01'));

    // Municipios
    const munsRes = await fetch(`${baseUrl}/geo/municipios?estado_id=01`, { headers: { Authorization: `Bearer ${token}` } });
    const muns = await munsRes.json();
    console.log('Libertador municipio:', muns);

    // Parroquias
    const parrsRes = await fetch(`${baseUrl}/geo/parroquias?estado_id=01&municipio_id=01`, { headers: { Authorization: `Bearer ${token}` } });
    const parrs = await parrsRes.json();
    console.log('Parroquias count in Libertador:', parrs.length);
    const paraiso = parrs.find(p => p.nombre.includes('PARA'));
    // Resolve Geo (con coordenadas de El Paraíso)
    const resGeoGPS = await fetch(`${baseUrl}/geo/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: 10.488, lng: -66.938 })
    });
    console.log('Resolve Geo con GPS (El Paraíso):', await resGeoGPS.json());

    // Resolve Geo (con texto sin acentos)
    const resGeoText = await fetch(`${baseUrl}/geo/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estadoNombre: 'Distrito Capital', municipioNombre: 'Libertador', parroquiaNombre: 'El Paraiso' })
    });
    console.log('Resolve Geo con Texto sin acento (El Paraiso):', await resGeoText.json());

    await pool.end();
}

test().catch(err => { console.error(err); process.exit(1); });
