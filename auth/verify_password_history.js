const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '.env.development') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

async function verify() {
    const client = await pool.connect();
    try {
        // 1. Encontrar o crear un usuario de prueba
        const userRes = await client.query("SELECT id, email, password_hash FROM users WHERE email = 'test_history@example.com'");
        let user;
        if (userRes.rows.length === 0) {
            const hash = await bcrypt.hash('InitialPass123!', 10);
            const insertRes = await client.query(
                "INSERT INTO users (first_name, last_name, email, password_hash, status, cedula) VALUES ('Test', 'History', 'test_history@example.com', $1, 'active', '99999999') RETURNING id, email, password_hash",
                [hash]
            );
            user = insertRes.rows[0];
            console.log("Created test user:", user.email);
        } else {
            user = userRes.rows[0];
            console.log("Using existing test user:", user.email);
        }

        const userId = user.id;

        // Limpiar historial previo para el test
        await client.query("DELETE FROM password_history WHERE user_id = $1", [userId]);

        // 2. Simular cambio de password 1 (a 'PassOne123!')
        console.log("\n--- Cambio 1: PassOne123! ---");
        const hash1 = await bcrypt.hash('PassOne123!', 10);
        await client.query("BEGIN");
        // validatePasswordHistory le pasaríamos el hash actual (el que tiene el usuario ahora)
        // Pero aquí simulamos lo que hace el controller:
        // savePasswordToHistory(client, userId, user.password_hash);
        await client.query("INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)", [userId, user.password_hash]);
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash1, userId]);
        await client.query("COMMIT");
        console.log("Password cambiada a PassOne123!");

        // 3. Simular cambio de password 2 (a 'PassTwo123!')
        console.log("\n--- Cambio 2: PassTwo123! ---");
        const currentHash = (await client.query("SELECT password_hash FROM users WHERE id = $1", [userId])).rows[0].password_hash;
        const hash2 = await bcrypt.hash('PassTwo123!', 10);
        await client.query("BEGIN");
        await client.query("INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)", [userId, currentHash]);
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash2, userId]);
        await client.query("COMMIT");
        console.log("Password cambiada a PassTwo123!");

        // 4. Intentar volver a 'PassOne123!' (Debería fallar en el controller real)
        // Aquí verificamos manualmente el historial
        console.log("\n--- Verificando historial para Reuso de 'PassOne123!' ---");
        const historyRes = await client.query("SELECT password_hash FROM password_history WHERE user_id = $1", [userId]);
        console.log("Entradas en historial:", historyRes.rows.length);
        
        let foundMatch = false;
        for (const row of historyRes.rows) {
            if (await comparePassword('PassOne123!', row.password_hash)) {
                foundMatch = true;
                break;
            }
        }
        
        if (foundMatch) {
            console.log("SUCCESS: 'PassOne123!' se encontró en el historial y sería bloqueada.");
        } else {
            console.log("FAILURE: 'PassOne123!' NO se encontró en el historial.");
        }

        // 5. Verificar que la actual también está protegida (PassTwo123!)
        const userNow = (await client.query("SELECT password_hash FROM users WHERE id = $1", [userId])).rows[0];
        const isCurrentMatch = await comparePassword('PassTwo123!', userNow.password_hash);
        if (isCurrentMatch) {
            console.log("SUCCESS: 'PassTwo123!' es la actual y sería bloqueada.");
        } else {
            console.log("FAILURE: 'PassTwo123!' NO coincide con la actual.");
        }

    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

verify();
