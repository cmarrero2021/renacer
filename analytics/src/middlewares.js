const jwt = require('jsonwebtoken');
const pool = require('./db');

exports.authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.' });
        }
        return res.status(401).json({ error: 'Token inválido.' });
    }
    req.userId = decoded.userId;

    let client;
    try {
        client = await pool.connect();
        const sessionResult = await client.query(
            'SELECT expires_at FROM sessions WHERE token = $1 AND is_revoked = FALSE',
            [token]
        );

        if (!sessionResult.rows.length) {
            return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
        }

        const blacklistResult = await client.query(
            'SELECT 1 FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        if (blacklistResult.rows.length) {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
        }

        if (new Date() > new Date(sessionResult.rows[0].expires_at)) {
            return res.status(401).json({ error: 'La sesión ha expirado.' });
        }

        try {
            const permResult = await client.query(`
                SELECT
                    COALESCE(
                        (SELECT ARRAY_AGG(DISTINCT r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1),
                        ARRAY[]::text[]
                    ) AS roles,
                    COALESCE(
                        (SELECT ARRAY_AGG(DISTINCT perms.name) FROM (
                            SELECT p.name FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = $1
                            UNION
                            SELECT p.name FROM user_roles ur JOIN role_permissions rp ON ur.role_id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = $1
                        ) perms),
                        ARRAY[]::text[]
                    ) AS permissions
            `, [req.userId]);
            req.roles = permResult.rows[0]?.roles || [];
            req.permissions = permResult.rows[0]?.permissions || [];
        } catch (permErr) {
            console.error('⚠️ Error cargando roles/permisos:', permErr.message);
            req.roles = [];
            req.permissions = [];
        }

        next();
    } catch (err) {
        console.error('Error en authenticate:', err.message);
        return res.status(500).json({ error: 'Error al verificar la autenticación.' });
    } finally {
        if (client) client.release();
    }
};

exports.authorize = (requiredPermission) => {
    return (req, res, next) => {
        if (req.roles.some(r => r.toLowerCase() === 'admin' || r.toLowerCase() === 'administrador')) {
            return next();
        }
        if (!req.permissions.includes(requiredPermission)) {
            return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
        }
        next();
    };
};
