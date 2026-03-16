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
    console.log(`Starting seeder: Generating ${TOTAL_RECORDS} centros...`);
    try {
        // 1. Fetch parroquias categorized by region
        const req = await client.query(`
            SELECT p.id as parroquia_id, m.estado_id 
            FROM parroquias p 
            JOIN municipios m ON p.municipio_id = m.id
        `);
        
        let centralParroquias = [];
        let otherParroquias = [];
        
        for (const row of req.rows) {
            if (CENTRAL_STATES.includes(row.estado_id)) {
                centralParroquias.push(row.parroquia_id);
            } else {
                otherParroquias.push(row.parroquia_id);
            }
        }
        
        console.log(`Found ${centralParroquias.length} central parroquias and ${otherParroquias.length} other parroquias.`);

        // 2. Prepare data generation
        const prefixes = ['Hospital', 'Clínica', 'Ambulatorio', 'Centro Médico', 'Maternidad', 'Polideportivo', 'Unidad Sanitaria'];
        const types = ['publico', 'afiliada_ivss', 'privado', 'religiosa', 'otra'];
        
        await client.query('BEGIN');
        
        let inserted = 0;
        let centralCount = 0;
        let otherCount = 0;

        for (let i = 0; i < TOTAL_RECORDS; i++) {
            // Geographic Selection (70% Central Region)
            const isCentral = Math.random() < 0.7;
            let parroquiaId = null;
            
            if (isCentral && centralParroquias.length > 0) {
                parroquiaId = faker.helpers.arrayElement(centralParroquias);
                centralCount++;
            } else if (otherParroquias.length > 0) {
                parroquiaId = faker.helpers.arrayElement(otherParroquias);
                otherCount++;
            }

            // Generate details
            const prefix = faker.helpers.arrayElement(prefixes);
            const name = `${prefix} ${faker.person.lastName()}`;
            const rif = faker.helpers.arrayElement(['J-', 'G-']) + faker.string.numeric(9);
            const tipo = faker.helpers.arrayElement(types);
            const status = faker.helpers.arrayElement(['activo', 'activo', 'activo', 'inactivo']); // 75% activo

            if (i === 0) {
                console.log(`Debug Insert [1]: name=${name}, parroquiaId=${parroquiaId}, rif=${rif}, tipo_establecimiento=${tipo}, estado_centro=${status}`);
            }

            // Insert into centros
            await client.query(`
                INSERT INTO centros (
                    nombre_establecimiento, 
                    parroquia_id, 
                    rif, 
                    tipo_establecimiento, 
                    estado_centro, 
                    created_at, 
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            `, [name, parroquiaId, rif, tipo, status]);
            inserted++;
            
            if (inserted % 100 === 0) {
                console.log(`Planted ${inserted} seeds...`);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ Success! Seeded ${inserted} centros.`);
        console.log(`📊 Distribution: ${centralCount} in Central Region (~${Math.round((centralCount/inserted)*100)}%), ${otherCount} in Other Regions (~${Math.round((otherCount/inserted)*100)}%)`);

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("❌ Error running seeder:", err);
    } finally {
        await client.release();
        await pool.end();
    }
}

runSeeder();
