// analytics/src/middlewares.js
// Middleware de autenticación JWT - verifica contra la BD compartida
const jwt = require('jsonwebtoken');
const pool = require('./db');

/**
 * Authenticate - Verifica el JWT y la sesión activa
 */
exports.authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    const client = await pool.connect();
    try {
        // Verificar blacklist
        const blacklistResult = await client.query(
            'SELECT * FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        if (blacklistResult.rows.length) {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
        }

        // Decodificar JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;

        // Verificar sesión activa
        const sessionResult = await client.query(
            'SELECT expires_at FROM sessions WHERE token = $1 AND is_revoked = FALSE',
            [token]
        );
        if (!sessionResult.rows.length) {
            return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
        }

        const expiresAt = new Date(sessionResult.rows[0].expires_at);
        if (new Date() > expiresAt) {
            return res.status(401).json({ error: 'La sesión ha expirado.' });
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'La sesión ha expirado.' });
        }
        res.status(400).json({ error: 'Token inválido.' });
    } finally {
        client.release();
    }
};

/**
 * Authorize - Verifica permisos (admins bypass)
 */
exports.authorize = (requiredPermission) => {
    return async (req, res, next) => {
        const { userId } = req;
        const client = await pool.connect();
        try {
            // Admins bypass
            const roleResult = await client.query(
                `SELECT r.name FROM user_roles ur
                 JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = $1`,
                [userId]
            );
            const roles = roleResult.rows.map(r => r.name.toLowerCase());
            if (roles.includes('admin') || roles.includes('administrador')) {
                return next();
            }

            // Verificar permiso
            const result = await client.query(
                `SELECT p.name AS permission_name
                 FROM users u
                 JOIN user_roles ur ON u.id = ur.user_id
                 JOIN role_permissions rp ON ur.role_id = rp.role_id
                 JOIN permissions p ON rp.permission_id = p.id
                 WHERE u.id = $1 AND u.deleted_at IS NULL
                 UNION
                 SELECT p.name AS permission_name
                 FROM users u
                 JOIN user_permissions up ON u.id = up.user_id
                 JOIN permissions p ON up.permission_id = p.id
                 WHERE u.id = $1 AND u.deleted_at IS NULL`,
                [userId]
            );

            const userPermissions = result.rows.map(row => row.permission_name);
            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
            }
            next();
        } catch (err) {
            res.status(500).json({ error: 'Error al verificar los permisos.' });
        } finally {
            client.release();
        }
    };
};
