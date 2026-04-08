const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { fakerES: faker } = require('@faker-js/faker');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

const TOTAL_RECORDS = 500;
const CENTRAL_STATES = [1, 5, 8, 15, 22];

async function runSeeder() {
    const client = await pool.connect();
    console.log(`Starting comprehensive seeder: Generating ${TOTAL_RECORDS} centros...`);
    try {
        await client.query('BEGIN');
        
        console.log("Database already emptied safely. Proceeding to seed...");
        
        const req = await client.query(`
            SELECT parish_id AS parroquia_id, estado 
            FROM public.geografia 
            WHERE geom IS NOT NULL AND parish_id IS NOT NULL
        `);
        
        let centralParroquias = [];
        let otherParroquias = [];
        const centralNames = ['ARAGUA', 'CARABOBO', 'MIRANDA', 'DISTRITO CAPITAL', 'LA GUAIRA', 'VARGAS'];
        
        for (const row of req.rows) {
            const isCentral = centralNames.some(name => row.estado && row.estado.toUpperCase().includes(name));
            if (isCentral) {
                centralParroquias.push(row.parroquia_id);
            } else {
                otherParroquias.push(row.parroquia_id);
            }
        }
        
        const prefixes = ['Hospital', 'Clínica', 'Ambulatorio', 'Centro Médico', 'Maternidad', 'Polideportivo', 'Unidad Sanitaria', 'Geriátrico', 'Residencia'];
        const types = ['publico', 'afiliada_ivss', 'privado', 'religiosa', 'otra'];
        
        let inserted = 0;
        
        for (let i = 0; i < TOTAL_RECORDS; i++) {
            const isCentral = Math.random() < 0.7;
            const parroquiaId = (isCentral && centralParroquias.length > 0) ? faker.helpers.arrayElement(centralParroquias) : faker.helpers.arrayElement(otherParroquias);
            
            const prefix = faker.helpers.arrayElement(prefixes);
            const name = `${prefix} ${faker.person.lastName()}`;
            const rif = faker.helpers.arrayElement(['J-', 'G-']) + faker.string.numeric(9);
            const tipo = faker.helpers.arrayElement(types);
            const status = faker.helpers.arrayElement(['activo', 'activo', 'inactivo']);
            
            // Generate spatial coordinates inside the Parish polygon
            let lat = null, lng = null;
            try {
                const ptResult = await client.query(`SELECT ST_Y(geom) as latitud, ST_X(geom) as longitud FROM (SELECT (ST_Dump(ST_GeneratePoints(geom, 1))).geom FROM public.geografia WHERE parish_id = $1) AS pt`, [parroquiaId]);
                if (ptResult.rows.length) {
                    lat = ptResult.rows[0].latitud;
                    lng = ptResult.rows[0].longitud;
                }
            } catch (e) {
                console.error("Error generating point for parish " + parroquiaId, e.message);
            }

            // Insert Centro with location
            const centroRes = await client.query(`
                INSERT INTO centros (nombre_establecimiento, parroquia_id, rif, tipo_establecimiento, estado_centro, latitud, longitud, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id
            `, [name, parroquiaId, rif, tipo, status, lat, lng]);
            
            const centroId = centroRes.rows[0].id;
            
            // Insert correos/telefonos
            await client.query(`INSERT INTO centro_correos (centro_id, correo, tipo) VALUES ($1, $2, $3)`, [centroId, faker.internet.email(), 'institucional']);
            await client.query(`INSERT INTO centro_telefonos (centro_id, telefono, tipo) VALUES ($1, $2, $3)`, [centroId, faker.phone.number(), 'general']);
            
            // Insert Propietario & Representante
            await client.query(`INSERT INTO centro_propietarios (centro_id, nombre, cedula_tipo, cedula_nro, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`, 
                               [centroId, faker.company.name(), faker.helpers.arrayElement(['J', 'V', 'G']), faker.string.numeric(8)]);
            
            await client.query(`INSERT INTO centro_representantes (centro_id, nombre, cedula_tipo, cedula_nro, cargo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, 
                               [centroId, faker.person.fullName(), faker.helpers.arrayElement(['V', 'E']), faker.string.numeric(8), faker.person.jobTitle()]);

            // Insert Fichas Establecimiento
            const solOptions = ['registro_autorizacion', 'renovacion_autorizacion'];
            const fichaRes = await client.query(`
                INSERT INTO fichas_establecimiento (centro_id, version, fecha_solicitud, nro_registro_nacional, tipo_solicitud, fecha_fundacion, costo_mensual, direccion, is_current, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id
            `, [centroId, 1, faker.date.recent(), faker.string.numeric(6), faker.helpers.arrayElement(solOptions), faker.date.past(), faker.finance.amount(), faker.location.streetAddress(), true]);
            
            const fichaId = fichaRes.rows[0].id;
            
            // Insert Ficha Infraestructura
            await client.query(`
                INSERT INTO ficha_infraestructura (ficha_id, estado_inmueble, num_dormitorios, dormitorios_adecuados, num_sanitarios, sanitarios_adecuados, tiene_area_cocina, cocina_adecuada, ventilacion_adecuada, iluminacion_adecuada, capacidad_comedor_pct, luz_electrica, agua_potable, agua_servidas, deposito_basura, sistema_seguridad, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
            `, [fichaId, faker.helpers.arrayElement(['excelente', 'bueno', 'deficiente']), faker.number.int({min:1, max:20}), faker.datatype.boolean(), faker.number.int({min:1, max:10}), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.number.int({min:50, max:100}), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean()]);

            // Insert Ficha Personal
            await client.query(`
                INSERT INTO ficha_personal (ficha_id, num_medicos_geriatra, num_medicos_psiquiatra, num_enfermeros, num_cuidadores, num_camareros, num_auxiliares_enfermeria, num_servicios_generales, num_personal_cocina, num_personal_no_adscrito, posee_expediente_curricular, otros_personal, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            `, [fichaId, faker.number.int({min:0, max:5}), faker.number.int({min:0, max:5}), faker.number.int({min:1, max:15}), faker.number.int({min:0, max:20}), faker.number.int({min:0, max:10}), faker.number.int({min:0, max:10}), faker.number.int({min:0, max:5}), faker.number.int({min:1, max:5}), 0, faker.datatype.boolean(), false]);

            // Insert Ficha Poblacion
            const cat = faker.helpers.arrayElement(['adultos', 'con_discapacidad', 'otras_categorias']);
            const mld = faker.helpers.arrayElement(['residente', 'ambulatoria']);
            const f = faker.number.int({min:5, max:50}); 
            const m = faker.number.int({min:5, max:50});
            await client.query(`
                INSERT INTO ficha_poblacion (ficha_id, fecha_corte, modalidad, categoria, femenino, masculino, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [fichaId, faker.date.recent(), mld, cat, f, m]);

            // Insert Ficha Servicios
            await client.query(`
                INSERT INTO ficha_servicios (ficha_id, farmacia, evaluacion_nutricional, actividades_recreativas, servicio_emergencia, servicio_funerario, medicos, lavanderia, barberia_peluqueria, otros, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            `, [fichaId, faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), faker.datatype.boolean(), false]);

            // Insert Ficha Capacidad
            const capacidadTotal = faker.number.int({min: 10, max: 100});
            const capacidadActual = faker.number.int({min: 1, max: capacidadTotal});
            const tieneAmbulatoria = faker.datatype.boolean();
            await client.query(`
                INSERT INTO ficha_capacidad (ficha_id, capacidad_total_residente, atencion_ambulatoria, capacidad_actual_residente, num_atencion_ambulatoria, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            `, [fichaId, capacidadTotal, tieneAmbulatoria, capacidadActual, tieneAmbulatoria ? faker.number.int({min: 0, max: 50}) : 0]);

            // Insert Ficha Documentos (one row per document type from the allowed list)
            const docTypes = [
                'carta_solicitud', 'copia_cedula_propietario', 'registro_mercantil',
                'rif', 'documento_inmueble', 'conformidad_uso',
                'permiso_sanitario_local', 'permiso_sanitario_alimentos', 'plano_inmueble'
            ];
            for (const docTipo of docTypes) {
                const tieneOriginal = faker.datatype.boolean();
                const tieneCopia = !tieneOriginal || faker.datatype.boolean();
                await client.query(`
                    INSERT INTO ficha_documentos (ficha_id, tipo_documento, tiene_original, tiene_copia, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, NOW(), NOW())
                `, [fichaId, docTipo, tieneOriginal, tieneCopia]);
            }

            inserted++;

            if (inserted % 50 === 0) console.log(`Planted ${inserted} comprehensive seeds...`);
        }

        await client.query('COMMIT');
        console.log(`✅ Success! Seeded ${inserted} centros along with all their related fichas.`);
        
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("❌ Error running seeder:\n", err);
    } finally {
        await client.release();
        await pool.end();
    }
}

runSeeder();
