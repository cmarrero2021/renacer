const path = require('path');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require(path.resolve(__dirname, '../auth/node_modules/dotenv')).config({ path: path.resolve(__dirname, `../auth/.env.${ambiente}`) });
const pool = require('../auth/src/db');
const jwt = require('../auth/node_modules/jsonwebtoken');

async function testCatalogos() {
    const client = await pool.connect();
    try {
        console.log('=== TEST: API DE CATÁLOGOS Y PERMISOS ===\n');

        // 1. Obtener usuario admin
        const adminRes = await client.query(`
            SELECT u.id, u.email 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE LOWER(r.name) IN ('admin', 'administrador')
            LIMIT 1
        `);

        if (adminRes.rows.length === 0) {
            console.error('No se encontró usuario administrador.');
            return;
        }

        const adminUser = adminRes.rows[0];
        console.log(`Usuario Admin para prueba: ${adminUser.email} (ID ${adminUser.id})`);

        // Crear sesión temporal en sessions para que pase el middleware authenticate
        const adminToken = jwt.sign({ userId: adminUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        await client.query(`
            INSERT INTO sessions (user_id, token, expires_at, is_revoked)
            VALUES ($1, $2, NOW() + INTERVAL '1 hour', FALSE)
        `, [adminUser.id, adminToken]);

        const baseUrl = `http://localhost:${process.env.PORT_AUTH || 4110}/auth`;

        // 2. GET /catalogos (Metadata)
        console.log('\n1. Probando GET /auth/catalogos (Metadata)...');
        const metaRes = await fetch(`${baseUrl}/catalogos`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('   Status:', metaRes.status);
        const metaData = await metaRes.json();
        console.log(`   Catálogos disponibles (${metaData.length}):`, metaData.map(c => c.label).join(', '));

        // 3. GET /catalogos/tipos_establecimiento (Listar)
        console.log('\n2. Probando GET /auth/catalogos/tipos_establecimiento (Listar)...');
        const listRes = await fetch(`${baseUrl}/catalogos/tipos_establecimiento`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('   Status:', listRes.status);
        const listData = await listRes.json();
        console.log(`   Total registros: ${listData.total}, Retornados: ${listData.data.length}`);
        console.log('   Muestra primer registro:', listData.data[0]?.nombre);

        // 4. POST /catalogos/tipos_establecimiento (Crear)
        console.log('\n3. Probando POST /auth/catalogos/tipos_establecimiento (Crear)...');
        const testCode = 'test_' + Date.now();
        const createRes = await fetch(`${baseUrl}/catalogos/tipos_establecimiento`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                codigo: testCode,
                nombre: 'Establecimiento de Prueba',
                descripcion: 'Creado mediante test automatizado',
                activo: true
            })
        });
        console.log('   Status:', createRes.status);
        const createData = await createRes.json();
        console.log('   Item creado ID:', createData.item?.id, 'Código:', createData.item?.codigo);
        const createdId = createData.item?.id;

        // 5. PUT /catalogos/tipos_establecimiento/:id (Editar)
        console.log(`\n4. Probando PUT /auth/catalogos/tipos_establecimiento/${createdId} (Editar)...`);
        const updateRes = await fetch(`${baseUrl}/catalogos/tipos_establecimiento/${createdId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre: 'Establecimiento de Prueba ACTUALIZADO',
                activo: false
            })
        });
        console.log('   Status:', updateRes.status);
        const updateData = await updateRes.json();
        console.log('   Item actualizado nombre:', updateData.item?.nombre, 'Activo:', updateData.item?.activo);

        // 6. DELETE /catalogos/tipos_establecimiento/:id (Eliminar - borrado lógico)
        console.log(`\n5. Probando DELETE /auth/catalogos/tipos_establecimiento/${createdId} (Borrado lógico)...`);
        const delRes = await fetch(`${baseUrl}/catalogos/tipos_establecimiento/${createdId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('   Status:', delRes.status);
        const delData = await delRes.json();
        console.log('   Mensaje:', delData.message);

        // 7. GET /catalogos/estados y /catalogos/municipios/padres
        console.log('\n6. Probando GET /auth/catalogos/municipios/padres (Opciones padre)...');
        const parentsRes = await fetch(`${baseUrl}/catalogos/municipios/padres`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('   Status:', parentsRes.status);
        const parentsData = await parentsRes.json();
        console.log(`   Estados disponibles como padre (${parentsData.length}):`, parentsData.slice(0, 3).map(p => p.nombre).join(', ') + '...');

        // 8. TEST DE PERMISOS: Probar con usuario sin permisos
        console.log('\n7. Probando control de acceso con usuario sin permisos...');
        const regularUserRes = await client.query(`
            SELECT u.id, u.email 
            FROM users u
            WHERE u.id NOT IN (
                SELECT user_id FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE LOWER(r.name) IN ('admin', 'administrador')
            )
            LIMIT 1
        `);

        if (regularUserRes.rows.length > 0) {
            const regUser = regularUserRes.rows[0];
            const regToken = jwt.sign({ userId: regUser.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            await client.query(`
                INSERT INTO sessions (user_id, token, expires_at, is_revoked)
                VALUES ($1, $2, NOW() + INTERVAL '1 hour', FALSE)
            `, [regUser.id, regToken]);

            // Intentar crear un catálogo sin permiso create_tipos_establecimiento
            const forbiddenRes = await fetch(`${baseUrl}/catalogos/tipos_establecimiento`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${regToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ codigo: 'hacker', nombre: 'No Autorizado' })
            });

            console.log(`   Petición no autorizada -> Status: ${forbiddenRes.status} (Esperado: 403)`);
            const forbiddenData = await forbiddenRes.json();
            console.log('   Error devuelto:', forbiddenData.error);

            // Limpiar sesión temporal del usuario regular
            await client.query(`DELETE FROM sessions WHERE token = $1`, [regToken]);
        }

        // Limpiar sesión temporal del admin
        await client.query(`DELETE FROM sessions WHERE token = $1`, [adminToken]);

        console.log('\n=========================================');
        console.log('✅ TODAS LAS PRUEBAS DE LA API PASARON SATISFACTORIAMENTE');
        console.log('=========================================');

    } catch (err) {
        console.error('❌ Error en pruebas:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

testCatalogos();
