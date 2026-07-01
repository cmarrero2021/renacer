const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
    max: parseInt(process.env.DB_POOL_MAX, 10) || 50,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT, 10) || 5000,
    maxUses: parseInt(process.env.DB_POOL_MAX_USES, 10) || 7500,
});

module.exports = pool;
