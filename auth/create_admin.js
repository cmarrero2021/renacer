const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function createAdmin() {
    const client = await pool.connect();
    try {
        // Check if user already exists
        const existing = await client.query(`SELECT id FROM users WHERE email = $1`, ['admin@correo.com']);
        if (existing.rows.length > 0) {
            console.log(`User already exists with id: ${existing.rows[0].id}`);
            return;
        }

        // Generate a bcrypt hash for the provided password
        const passwordHash = await bcrypt.hash('Aa123456*', 12);

        await client.query('BEGIN');

        const userRes = await client.query(`
            INSERT INTO users (
                first_name, last_name, cedula, email,
                password_hash, status, is_temporary_password,
                session_timeout_min, cooldown_minutes,
                two_factor_enabled, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            RETURNING id
        `, [
            'ADMINISTRADOR', '', 1, 'admin@correo.com',
            passwordHash, 'active', false,
            0, 0,
            false
        ]);

        const userId = userRes.rows[0].id;
        console.log(`Created user with id: ${userId}`);

        // Assign role_id = 1 to this user
        await client.query(`
            INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
        `, [userId, 1]);
        console.log(`Assigned role 1 to user ${userId}`);

        await client.query('COMMIT');
        console.log('✅ Admin user created successfully.');
        console.log(`   ID: ${userId}`);
        console.log('   Email: admin@correo.com');
        console.log('   Password: Aa123456*');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ Error creating admin user:', err.message);
        console.error(err.detail || '');
    } finally {
        client.release();
        await pool.end();
    }
}

createAdmin();
