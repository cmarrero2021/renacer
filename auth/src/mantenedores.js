const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticate } = require('./middlewares');
const { withAuditContext } = require('./audit');

// Configuración de tablas permitidas y sus campos
const TABLAS_CONFIG = {
    areas_conocimiento: {
        tabla: 'areas_conocimiento',
        campos: ['area_conocimiento'],
        campoNombre: 'area_conocimiento',
        softDelete: true
    },
    editoriales: {
        tabla: 'editoriales',
        campos: ['editorial', 'url'],
        campoNombre: 'editorial',
        softDelete: true
    },
    estados: {
        tabla: 'estados',
        campos: ['estado', 'iso_3166_2'],
        campoNombre: 'estado',
        softDelete: false
    },
    formatos: {
        tabla: 'formatos',
        campos: ['formato'],
        campoNombre: 'formato',
        softDelete: true
    },
    idiomas: {
        tabla: 'idiomas',
        campos: ['idioma', 'iso'],
        campoNombre: 'idioma',
        softDelete: true
    },
    indices: {
        tabla: 'indices',
        campos: ['indice'],
        campoNombre: 'indice',
        softDelete: true
    },
    periodicidad: {
        tabla: 'periodicidad',
        campos: ['periodicidad'],
        campoNombre: 'periodicidad',
        softDelete: true
    }
};

// Middleware para validar tabla
const validarTabla = (req, res, next) => {
    const { tabla } = req.params;
    if (!TABLAS_CONFIG[tabla]) {
        return res.status(400).json({ error: 'Tabla no válida', tablas_permitidas: Object.keys(TABLAS_CONFIG) });
    }
    req.tablaConfig = TABLAS_CONFIG[tabla];
    next();
};

// GET - Listar todos los registros de una tabla (público)
router.get('/:tabla', validarTabla, async (req, res) => {
    const { tabla } = req.params;
    const config = req.tablaConfig;

    const client = await pool.connect();
    try {
        let query = `SELECT id, ${config.campos.join(', ')}`;

        if (config.softDelete) {
            query += ', created_at, updated_at, deleted_at';
        }

        query += ` FROM ${config.tabla}`;

        if (config.softDelete) {
            query += ' WHERE deleted_at IS NULL';
        }

        query += ` ORDER BY ${config.campoNombre}`;

        const result = await client.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error(`Error al obtener ${tabla}:`, error);
        res.status(500).json({ error: 'Error al obtener registros', details: error.message });
    } finally {
        client.release();
    }
});

// GET - Obtener un registro por ID (público)
router.get('/:tabla/:id', validarTabla, async (req, res) => {
    const { tabla, id } = req.params;
    const config = req.tablaConfig;

    const client = await pool.connect();
    try {
        let query = `SELECT id, ${config.campos.join(', ')}`;

        if (config.softDelete) {
            query += ', created_at, updated_at, deleted_at';
        }

        query += ` FROM ${config.tabla} WHERE id = $1`;

        if (config.softDelete) {
            query += ' AND deleted_at IS NULL';
        }

        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Error al obtener ${tabla}/${id}:`, error);
        res.status(500).json({ error: 'Error al obtener registro', details: error.message });
    } finally {
        client.release();
    }
});

// POST - Crear nuevo registro (requiere autenticación)
router.post('/:tabla', authenticate, validarTabla, async (req, res) => {
    const { tabla } = req.params;
    const config = req.tablaConfig;

    const client = await pool.connect();
    try {
        await withAuditContext(client, req);
        const valores = [];
        const campos = [];
        const placeholders = [];

        config.campos.forEach((campo, index) => {
            if (req.body[campo] !== undefined) {
                campos.push(campo);
                valores.push(req.body[campo]);
                placeholders.push(`$${index + 1}`);
            }
        });

        if (campos.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos válidos', campos_requeridos: config.campos });
        }

        const query = `INSERT INTO ${config.tabla} (${campos.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, ${config.campos.join(', ')}`;

        const result = await client.query(query, valores);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(`Error al crear en ${tabla}:`, error);

        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un registro con ese valor', details: error.detail });
        }

        res.status(500).json({ error: 'Error al crear registro', details: error.message });
    } finally {
        client.release();
    }
});

// PUT - Actualizar registro (requiere autenticación)
router.put('/:tabla/:id', authenticate, validarTabla, async (req, res) => {
    const { tabla, id } = req.params;
    const config = req.tablaConfig;

    const client = await pool.connect();
    try {
        await withAuditContext(client, req);
        const updates = [];
        const valores = [];
        let paramIndex = 1;

        config.campos.forEach((campo) => {
            if (req.body[campo] !== undefined) {
                updates.push(`${campo} = $${paramIndex}`);
                valores.push(req.body[campo]);
                paramIndex++;
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar', campos_permitidos: config.campos });
        }

        if (config.softDelete) {
            updates.push(`updated_at = NOW()`);
        }

        valores.push(id);

        let query = `UPDATE ${config.tabla} SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

        if (config.softDelete) {
            query += ' AND deleted_at IS NULL';
        }

        query += ` RETURNING id, ${config.campos.join(', ')}`;

        const result = await client.query(query, valores);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Error al actualizar ${tabla}/${id}:`, error);

        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un registro con ese valor', details: error.detail });
        }

        res.status(500).json({ error: 'Error al actualizar registro', details: error.message });
    } finally {
        client.release();
    }
});

// DELETE - Eliminar registro (requiere autenticación)
router.delete('/:tabla/:id', authenticate, validarTabla, async (req, res) => {
    const { tabla, id } = req.params;
    const config = req.tablaConfig;

    const client = await pool.connect();
    try {
        await withAuditContext(client, req);
        let query;

        if (config.softDelete) {
            query = `UPDATE ${config.tabla} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`;
        } else {
            query = `DELETE FROM ${config.tabla} WHERE id = $1 RETURNING id`;
        }

        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ message: 'Registro eliminado correctamente', id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar el registro porque está siendo utilizado en otras tablas',
                details: error.detail
            });
        }

        res.status(500).json({ error: 'Error al eliminar registro', details: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
