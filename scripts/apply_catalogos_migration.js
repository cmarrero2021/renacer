const path = require('path');
const fs = require('fs');
const ambiente = process.platform === 'win32' ? 'development' : 'production';
require(path.resolve(__dirname, '../auth/node_modules/dotenv')).config({ path: path.resolve(__dirname, `../auth/.env.${ambiente}`) });
const pool = require('../auth/src/db');

async function applyMigration() {
    const client = await pool.connect();
    try {
        console.log('1. Ejecutando bd/migration_catalogos.sql...');
        const sqlPath = path.resolve(__dirname, '../bd/migration_catalogos.sql');
        const migrationSql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(migrationSql);
        console.log('   Tablas y permisos creados exitosamente.');

        console.log('2. Sembrando catálogos de negocio...');

        // Tipos de establecimiento
        const tiposEstab = [
            { nombre: 'Público',       descripcion: 'Establecimiento público / estatal',                        requiere_descripcion: false },
            { nombre: 'Afiliada IVSS', descripcion: 'Institución afiliada al IVSS',                               requiere_descripcion: false },
            { nombre: 'Privado',       descripcion: 'Establecimiento privado',                                     requiere_descripcion: false },
            { nombre: 'Religioso',     descripcion: 'Institución de congregación o confesión religiosa',           requiere_descripcion: false },
            { nombre: 'Otra',          descripcion: 'Otro tipo de institución no clasificada',                     requiere_descripcion: true  },
        ];
        for (const item of tiposEstab) {
            await client.query(`
                INSERT INTO public.tipos_establecimiento (nombre, descripcion, requiere_descripcion)
                VALUES ($1, $2, $3)
                ON CONFLICT (nombre) WHERE deleted_at IS NULL
                DO UPDATE SET descripcion = EXCLUDED.descripcion, requiere_descripcion = EXCLUDED.requiere_descripcion
            `, [item.nombre, item.descripcion, item.requiere_descripcion]);
        }

        // Tipos de clasificación
        const tiposClasif = [
            { nombre: 'Geriátrico',              descripcion: 'Atención integral geriátrica' },
            { nombre: 'Gronto-Psiquiátrico',      descripcion: 'Atención geronto-psiquiátrica especializada' },
            { nombre: 'Casa Hogar',               descripcion: 'Residencia y hogar de estadía' },
            { nombre: 'Unidades Gerontológicas',  descripcion: 'Unidades asistenciales gerontológicas' },
            { nombre: 'Fundación',                descripcion: 'Entidad de carácter benéfico o fundacional' },
            { nombre: 'Otras',                    descripcion: 'Otras clasificaciones' },
        ];
        for (const item of tiposClasif) {
            await client.query(`
                INSERT INTO public.tipos_clasificacion (nombre, descripcion)
                VALUES ($1, $2)
                ON CONFLICT (nombre) WHERE deleted_at IS NULL
                DO UPDATE SET descripcion = EXCLUDED.descripcion
            `, [item.nombre, item.descripcion]);
        }

        // Tipos de documentos
        const tiposDocs = [
            { codigo: 'carta_solicitud', nombre: 'Carta de solicitud', descripcion: 'Carta formal de solicitud de registro o trámite' },
            { codigo: 'copia_cedula_propietario', nombre: 'Copia cédula propietario', descripcion: 'Copia de documento de identidad del propietario' },
            { codigo: 'registro_mercantil', nombre: 'Registro mercantil', descripcion: 'Copia de acta constitutiva y registro mercantil' },
            { codigo: 'rif', nombre: 'RIF', descripcion: 'Registro de Información Fiscal actualizado' },
            { codigo: 'documento_inmueble', nombre: 'Documento del inmueble', descripcion: 'Título de propiedad o contrato de arrendamiento' },
            { codigo: 'conformidad_uso', nombre: 'Conformidad de uso', descripcion: 'Permiso municipal o constancia de conformidad de uso' },
            { codigo: 'permiso_sanitario_local', nombre: 'Permiso sanitario local', descripcion: 'Permiso sanitario vigente emitido por autoridad competente' },
            { codigo: 'permiso_sanitario_alimentos', nombre: 'Permiso sanitario alimentos', descripcion: 'Permiso y manipulación higiénica de alimentos' },
            { codigo: 'plano_inmueble', nombre: 'Plano del inmueble', descripcion: 'Planos arquitectónicos o de distribución del establecimiento' },
        ];
        for (const item of tiposDocs) {
            await client.query(`
                INSERT INTO public.tipos_documentos (codigo, nombre, descripcion)
                VALUES ($1, $2, $3)
                ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion
            `, [item.codigo, item.nombre, item.descripcion]);
        }

        // Servicios de catálogo
        // Asegurar UNIQUE(nombre) (idempotente); la migración que elimina codigo la agrega,
        // pero si esta versión antigua ya corrió sin ella, la creamos aquí.
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                     WHERE conname = 'servicios_catalogo_nombre_key'
                       AND conrelid = 'public.servicios_catalogo'::regclass
                ) THEN
                    DELETE FROM public.servicios_catalogo a
                     USING public.servicios_catalogo b
                     WHERE a.nombre = b.nombre AND a.id > b.id;
                    ALTER TABLE public.servicios_catalogo ADD CONSTRAINT servicios_catalogo_nombre_key UNIQUE (nombre);
                END IF;
            END $$;
        `);
        const servicios = [
            { nombre: 'Farmacia', categoria: 'Salud', descripcion: 'Servicio interno de dispensación de medicamentos' },
            { nombre: 'Evaluación Nutricional', categoria: 'Salud / Nutrición', descripcion: 'Seguimiento y control nutricional de los adultos mayores' },
            { nombre: 'Actividades Recreativas', categoria: 'Bienestar', descripcion: 'Talleres, paseos, dinámicas y esparcimiento' },
            { nombre: 'Servicio de Emergencia', categoria: 'Salud', descripcion: 'Atención médica y traslados de urgencia' },
            { nombre: 'Servicio Funerario', categoria: 'Asistencia', descripcion: 'Convenio o servicio de asistencia funeraria' },
            { nombre: 'Médicos', categoria: 'Salud', descripcion: 'Consultas y atención de médicos especialistas' },
            { nombre: 'Lavandería', categoria: 'Servicios Generales', descripcion: 'Lavado y desinfección de lencería y prendas' },
            { nombre: 'Barbería / Peluquería', categoria: 'Cuidado Personal', descripcion: 'Aseo, corte de cabello y estética personal' },
            { nombre: 'Otros Servicios', categoria: 'Otros', descripcion: 'Otros servicios asistenciales' },
        ];
        for (const item of servicios) {
            await client.query(`
                INSERT INTO public.servicios_catalogo (nombre, categoria, descripcion)
                VALUES ($1, $2, $3)
                ON CONFLICT (nombre) DO UPDATE SET categoria = EXCLUDED.categoria, descripcion = EXCLUDED.descripcion
            `, [item.nombre, item.categoria, item.descripcion]);
        }

        console.log('   Catálogos de negocio sembrados.');

        console.log('3. Sembrando catálogos geográficos base (si están vacíos)...');
        // País
        await client.query(`
            INSERT INTO public.pais (id, nombre, codigo_iso)
            VALUES (1, 'Venezuela', 'VEN')
            ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, codigo_iso = EXCLUDED.codigo_iso
        `);

        // Leer datos geográficos del dump 20260428_0726_renacer.sql si existen
        const dumpPath = path.resolve(__dirname, '../bd/20260428_0726_renacer.sql');
        if (fs.existsSync(dumpPath)) {
            const dumpContent = fs.readFileSync(dumpPath, 'utf8');

            // Estados
            const estCount = await client.query('SELECT COUNT(*) FROM public.estados');
            if (parseInt(estCount.rows[0].count, 10) === 0) {
                console.log('   Sembrando estados desde volcado SQL...');
                const matchEst = dumpContent.match(/COPY public\.estados [^\n]+\n([\s\S]*?)\\\.\n/);
                if (matchEst) {
                    const lines = matchEst[1].trim().split('\n');
                    for (const line of lines) {
                        const parts = line.split('\t');
                        if (parts.length >= 7) {
                            const [id, pais_id, nombre, codigo, codigo_ine, codigo_cne, codigo_igsb] = parts;
                            await client.query(`
                                INSERT INTO public.estados (id, pais_id, nombre, codigo, codigo_ine, codigo_cne, codigo_igsb)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (id) DO NOTHING
                            `, [parseInt(id, 10), parseInt(pais_id, 10) || 1, nombre.trim(), codigo.trim() || null, codigo_ine.trim() || null, codigo_cne.trim() || null, codigo_igsb.trim() || null]);
                        }
                    }
                }
            }

            // Municipios
            const munCount = await client.query('SELECT COUNT(*) FROM public.municipios');
            if (parseInt(munCount.rows[0].count, 10) === 0) {
                console.log('   Sembrando municipios desde volcado SQL...');
                const matchMun = dumpContent.match(/COPY public\.municipios [^\n]+\n([\s\S]*?)\\\.\n/);
                if (matchMun) {
                    const lines = matchMun[1].trim().split('\n');
                    for (const line of lines) {
                        const parts = line.split('\t');
                        if (parts.length >= 6) {
                            const [id, estado_id, nombre, codigo_ine, codigo_cne, codigo_igsb] = parts;
                            await client.query(`
                                INSERT INTO public.municipios (id, estado_id, nombre, codigo_ine, codigo_cne, codigo_igsb)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                ON CONFLICT (id) DO NOTHING
                            `, [parseInt(id, 10), parseInt(estado_id, 10), nombre.trim(), codigo_ine.trim() || null, codigo_cne.trim() || null, codigo_igsb.trim() || null]);
                        }
                    }
                }
            }

            // Parroquias
            const parCount = await client.query('SELECT COUNT(*) FROM public.parroquias');
            if (parseInt(parCount.rows[0].count, 10) === 0) {
                console.log('   Sembrando parroquias desde volcado SQL...');
                const matchPar = dumpContent.match(/COPY public\.parroquias [^\n]+\n([\s\S]*?)\\\.\n/);
                if (matchPar) {
                    const lines = matchPar[1].trim().split('\n');
                    for (const line of lines) {
                        const parts = line.split('\t');
                        if (parts.length >= 6) {
                            const [id, municipio_id, nombre, codigo_ine, codigo_cne, codigo_igsb] = parts;
                            await client.query(`
                                INSERT INTO public.parroquias (id, municipio_id, nombre, codigo_ine, codigo_cne, codigo_igsb)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                ON CONFLICT (id) DO NOTHING
                            `, [parseInt(id, 10), parseInt(municipio_id, 10), nombre.trim(), codigo_ine.trim() || null, codigo_cne.trim() || null, codigo_igsb.trim() || null]);
                        }
                    }
                }
            }
        }

        // Actualizar secuencias
        const tables = [
            'pais', 'estados', 'municipios', 'parroquias',
            'tipos_establecimiento', 'tipos_clasificacion', 'tipos_documentos', 'servicios_catalogo'
        ];
        for (const t of tables) {
            await client.query(`
                SELECT setval(pg_get_serial_sequence('public.${t}', 'id'), COALESCE((SELECT MAX(id) FROM public.${t}), 1));
            `);
        }
        console.log('4. Secuencias de ID actualizadas.');

        console.log('\n✅ Migración y datos iniciales de catálogos completados exitosamente.');
    } catch (err) {
        console.error('❌ Error aplicando migración de catálogos:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

applyMigration();
