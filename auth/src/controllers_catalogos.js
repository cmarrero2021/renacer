// src/controllers_catalogos.js
// Controlador para la gestión unificada de Catálogos con permisos granulares
const pool = require('./db');
const { withAuditContext } = require('./audit');
const { broadcastCatalogUpdate } = require('./websocket');

// Whitelist y configuración de esquemas para cada catálogo de negocio
const CATALOGS_CONFIG = {
    tipos_establecimiento: {
        key: 'tipos_establecimiento',
        tableName: 'public.tipos_establecimiento',
        resource: 'tipos_establecimiento',
        label: 'Tipos de Establecimiento',
        icon: 'domain',
        description: 'Clasificación institucional del centro (Público, Privado, etc.)',
        primaryKey: 'id',
        columns: [
            { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
            { name: 'codigo', label: 'Código', field: 'codigo', sortable: true, align: 'left', required: true },
            { name: 'nombre', label: 'Nombre', field: 'nombre', sortable: true, align: 'left', required: true },
            { name: 'descripcion', label: 'Descripción', field: 'descripcion', sortable: true, align: 'left' },
            { name: 'activo', label: 'Estado', field: 'activo', sortable: true, align: 'center' },
            { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
        ],
        searchColumns: ['codigo', 'nombre', 'descripcion'],
        fields: ['codigo', 'nombre', 'descripcion', 'activo'],
        requiredFields: ['codigo', 'nombre'],
        orderBy: 'nombre ASC'
    },
    tipos_clasificacion: {
        key: 'tipos_clasificacion',
        tableName: 'public.tipos_clasificacion',
        resource: 'tipos_clasificacion',
        label: 'Tipos de Clasificación',
        icon: 'apartment',
        description: 'Tipología operativa (Geriátrico, Casa Hogar, Fundación, etc.)',
        primaryKey: 'id',
        columns: [
            { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
            { name: 'codigo', label: 'Código', field: 'codigo', sortable: true, align: 'left', required: true },
            { name: 'nombre', label: 'Nombre', field: 'nombre', sortable: true, align: 'left', required: true },
            { name: 'descripcion', label: 'Descripción', field: 'descripcion', sortable: true, align: 'left' },
            { name: 'activo', label: 'Estado', field: 'activo', sortable: true, align: 'center' },
            { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
        ],
        searchColumns: ['codigo', 'nombre', 'descripcion'],
        fields: ['codigo', 'nombre', 'descripcion', 'activo'],
        requiredFields: ['codigo', 'nombre'],
        orderBy: 'nombre ASC'
    },
    tipos_documentos: {
        key: 'tipos_documentos',
        tableName: 'public.tipos_documentos',
        resource: 'tipos_documentos',
        label: 'Tipos de Documentos',
        icon: 'folder_shared',
        description: 'Requisitos y documentos consignables para la ficha',
        primaryKey: 'id',
        columns: [
            { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
            { name: 'codigo', label: 'Código', field: 'codigo', sortable: true, align: 'left', required: true },
            { name: 'nombre', label: 'Nombre', field: 'nombre', sortable: true, align: 'left', required: true },
            { name: 'descripcion', label: 'Descripción', field: 'descripcion', sortable: true, align: 'left' },
            { name: 'activo', label: 'Estado', field: 'activo', sortable: true, align: 'center' },
            { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
        ],
        searchColumns: ['codigo', 'nombre', 'descripcion'],
        fields: ['codigo', 'nombre', 'descripcion', 'activo'],
        requiredFields: ['codigo', 'nombre'],
        orderBy: 'nombre ASC'
    },
    servicios_catalogo: {
        key: 'servicios_catalogo',
        tableName: 'public.servicios_catalogo',
        resource: 'servicios_catalogo',
        label: 'Catálogo de Servicios',
        icon: 'medical_services',
        description: 'Servicios asistenciales, recreativos y de salud',
        primaryKey: 'id',
        columns: [
            { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
            { name: 'codigo', label: 'Código', field: 'codigo', sortable: true, align: 'left', required: true },
            { name: 'nombre', label: 'Nombre', field: 'nombre', sortable: true, align: 'left', required: true },
            { name: 'categoria', label: 'Categoría', field: 'categoria', sortable: true, align: 'left' },
            { name: 'descripcion', label: 'Descripción', field: 'descripcion', sortable: true, align: 'left' },
            { name: 'activo', label: 'Estado', field: 'activo', sortable: true, align: 'center' },
            { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
        ],
        searchColumns: ['codigo', 'nombre', 'categoria', 'descripcion'],
        fields: ['codigo', 'nombre', 'categoria', 'descripcion', 'activo'],
        requiredFields: ['codigo', 'nombre'],
        orderBy: 'nombre ASC'
    }
};

/**
 * Validador de permisos específicos para catálogos
 */
function checkCatalogPermission(req, catalogKey, action) {
    // 1. Si es Administrador, tiene acceso total
    const isAdmin = (req.roles || []).some(r => ['admin', 'administrador', 'administrator'].includes(r.toLowerCase()));
    if (isAdmin) return true;

    const config = CATALOGS_CONFIG[catalogKey];
    if (!config) return false;

    const userPerms = req.permissions || [];

    // Verificación por acción
    if (action === 'view') {
        return userPerms.includes(`view_${catalogKey}`) || userPerms.includes(`view_${config.resource}`);
    }
    if (action === 'create') {
        return userPerms.includes(`create_${catalogKey}`) || userPerms.includes(`create_${config.resource}`);
    }
    if (action === 'edit' || action === 'update') {
        return userPerms.includes(`edit_${catalogKey}`) ||
               userPerms.includes(`update_${catalogKey}`) ||
               userPerms.includes(`edit_${config.resource}`) ||
               userPerms.includes(`update_${config.resource}`);
    }
    if (action === 'delete') {
        return userPerms.includes(`delete_${catalogKey}`) || userPerms.includes(`delete_${config.resource}`);
    }

    return false;
}

// ─── 1. METADATA DE CATÁLOGOS DISPONIBLES ────────────────────────────────────
exports.listCatalogoMeta = async (req, res) => {
    try {
        const result = [];
        for (const [key, cfg] of Object.entries(CATALOGS_CONFIG)) {
            const hasView = checkCatalogPermission(req, key, 'view');
            const hasCreate = checkCatalogPermission(req, key, 'create');
            const hasEdit = checkCatalogPermission(req, key, 'edit');
            const hasDelete = checkCatalogPermission(req, key, 'delete');

            result.push({
                key,
                label: cfg.label,
                icon: cfg.icon,
                description: cfg.description,
                parentCatalog: cfg.parentCatalog || null,
                parentLabel: cfg.parentLabel || null,
                columns: cfg.columns,
                fields: cfg.fields,
                requiredFields: cfg.requiredFields,
                permissions: {
                    canView: hasView,
                    canCreate: hasCreate,
                    canEdit: hasEdit,
                    canDelete: hasDelete
                }
            });
        }
        res.json(result);
    } catch (err) {
        console.error('Error in listCatalogoMeta:', err);
        res.status(500).json({ error: 'Error al obtener metadatos de catálogos' });
    }
};

// ─── 2. LISTAR REGISTROS DE UN CATÁLOGO ──────────────────────────────────────
exports.listCatalogo = async (req, res) => {
    const { catalogo } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config) {
        return res.status(404).json({ error: `Catálogo '${catalogo}' no encontrado en el sistema.` });
    }

    if (!checkCatalogPermission(req, catalogo, 'view')) {
        return res.status(403).json({ error: `No tienes permiso para ver el catálogo '${config.label}'.` });
    }

    const {
        search = '',
        page = 1,
        limit = 20,
        sort_by = null,
        descending = 'false',
        parent_id = null,
        include_deleted = 'false'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const client = await pool.connect();
    try {
        let whereClauses = [];
        let params = [];

        // Filtro de borrado lógico
        if (include_deleted !== 'true') {
            whereClauses.push(`${config.tableName}.deleted_at IS NULL`);
        }

        // Filtro por relación padre si aplica
        if (parent_id && config.parentKey) {
            params.push(parseInt(parent_id, 10));
            whereClauses.push(`${config.tableName}.${config.parentKey} = $${params.length}`);
        }

        // Búsqueda textual
        if (search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const pIdx = params.length;
            const searchOrs = config.searchColumns.map(col => `LOWER(CAST(${col} AS TEXT)) LIKE $${pIdx}`);
            whereClauses.push(`(${searchOrs.join(' OR ')})`);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Construir SELECT con JOINs
        let selectCols = [`${config.tableName}.*`];
        let joinSql = '';

        if (config.joins && config.joins.length > 0) {
            for (const j of config.joins) {
                selectCols.push(j.select);
                joinSql += ` LEFT JOIN ${j.table} ${j.alias} ON ${j.on} `;
            }
        }

        // Ordenamiento
        let orderSql = config.orderBy ? `ORDER BY ${config.orderBy}` : 'ORDER BY id ASC';
        if (sort_by) {
            const isDesc = descending === 'true';
            orderSql = `ORDER BY ${config.tableName}.${sort_by} ${isDesc ? 'DESC' : 'ASC'}`;
        }

        // 1. Conteo total
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM ${config.tableName}
            ${joinSql}
            ${whereSql}
        `;
        const countRes = await client.query(countQuery, params);
        const total = parseInt(countRes.rows[0].total, 10);

        // 2. Consulta de datos
        const dataQuery = `
            SELECT ${selectCols.join(', ')}
            FROM ${config.tableName}
            ${joinSql}
            ${whereSql}
            ${orderSql}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const dataRes = await client.query(dataQuery, [...params, limitNum, offset]);

        res.json({
            catalogo,
            label: config.label,
            total,
            page: pageNum,
            limit: limitNum,
            data: dataRes.rows,
            permissions: {
                canCreate: checkCatalogPermission(req, catalogo, 'create'),
                canEdit: checkCatalogPermission(req, catalogo, 'edit'),
                canDelete: checkCatalogPermission(req, catalogo, 'delete')
            }
        });
    } catch (err) {
        console.error(`Error listing catalog ${catalogo}:`, err);
        res.status(500).json({ error: `Error al obtener datos del catálogo ${config.label}`, detail: err.message });
    } finally {
        client.release();
    }
};

// ─── 3. OBTENER UN REGISTRO POR ID ──────────────────────────────────────────
exports.getCatalogoItem = async (req, res) => {
    const { catalogo, id } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config) {
        return res.status(404).json({ error: `Catálogo '${catalogo}' no encontrado.` });
    }

    if (!checkCatalogPermission(req, catalogo, 'view')) {
        return res.status(403).json({ error: `No tienes permiso para ver este registro.` });
    }

    const client = await pool.connect();
    try {
        let selectCols = [`${config.tableName}.*`];
        let joinSql = '';

        if (config.joins && config.joins.length > 0) {
            for (const j of config.joins) {
                selectCols.push(j.select);
                joinSql += ` LEFT JOIN ${j.table} ${j.alias} ON ${j.on} `;
            }
        }

        const query = `
            SELECT ${selectCols.join(', ')}
            FROM ${config.tableName}
            ${joinSql}
            WHERE ${config.tableName}.id = $1
        `;
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error getting item from ${catalogo}:`, err);
        res.status(500).json({ error: 'Error al obtener el registro', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── 4. CREAR UN REGISTRO ───────────────────────────────────────────────────
exports.createCatalogoItem = async (req, res) => {
    const { catalogo } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config) {
        return res.status(404).json({ error: `Catálogo '${catalogo}' no encontrado.` });
    }

    if (!checkCatalogPermission(req, catalogo, 'create')) {
        return res.status(403).json({ error: `No tienes permiso para crear registros en '${config.label}'.` });
    }

    // Validar campos requeridos
    for (const reqField of config.requiredFields) {
        if (req.body[reqField] === undefined || req.body[reqField] === null || req.body[reqField] === '') {
            return res.status(400).json({ error: `El campo '${reqField}' es obligatorio.` });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await withAuditContext(client, req);

        const insertFields = [];
        const insertPlaceholders = [];
        const insertValues = [];

        for (const field of config.fields) {
            if (req.body[field] !== undefined) {
                insertFields.push(field);
                insertValues.push(req.body[field]);
                insertPlaceholders.push(`$${insertValues.length}`);
            }
        }

        if (insertFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No se enviaron datos para insertar.' });
        }

        const insertQuery = `
            INSERT INTO ${config.tableName} (${insertFields.join(', ')}, created_at, updated_at)
            VALUES (${insertPlaceholders.join(', ')}, NOW(), NOW())
            RETURNING *
        `;

        const result = await client.query(insertQuery, insertValues);
        await client.query('COMMIT');

        // Notificar en tiempo real a clientes WebSocket
        try { broadcastCatalogUpdate(catalogo); } catch (e) { console.error('Error broadcasting catalog update:', e); }

        res.status(201).json({
            message: 'Registro creado exitosamente',
            item: result.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Error creating item in ${catalogo}:`, err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un registro con ese código o nombre único.' });
        }
        res.status(500).json({ error: 'Error al crear el registro', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── 5. EDITAR UN REGISTRO ──────────────────────────────────────────────────
exports.updateCatalogoItem = async (req, res) => {
    const { catalogo, id } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config) {
        return res.status(404).json({ error: `Catálogo '${catalogo}' no encontrado.` });
    }

    if (!checkCatalogPermission(req, catalogo, 'edit')) {
        return res.status(403).json({ error: `No tienes permiso para editar registros en '${config.label}'.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await withAuditContext(client, req);

        // Verificar existencia
        const checkRes = await client.query(`SELECT id FROM ${config.tableName} WHERE id = $1`, [id]);
        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado para actualizar.' });
        }

        const updateSets = [];
        const updateValues = [];

        for (const field of config.fields) {
            if (req.body[field] !== undefined) {
                updateValues.push(req.body[field]);
                updateSets.push(`${field} = $${updateValues.length}`);
            }
        }

        if (updateSets.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No se enviaron datos para actualizar.' });
        }

        updateSets.push('updated_at = NOW()');
        updateValues.push(id);

        const updateQuery = `
            UPDATE ${config.tableName}
            SET ${updateSets.join(', ')}
            WHERE id = $${updateValues.length}
            RETURNING *
        `;

        const result = await client.query(updateQuery, updateValues);
        await client.query('COMMIT');

        // Notificar en tiempo real a clientes WebSocket
        try { broadcastCatalogUpdate(catalogo); } catch (e) { console.error('Error broadcasting catalog update:', e); }

        res.json({
            message: 'Registro actualizado correctamente',
            item: result.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Error updating item in ${catalogo}:`, err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un registro con ese código o nombre único.' });
        }
        res.status(500).json({ error: 'Error al actualizar el registro', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── 6. ELIMINAR UN REGISTRO (BORRADO LÓGICO) ────────────────────────────────
exports.deleteCatalogoItem = async (req, res) => {
    const { catalogo, id } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config) {
        return res.status(404).json({ error: `Catálogo '${catalogo}' no encontrado.` });
    }

    if (!checkCatalogPermission(req, catalogo, 'delete')) {
        return res.status(403).json({ error: `No tienes permiso para eliminar registros en '${config.label}'.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await withAuditContext(client, req);

        // Borrado lógico
        const deleteQuery = `
            UPDATE ${config.tableName}
            SET deleted_at = NOW(), activo = FALSE
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id
        `;

        const result = await client.query(deleteQuery, [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado o ya eliminado.' });
        }

        await client.query('COMMIT');

        // Notificar en tiempo real a clientes WebSocket
        try { broadcastCatalogUpdate(catalogo); } catch (e) { console.error('Error broadcasting catalog update:', e); }

        res.json({ message: 'Registro eliminado exitosamente (borrado lógico)', id: result.rows[0].id });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Error deleting item from ${catalogo}:`, err);
        res.status(500).json({ error: 'Error al eliminar el registro', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── 7. LISTAR OPCIONES PADRE (PARA SELECTS EN MODALES) ──────────────────────
exports.listParentOptions = async (req, res) => {
    const { catalogo } = req.params;
    const config = CATALOGS_CONFIG[catalogo];

    if (!config || !config.parentCatalog) {
        return res.json([]);
    }

    const parentConfig = CATALOGS_CONFIG[config.parentCatalog];
    if (!parentConfig) {
        return res.json([]);
    }

    const client = await pool.connect();
    try {
        const query = `
            SELECT id, nombre
            FROM ${parentConfig.tableName}
            WHERE deleted_at IS NULL AND activo = TRUE
            ORDER BY nombre ASC
        `;
        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in listParentOptions:', err);
        res.status(500).json({ error: 'Error al obtener opciones padre', detail: err.message });
    } finally {
        client.release();
    }
};
