// analytics/src/controllers_dashboard.js
// CRUD para consultas guardadas
const pool = require('./db');

// ─── Listar consultas guardadas accesibles ────────────────────────────────────
exports.listSavedQueries = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.userId;

        // Obtener roles del usuario
        const roleResult = await client.query(
            `SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = $1`,
            [userId]
        );
        const roleIds = roleResult.rows.map(r => r.role_id);

        // Consultas accesibles:
        // 1. Públicas
        // 2. Creadas por el usuario (propias)
        // 3. Con acceso otorgado por usuario
        // 4. Con acceso otorgado por rol
        const result = await client.query(
            `SELECT sq.*,
                    u.first_name || ' ' || u.last_name AS created_by_name,
                    CASE
                        WHEN sq.created_by = $1 THEN 'owner'
                        WHEN sq.visibility = 'public' THEN 'public'
                        ELSE 'shared'
                    END AS access_type
             FROM public.saved_queries sq
             LEFT JOIN public.users u ON u.id = sq.created_by
             WHERE sq.deleted_at IS NULL
               AND (
                   sq.visibility = 'public'
                   OR sq.created_by = $1
                   OR EXISTS (
                       SELECT 1 FROM public.saved_query_access sqa
                       WHERE sqa.query_id = sq.id AND sqa.user_id = $1
                   )
                   OR EXISTS (
                       SELECT 1 FROM public.saved_query_access sqa
                       WHERE sqa.query_id = sq.id AND sqa.role_id = ANY($2)
                   )
               )
             ORDER BY sq.updated_at DESC`,
            [userId, roleIds.length > 0 ? roleIds : [0]]
        );

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar consultas guardadas', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Obtener consulta guardada por ID ─────────────────────────────────────────
exports.getSavedQuery = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const userId = req.userId;
        const roleResult = await client.query(
            'SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = $1',
            [userId]
        );
        const roleIds = roleResult.rows.map(r => r.role_id);

        const result = await client.query(
            `SELECT sq.*,
                    u.first_name || ' ' || u.last_name AS created_by_name
             FROM public.saved_queries sq
             LEFT JOIN public.users u ON u.id = sq.created_by
             WHERE sq.id = $1 AND sq.deleted_at IS NULL
               AND (
                   sq.visibility = 'public'
                   OR sq.created_by = $2
                   OR EXISTS (SELECT 1 FROM saved_query_access sqa WHERE sqa.query_id = sq.id AND sqa.user_id = $2)
                   OR EXISTS (SELECT 1 FROM saved_query_access sqa WHERE sqa.query_id = sq.id AND sqa.role_id = ANY($3))
               )`,
            [id, userId, roleIds.length > 0 ? roleIds : [0]]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Consulta no encontrada o sin acceso.' });
        }

        // Obtener lista de accesos compartidos
        const accesses = await client.query(
            `SELECT sqa.*, 
                    u.first_name || ' ' || u.last_name AS user_name,
                    r.name AS role_name
             FROM saved_query_access sqa
             LEFT JOIN users u ON u.id = sqa.user_id
             LEFT JOIN roles r ON r.id = sqa.role_id
             WHERE sqa.query_id = $1`,
            [id]
        );

        res.json({
            ...result.rows[0],
            shared_with: accesses.rows,
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener consulta guardada', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Crear consulta guardada ──────────────────────────────────────────────────
exports.createSavedQuery = async (req, res) => {
    const { name, description, graphql_query, graphql_variables, pivot_config, chart_config, visibility } = req.body;
    const client = await pool.connect();
    try {
        if (!name || !pivot_config) {
            return res.status(400).json({ error: 'Nombre y configuración pivote son requeridos.' });
        }

        const result = await client.query(
            `INSERT INTO public.saved_queries (name, description, graphql_query, graphql_variables, pivot_config, chart_config, visibility, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                name,
                description || null,
                graphql_query || '',
                graphql_variables || '{}',
                JSON.stringify(pivot_config),
                JSON.stringify(chart_config || {}),
                visibility || 'private',
                req.userId
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al crear consulta guardada', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Actualizar consulta guardada (solo propietario) ──────────────────────────
exports.updateSavedQuery = async (req, res) => {
    const { id } = req.params;
    const { name, description, graphql_query, graphql_variables, pivot_config, chart_config, visibility } = req.body;
    const client = await pool.connect();
    try {
        // Verificar propiedad
        const existing = await client.query(
            'SELECT created_by FROM public.saved_queries WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Consulta no encontrada.' });
        }
        if (existing.rows[0].created_by !== req.userId) {
            return res.status(403).json({ error: 'Solo el creador puede modificar esta consulta.' });
        }

        const result = await client.query(
            `UPDATE public.saved_queries SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                graphql_query = COALESCE($3, graphql_query),
                graphql_variables = COALESCE($4, graphql_variables),
                pivot_config = COALESCE($5, pivot_config),
                chart_config = COALESCE($6, chart_config),
                visibility = COALESCE($7, visibility),
                updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [
                name || null,
                description !== undefined ? description : null,
                graphql_query || null,
                graphql_variables ? JSON.stringify(graphql_variables) : null,
                pivot_config ? JSON.stringify(pivot_config) : null,
                chart_config ? JSON.stringify(chart_config) : null,
                visibility || null,
                id
            ]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar consulta guardada', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Eliminar consulta guardada (soft delete, solo propietario) ───────────────
exports.deleteSavedQuery = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const existing = await client.query(
            'SELECT created_by FROM public.saved_queries WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Consulta no encontrada.' });
        }
        if (existing.rows[0].created_by !== req.userId) {
            return res.status(403).json({ error: 'Solo el creador puede eliminar esta consulta.' });
        }

        await client.query(
            'UPDATE public.saved_queries SET deleted_at = NOW() WHERE id = $1',
            [id]
        );

        res.json({ message: 'Consulta eliminada correctamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar consulta guardada', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Otorgar acceso a consulta privada ────────────────────────────────────────
exports.grantQueryAccess = async (req, res) => {
    const { id } = req.params;
    const { user_id, role_id } = req.body;
    const client = await pool.connect();
    try {
        // Verificar propiedad
        const existing = await client.query(
            'SELECT created_by FROM public.saved_queries WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Consulta no encontrada.' });
        }
        if (existing.rows[0].created_by !== req.userId) {
            return res.status(403).json({ error: 'Solo el creador puede compartir esta consulta.' });
        }

        if (!user_id && !role_id) {
            return res.status(400).json({ error: 'Debe especificar user_id o role_id.' });
        }

        const result = await client.query(
            `INSERT INTO public.saved_query_access (query_id, user_id, role_id, granted_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [id, user_id || null, role_id || null, req.userId]
        );

        if (!result.rows.length) {
            return res.json({ message: 'El acceso ya había sido otorgado.' });
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al otorgar acceso', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Revocar acceso a consulta privada ────────────────────────────────────────
exports.revokeQueryAccess = async (req, res) => {
    const { id } = req.params;
    const { user_id, role_id } = req.body;
    const client = await pool.connect();
    try {
        const existing = await client.query(
            'SELECT created_by FROM public.saved_queries WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Consulta no encontrada.' });
        }
        if (existing.rows[0].created_by !== req.userId) {
            return res.status(403).json({ error: 'Solo el creador puede revocar acceso.' });
        }

        let deleteQuery;
        let params;
        if (user_id) {
            deleteQuery = 'DELETE FROM public.saved_query_access WHERE query_id = $1 AND user_id = $2';
            params = [id, user_id];
        } else if (role_id) {
            deleteQuery = 'DELETE FROM public.saved_query_access WHERE query_id = $1 AND role_id = $2';
            params = [id, role_id];
        } else {
            return res.status(400).json({ error: 'Debe especificar user_id o role_id.' });
        }

        await client.query(deleteQuery, params);
        res.json({ message: 'Acceso revocado correctamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al revocar acceso', detail: err.message });
    } finally {
        client.release();
    }
};
