// src/controllers_centros.js
// Controladores para el módulo de Centros de Atención al Adulto Mayor
const pool = require('./db');
const { withAuditContext } = require('./audit');
const crypto = require('crypto');



// ============================================================
// HELPER: Verifica si un usuario tiene acceso a un centro específico
// requiredLevel: 'read' | 'write' | 'admin'
// ============================================================
async function verifyCentroAccess(userId, centroId, client, requiredLevel = 'read') {
    // 1. Verificar si es administrador nacional (bypass)
    const adminResult = await client.query(
        `SELECT 1 FROM (
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
        [userId]
    );
    if (adminResult.rows.length > 0) return true;

    // 2. Verificar si es el centro propio del usuario
    const ownResult = await client.query(
        'SELECT centro_id FROM users WHERE id = $1 AND centro_id = $2 AND deleted_at IS NULL',
        [userId, centroId]
    );
    if (ownResult.rows.length > 0) return true;

    // 3. Verificar acceso delegado
    const accessLevels = requiredLevel === 'read'
        ? ['read', 'write', 'admin', 'user', 'usuario', 'lectura', 'escritura', 'administrador']
        : (requiredLevel === 'write'
            ? ['write', 'admin', 'escritura', 'administrador']
            : ['admin', 'administrador']);
    const delegatedResult = await client.query(
        `SELECT 1 FROM user_centro_access 
         WHERE user_id = $1 AND centro_id = $2 AND access_level = ANY($3) AND deleted_at IS NULL`,
        [userId, centroId, accessLevels]
    );

    return delegatedResult.rows.length > 0;
}

// ============================================================
// HELPER: Retorna el nivel de acceso efectivo del usuario sobre un centro
// ============================================================
async function getEffectiveAccessLevel(userId, centroId, client) {
    // 1. Administrador nacional -> 'admin'
    const adminResult = await client.query(
        `SELECT 1 FROM (
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
        [userId]
    );
    if (adminResult.rows.length > 0) return 'admin';

    // 2. Propietario -> 'admin'
    const ownResult = await client.query(
        'SELECT 1 FROM users WHERE id = $1 AND centro_id = $2 AND deleted_at IS NULL',
        [userId, centroId]
    );
    if (ownResult.rows.length > 0) return 'admin';

    // 3. Acceso delegado
    const delegatedResult = await client.query(
        `SELECT access_level FROM user_centro_access 
         WHERE user_id = $1 AND centro_id = $2 AND deleted_at IS NULL`,
        [userId, centroId]
    );

    if (delegatedResult.rows.length > 0) {
        const lvl = String(delegatedResult.rows[0].access_level || '').toLowerCase().trim();
        if (['admin', 'administrador'].includes(lvl)) return 'admin';
        if (['write', 'escritura', 'operador', 'editor'].includes(lvl)) return 'write';
        return 'read';
    }

    return null; // Sin acceso
}


// ============================================================
// HELPER: Determina el filtro SQL según el tipo de usuario
// - Admin nacional (sin centro_id y con permiso view_all_centros): ve todo
// - Usuario con centro propio: ve el suyo + los delegados
// ============================================================
async function getCentroFilter(userId, client) {
    // 1. Verificar si es administrador nacional (bypass)
    const adminResult = await client.query(
        `SELECT 1 FROM (
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = $1
        ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
        [userId]
    );

    if (adminResult.rows.length > 0) {
        return { filter: '', params: [] }; // Sin filtro: ve todo
    }

    // 2. Verificar si tiene permiso para ver todos los centros (opcional, como respaldo)
    const permResult = await client.query(
        `SELECT 1 FROM (
       SELECT p.name FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = $1
       UNION
       SELECT p.name FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = $1
     ) perms WHERE name = 'view_all_centros'`,
        [userId]
    );

    if (permResult.rows.length > 0) {
        return { filter: '', params: [] }; // Sin filtro: ve todo
    }

    // 3. Construir lista de centros accesibles (propio + delegados)
    const accessResult = await client.query(
        `SELECT c.id FROM centros c
     WHERE c.id = (SELECT centro_id FROM users WHERE id = $1 AND deleted_at IS NULL)
       AND c.deleted_at IS NULL
     UNION
     SELECT uca.centro_id FROM user_centro_access uca
     WHERE uca.user_id = $1 AND uca.deleted_at IS NULL`,
        [userId]
    );

    const centroIds = accessResult.rows.map(r => r.id).filter(Boolean);

    if (centroIds.length === 0) {
        return { filter: 'AND 1=0', params: [] }; // Sin acceso a ningún centro
    }

    return {
        filter: `AND c.id = ANY($__PARAM__)`,
        params: [centroIds],
        isArray: true
    };
}


// ============================================================
// GEO: Catálogos geográficos (públicos dentro de la sesión - basados en tabla verificada geografia)
// ============================================================

exports.listEstados = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT DISTINCT cod_entida AS id, estado AS nombre
             FROM public.geografia
             ORDER BY estado ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener estados', detail: err.message });
    } finally {
        client.release();
    }
};

exports.listMunicipios = async (req, res) => {
    const { estado_id } = req.query;
    const client = await pool.connect();
    try {
        const params = [];
        let where = '';
        if (estado_id) {
            params.push(estado_id);
            const pIdx = params.length;
            where = `WHERE (cod_entida = $${pIdx} OR edo_ine::text = $${pIdx} OR cod_entida = LPAD($${pIdx}, 2, '0'))`;
        }
        const result = await client.query(
            `SELECT DISTINCT cod_munici AS id, cod_entida AS estado_id, municipio AS nombre
             FROM public.geografia
             ${where}
             ORDER BY municipio ASC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener municipios', detail: err.message });
    } finally {
        client.release();
    }
};

exports.listParroquias = async (req, res) => {
    const { municipio_id, estado_id } = req.query;
    const client = await pool.connect();
    try {
        const params = [];
        const conditions = [];

        if (estado_id) {
            params.push(estado_id);
            const pIdx = params.length;
            conditions.push(`(cod_entida = $${pIdx} OR edo_ine::text = $${pIdx} OR cod_entida = LPAD($${pIdx}, 2, '0'))`);
        }
        if (municipio_id) {
            params.push(municipio_id);
            const pIdx = params.length;
            conditions.push(`(cod_munici = $${pIdx} OR mun_ine::text = $${pIdx} OR cod_munici = LPAD($${pIdx}, 2, '0'))`);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await client.query(
            `SELECT DISTINCT ON (cod_entida, cod_munici, cod_parroq)
                    id AS geo_id,
                    codigo_ine,
                    cod_parroq,
                    pq_ine,
                    parish_id,
                    COALESCE(codigo_ine::integer, id) AS id,
                    parroquia AS nombre
             FROM public.geografia
             ${whereSql}
             ORDER BY cod_entida, cod_munici, cod_parroq, parroquia ASC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener parroquias', detail: err.message });
    } finally {
        client.release();
    }
};


// ============================================================
// CENTROS: CRUD
// ============================================================

exports.listCentros = async (req, res) => {
    const client = await pool.connect();
    try {
        const { filter, params, isArray } = await getCentroFilter(req.userId, client);
        const paramIdx = isArray ? params.length : 0;

        const sql = `
      SELECT c.id, c.nombre_establecimiento, c.tipo_establecimiento,
             c.tipo_clasificacion, c.estado_centro, c.rif, c.nro_registro_mercantil,
             c.latitud, c.longitud,
             g.parroquia AS parroquia, g.municipio AS municipio, g.estado AS estado,
             f.id AS ficha_id, f.nro_registro_nacional, f.tipo_solicitud,
             f.fecha_solicitud, f.version,
             CASE 
                WHEN (
                    SELECT 1 FROM user_roles ur 
                    JOIN roles r ON ur.role_id = r.id 
                    WHERE ur.user_id = $${params.length + 1} AND LOWER(r.name) IN ('admin', 'administrador')
                ) IS NOT NULL THEN 'admin'
                WHEN c.id = (SELECT centro_id FROM users WHERE id = $${params.length + 1}) THEN 'admin'
                ELSE (SELECT access_level FROM user_centro_access WHERE user_id = $${params.length + 1} AND centro_id = c.id AND deleted_at IS NULL LIMIT 1)
             END as access_level
      FROM public.centros c
      LEFT JOIN LATERAL (
          SELECT g.parroquia, g.municipio, g.estado, g.cod_entida, g.cod_munici, g.codigo_ine
          FROM public.geografia g
          WHERE g.codigo_ine::integer = c.parroquia_id 
             OR g.id = c.parroquia_id 
             OR g.parish_id = c.parroquia_id
          ORDER BY
             (g.codigo_ine::integer = c.parroquia_id) DESC,
             CASE WHEN c.latitud IS NOT NULL AND c.longitud IS NOT NULL AND g.geom IS NOT NULL
                  THEN ST_Contains(g.geom, ST_SetSRID(ST_Point(c.longitud, c.latitud), 4326))
                  ELSE FALSE 
             END DESC,
             (g.id = c.parroquia_id) DESC,
             (g.parish_id = c.parroquia_id) DESC
          LIMIT 1
      ) g ON TRUE
      LEFT JOIN public.fichas_establecimiento f ON f.centro_id = c.id AND f.is_current = TRUE AND f.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      ${filter.replace('$__PARAM__', `$${paramIdx}`)}
      ORDER BY c.nombre_establecimiento
    `;

        const result = await client.query(sql, [...params, req.userId]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener centros', detail: err.message });
    } finally {
        client.release();
    }
};

exports.getCentro = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const { filter, params, isArray } = await getCentroFilter(req.userId, client);
        const centroParam = params.length + 1;
        const filterParam = isArray ? params.length : null;

        const allParams = isArray ? [...params, id] : [id];
        const filterSql = filter.replace('$__PARAM__', `$${filterParam}`);

        const result = await client.query(
            `SELECT c.*,
                    g.parroquia AS parroquia,
                    g.municipio AS municipio,
                    g.estado AS estado,
                    g.cod_munici AS municipio_id,
                    g.cod_entida AS estado_id,
                    g.codigo_ine AS codigo_ine
             FROM public.centros c
             LEFT JOIN LATERAL (
                 SELECT g.parroquia, g.municipio, g.estado, g.cod_entida, g.cod_munici, g.codigo_ine
                 FROM public.geografia g
                 WHERE g.codigo_ine::integer = c.parroquia_id 
                    OR g.id = c.parroquia_id 
                    OR g.parish_id = c.parroquia_id
                 ORDER BY
                    (g.codigo_ine::integer = c.parroquia_id) DESC,
                    CASE WHEN c.latitud IS NOT NULL AND c.longitud IS NOT NULL AND g.geom IS NOT NULL
                         THEN ST_Contains(g.geom, ST_SetSRID(ST_Point(c.longitud, c.latitud), 4326))
                         ELSE FALSE 
                    END DESC,
                    (g.id = c.parroquia_id) DESC,
                    (g.parish_id = c.parroquia_id) DESC
                 LIMIT 1
             ) g ON TRUE
             WHERE c.id = $${centroParam} AND c.deleted_at IS NULL ${filterSql}`,
            allParams
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Centro no encontrado o sin acceso.' });
        }

        // Obtener también propietarios, representantes, teléfonos y correos
        const [propietarios, representantes, telefonos, correos] = await Promise.all([
            client.query('SELECT * FROM public.centro_propietarios WHERE centro_id = $1 AND deleted_at IS NULL', [id]),
            client.query('SELECT * FROM public.centro_representantes WHERE centro_id = $1 AND deleted_at IS NULL', [id]),
            client.query('SELECT * FROM public.centro_telefonos WHERE centro_id = $1 AND deleted_at IS NULL', [id]),
            client.query('SELECT * FROM public.centro_correos WHERE centro_id = $1 AND deleted_at IS NULL', [id]),
        ]);

        const accessLevel = await getEffectiveAccessLevel(req.userId, id, client);

        res.json({
            ...result.rows[0],
            access_level: accessLevel,
            propietarios: propietarios.rows,
            representantes: representantes.rows,
            telefonos: telefonos.rows,
            correos: correos.rows,
        });

    } catch (err) {
        res.status(500).json({ error: 'Error al obtener el centro', detail: err.message });
    } finally {
        client.release();
    }
};

// Constante de límite de foto: 1 MB en base64 (~1.37 MB) con margen de seguridad
const FOTO_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB de base64 (margen para overhead base64)

// Valida que el string base64 de la foto no exceda el límite
function validateFotoSize(fotoBase64) {
    if (!fotoBase64) return true;
    const byteLength = Buffer.byteLength(fotoBase64, 'utf8');
    return byteLength <= FOTO_MAX_BYTES;
}

exports.createCentro = async (req, res) => {
    const {
        nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
        tipo_establecimiento, tipo_establecimiento_descripcion,
        tipo_clasificacion, estado_centro = 'activo',
        latitud = null, longitud = null,
        foto_base64 = null,
        propietarios = [], representantes = [], telefonos = [], correos = []
    } = req.body;

    if (foto_base64 && !validateFotoSize(foto_base64)) {
        return res.status(400).json({ error: 'La foto excede el límite permitido de 1 MB.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const centroResult = await client.query(
            `INSERT INTO public.centros
       (nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
        tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro,
        latitud, longitud, foto_base64)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
                tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro,
                latitud, longitud, foto_base64]
        );
        const centro = centroResult.rows[0];

        // Insertar propietarios
        for (const prop of propietarios) {
            await client.query(
                `INSERT INTO public.centro_propietarios (centro_id, nombre, cedula_tipo, cedula_nro, es_principal)
         VALUES ($1, $2, $3, $4, $5)`,
                [centro.id, prop.nombre, prop.cedula_tipo || 'V', prop.cedula_nro, prop.es_principal || false]
            );
        }
        // Insertar representantes
        for (const rep of representantes) {
            await client.query(
                `INSERT INTO public.centro_representantes (centro_id, nombre, cedula_tipo, cedula_nro, cargo)
         VALUES ($1, $2, $3, $4, $5)`,
                [centro.id, rep.nombre, rep.cedula_tipo || 'V', rep.cedula_nro, rep.cargo]
            );
        }
        // Insertar teléfonos
        for (const tel of telefonos) {
            await client.query(
                `INSERT INTO public.centro_telefonos (centro_id, telefono, tipo)
         VALUES ($1, $2, $3)`,
                [centro.id, tel.telefono, tel.tipo || 'general']
            );
        }
        // Insertar correos
        for (const cor of correos) {
            await client.query(
                `INSERT INTO public.centro_correos (centro_id, correo, tipo)
         VALUES ($1, $2, $3)`,
                [centro.id, cor.correo, cor.tipo || 'general']
            );
        }

        // Si el usuario que crea tiene un centro_id NULL, asignarlo automáticamente
        const userResult = await client.query(
            'SELECT centro_id FROM users WHERE id = $1', [req.userId]
        );
        if (!userResult.rows[0]?.centro_id) {
            await client.query(
                'UPDATE users SET centro_id = $1 WHERE id = $2', [centro.id, req.userId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Centro creado exitosamente.', centro });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el centro', detail: err.message });
    } finally {
        client.release();
    }
};

exports.updateCentro = async (req, res) => {
    const { id } = req.params;
    const {
        nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
        tipo_establecimiento, tipo_establecimiento_descripcion,
        tipo_clasificacion, estado_centro,
        latitud, longitud,
        foto_base64
    } = req.body;

    // Validar tamaño de foto si se envía
    if (foto_base64 !== undefined && foto_base64 !== null && !validateFotoSize(foto_base64)) {
        return res.status(400).json({ error: 'La foto excede el límite permitido de 1 MB.' });
    }

    const client = await pool.connect();
    try {
        // Verificar acceso
        const hasAccess = await verifyCentroAccess(req.userId, id, client, 'write');

        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso para editar este centro.' });
        }

        // Construir la actualización de foto_base64:
        // Si se envía explícitamente (incluso null), se actualiza; si no viene en el body, se conserva
        const updateFoto = 'foto_base64' in req.body;

        const result = await client.query(
            `UPDATE public.centros SET
         nombre_establecimiento = COALESCE($1, nombre_establecimiento),
         parroquia_id = COALESCE($2, parroquia_id),
         nro_registro_mercantil = COALESCE($3, nro_registro_mercantil),
         rif = COALESCE($4, rif),
         tipo_establecimiento = COALESCE($5, tipo_establecimiento),
         tipo_establecimiento_descripcion = COALESCE($6, tipo_establecimiento_descripcion),
         tipo_clasificacion = COALESCE($7, tipo_clasificacion),
         estado_centro = COALESCE($8, estado_centro),
         latitud = COALESCE($9, latitud),
         longitud = COALESCE($10, longitud),
         foto_base64 = CASE WHEN $12::boolean THEN $11::text ELSE foto_base64 END,
         updated_at = NOW()
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
            [nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
                tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro,
                latitud, longitud, foto_base64 ?? null, updateFoto, id]
        );

        res.json({ message: 'Centro actualizado.', centro: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el centro', detail: err.message });
    } finally {
        client.release();
    }
};

exports.uploadFoto = async (req, res) => {
    const { id } = req.params;
    const { foto_base64 } = req.body;

    if (!foto_base64) {
        return res.status(400).json({ error: 'No se recibió ninguna foto.' });
    }

    if (!validateFotoSize(foto_base64)) {
        return res.status(400).json({ error: 'La foto excede el límite permitido de 1 MB.' });
    }

    const client = await pool.connect();
    try {
        const hasAccess = await verifyCentroAccess(req.userId, id, client, 'write');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso para editar este centro.' });
        }

        const result = await client.query(
            `UPDATE public.centros SET foto_base64 = $1, updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL RETURNING id, foto_base64`,
            [foto_base64, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Centro no encontrado.' });
        }

        res.json({ message: 'Foto actualizada.', foto_base64: result.rows[0].foto_base64 });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar la foto', detail: err.message });
    } finally {
        client.release();
    }
};

exports.deleteFoto = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const hasAccess = await verifyCentroAccess(req.userId, id, client, 'write');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso para editar este centro.' });
        }

        const result = await client.query(
            `UPDATE public.centros SET foto_base64 = NULL, updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Centro no encontrado.' });
        }

        res.json({ message: 'Foto eliminada correctamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar la foto', detail: err.message });
    } finally {
        client.release();
    }
};

exports.deleteCentro = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        // Verificar acceso (solo nivel 'admin' delegado o admin nacional)
        const hasAccess = await verifyCentroAccess(req.userId, id, client, 'admin');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso para eliminar este centro.' });
        }

        await withAuditContext(client, req);
        await client.query('BEGIN');


        const now = new Date();

        // 1. Borrado lógico de tablas de contacto y relación directa
        await client.query('UPDATE public.centro_telefonos SET deleted_at = $1 WHERE centro_id = $2 AND deleted_at IS NULL', [now, id]);
        await client.query('UPDATE public.centro_correos SET deleted_at = $1 WHERE centro_id = $2 AND deleted_at IS NULL', [now, id]);
        await client.query('UPDATE public.centro_propietarios SET deleted_at = $1 WHERE centro_id = $2 AND deleted_at IS NULL', [now, id]);
        await client.query('UPDATE public.centro_representantes SET deleted_at = $1 WHERE centro_id = $2 AND deleted_at IS NULL', [now, id]);
        await client.query('UPDATE public.user_centro_access SET deleted_at = $1 WHERE centro_id = $2 AND deleted_at IS NULL', [now, id]);

        // 2. Borrado lógico de detalles de fichas (vía fichas_establecimiento)
        const fichaIdsRes = await client.query('SELECT id FROM public.fichas_establecimiento WHERE centro_id = $1 AND deleted_at IS NULL', [id]);
        const fichaIds = fichaIdsRes.rows.map(r => r.id);

        if (fichaIds.length > 0) {
            const fichaTables = [
                'ficha_poblacion', 'ficha_capacidad', 'ficha_infraestructura',
                'ficha_personal', 'ficha_servicios', 'ficha_documentos'
            ];
            for (const table of fichaTables) {
                await client.query(`UPDATE public.${table} SET deleted_at = $1 WHERE ficha_id = ANY($2) AND deleted_at IS NULL`, [now, fichaIds]);
            }
            // 3. Borrado lógico de las fichas mismas
            await client.query('UPDATE public.fichas_establecimiento SET deleted_at = $1 WHERE id = ANY($2) AND deleted_at IS NULL', [now, fichaIds]);
        }

        // 4. Borrado lógico del centro
        await client.query(
            `UPDATE public.centros SET deleted_at = $1, updated_at = $1
       WHERE id = $2 AND deleted_at IS NULL`,
            [now, id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Centro y todos sus datos relacionados eliminados (borrado lógico).' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al eliminar el centro en cascada', detail: err.message });
    } finally {
        client.release();
    }
};



// ============================================================
// FICHAS DE ESTABLECIMIENTO
// ============================================================

exports.listFichas = async (req, res) => {
    const { centroId } = req.params;
    const client = await pool.connect();
    try {
        // Verificar acceso
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'read');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso a las fichas de este centro.' });
        }

        const result = await client.query(
            `SELECT id, version, fecha_solicitud, nro_registro_nacional,
              tipo_solicitud, fecha_fundacion, costo_mensual, is_current, created_at
       FROM public.fichas_establecimiento
       WHERE centro_id = $1 AND deleted_at IS NULL
       ORDER BY version DESC`,
            [centroId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener fichas', detail: err.message });
    } finally {
        client.release();
    }
};


exports.getFichaActual = async (req, res) => {
    const { centroId } = req.params;
    const client = await pool.connect();
    try {
        // Verificar acceso
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'read');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso a este centro.' });
        }

        const fichaResult = await client.query(

            `SELECT f.* FROM public.fichas_establecimiento f
       WHERE f.centro_id = $1 AND f.is_current = TRUE AND f.deleted_at IS NULL`,
            [centroId]
        );

        if (!fichaResult.rows.length) {
            return res.status(404).json({ error: 'No hay ficha activa para este centro.' });
        }

        const ficha = fichaResult.rows[0];

        // Cargar tablas dependientes
        const [documentos, servicios, personal, infraestructura, accesibilidad, capacidad, poblacion] = await Promise.all([
            client.query('SELECT * FROM public.ficha_documentos WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_servicios WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_personal WHERE ficha_id = $1', [ficha.id]),
            client.query(`
                SELECT fi.*,
                       ei.nombre AS estado_inmueble_nombre
                FROM public.ficha_infraestructura fi
                LEFT JOIN public.estados_inmueble ei ON ei.id = fi.estado_inmueble_id
                WHERE fi.ficha_id = $1
            `, [ficha.id]),
            client.query('SELECT * FROM public.ficha_accesibilidad WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_capacidad WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_poblacion WHERE ficha_id = $1 ORDER BY fecha_corte DESC', [ficha.id]),
        ]);

        res.json({
            ...ficha,
            documentos: documentos.rows,
            servicios: servicios.rows[0] || null,
            personal: personal.rows[0] || null,
            infraestructura: infraestructura.rows[0] || null,
            accesibilidad: accesibilidad.rows[0] || null,
            capacidad: capacidad.rows[0] || null,
            poblacion: poblacion.rows,
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener la ficha actual', detail: err.message });
    } finally {
        client.release();
    }
};

exports.createFicha = async (req, res) => {
    const { centroId } = req.params;
    const {
        fecha_solicitud, nro_registro_nacional, tipo_solicitud,
        fecha_fundacion, costo_mensual, direccion,
        documentos = [], servicios = null, personal = null,
        infraestructura = null, accesibilidad = null, capacidad = null
    } = req.body;

    const client = await pool.connect();
    try {
        // Verificar acceso
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'write');
        if (!hasAccess) {
            return res.status(403).json({ error: 'Sin acceso para crear fichas en este centro.' });
        }

        await client.query('BEGIN');


        // Obtener la versión más alta actual
        const versionResult = await client.query(
            'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM public.fichas_establecimiento WHERE centro_id = $1',
            [centroId]
        );
        const nextVersion = versionResult.rows[0].next_version;

        // Desactivar la ficha actual
        await client.query(
            `UPDATE public.fichas_establecimiento SET is_current = FALSE
       WHERE centro_id = $1 AND is_current = TRUE`,
            [centroId]
        );

        // Insertar nueva ficha
        const fichaResult = await client.query(
            `INSERT INTO public.fichas_establecimiento
       (centro_id, version, fecha_solicitud, nro_registro_nacional, tipo_solicitud,
        fecha_fundacion, costo_mensual, direccion, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING *`,
            [centroId, nextVersion, fecha_solicitud || null, nro_registro_nacional || null, (tipo_solicitud && tipo_solicitud.trim()) || null,
                fecha_fundacion || null, costo_mensual || null, direccion || null]
        );
        const ficha = fichaResult.rows[0];

        // Insertar documentos
        for (const doc of documentos) {
            await client.query(
                `INSERT INTO public.ficha_documentos (ficha_id, tipo_documento, tiene_original, tiene_copia, descripcion)
         VALUES ($1,$2,$3,$4,$5)`,
                [ficha.id, doc.tipo_documento, doc.tiene_original || false, doc.tiene_copia || false, doc.descripcion]
            );
        }

        // Insertar servicios (1:1)
        if (servicios) {
            await client.query(
                `INSERT INTO public.ficha_servicios
         (ficha_id, farmacia, evaluacion_nutricional, actividades_recreativas, servicio_emergencia,
          servicio_funerario, medicos, medicos_descripcion, lavanderia, lavanderia_descripcion,
          barberia_peluqueria, otros, otros_descripcion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [ficha.id, servicios.farmacia, servicios.evaluacion_nutricional,
                servicios.actividades_recreativas, servicios.servicio_emergencia,
                servicios.servicio_funerario, servicios.medicos, servicios.medicos_descripcion,
                servicios.lavanderia, servicios.lavanderia_descripcion,
                servicios.barberia_peluqueria, servicios.otros, servicios.otros_descripcion]
            );
        }

        // Insertar personal (1:1)
        if (personal) {
            await client.query(
                `INSERT INTO public.ficha_personal
         (ficha_id, num_medicos_geriatra, num_medicos_psiquiatra, num_enfermeros, num_cuidadores,
          num_camareros, num_auxiliares_enfermeria, num_servicios_generales, num_personal_cocina,
          num_personal_no_adscrito, descripcion_no_adscrito, posee_expediente_curricular,
          otros_personal, descripcion_otros_personal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                [ficha.id, personal.num_medicos_geriatra, personal.num_medicos_psiquiatra,
                personal.num_enfermeros, personal.num_cuidadores, personal.num_camareros,
                personal.num_auxiliares_enfermeria, personal.num_servicios_generales,
                personal.num_personal_cocina, personal.num_personal_no_adscrito,
                personal.descripcion_no_adscrito, personal.posee_expediente_curricular,
                personal.otros_personal, personal.descripcion_otros_personal]
            );
        }

        // Insertar infraestructura (1:1)
        if (infraestructura) {
            await client.query(
                `INSERT INTO public.ficha_infraestructura
         (ficha_id, estado_inmueble_id, num_dormitorios, dormitorios_adecuados,
          num_sanitarios, sanitarios_adecuados, tiene_area_cocina, cocina_adecuada,
          areas_atencion_medica, areas_verdes,
          ventilacion_adecuada, iluminacion_adecuada, capacidad_comedor_pct,
          luz_electrica, agua_potable, agua_servidas, deposito_basura, sistema_seguridad, descripcion_otros)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
                [ficha.id, infraestructura.estado_inmueble_id, infraestructura.num_dormitorios,
                infraestructura.dormitorios_adecuados, infraestructura.num_sanitarios,
                infraestructura.sanitarios_adecuados, infraestructura.tiene_area_cocina,
                infraestructura.cocina_adecuada,
                infraestructura.areas_atencion_medica ?? false, infraestructura.areas_verdes ?? false,
                infraestructura.ventilacion_adecuada,
                infraestructura.iluminacion_adecuada, infraestructura.capacidad_comedor_pct,
                infraestructura.luz_electrica, infraestructura.agua_potable,
                infraestructura.agua_servidas, infraestructura.deposito_basura,
                infraestructura.sistema_seguridad, infraestructura.descripcion_otros]
            );
        }

        // Insertar accesibilidad (1:1)
        if (accesibilidad) {
            await client.query(
                `INSERT INTO public.ficha_accesibilidad
         (ficha_id, rampas_fijas, piso_antirresbalante, alfombras_sueltas, ascensores,
          num_ascensores, pasamanos, escaleras_antirresbalantes, banos_geriatricos,
          senales_accesibles, timbres_emergencia, pasillos_accesibles_sillas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [ficha.id, accesibilidad.rampas_fijas ?? false, accesibilidad.piso_antirresbalante ?? false,
                accesibilidad.alfombras_sueltas ?? false, accesibilidad.ascensores ?? false,
                accesibilidad.ascensores ? (accesibilidad.num_ascensores ? parseInt(accesibilidad.num_ascensores, 10) : null) : null,
                accesibilidad.pasamanos ?? false, accesibilidad.escaleras_antirresbalantes ?? false,
                accesibilidad.banos_geriatricos ?? false, accesibilidad.senales_accesibles ?? false,
                accesibilidad.timbres_emergencia ?? false, accesibilidad.pasillos_accesibles_sillas ?? false]
            );
        }

        // Insertar capacidad (1:1)
        if (capacidad) {
            await client.query(
                `INSERT INTO public.ficha_capacidad
         (ficha_id, capacidad_total_residente, atencion_ambulatoria, capacidad_actual_residente, num_atencion_ambulatoria)
         VALUES ($1,$2,$3,$4,$5)`,
                [ficha.id, capacidad.capacidad_total_residente, capacidad.atencion_ambulatoria,
                capacidad.capacidad_actual_residente, capacidad.num_atencion_ambulatoria]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Ficha creada exitosamente.', ficha });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear la ficha', detail: err.message });
    } finally {
        client.release();
    }
};

exports.updateFicha = async (req, res) => {
    const { fichaId } = req.params;
    const fields = req.body;
    const client = await pool.connect();
    try {
        // Obtener centroId de la ficha
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });

        const hasAccess = await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write');
        if (!hasAccess) return res.status(403).json({ error: 'Sin acceso para editar esta ficha.' });

        const result = await client.query(
            `UPDATE public.fichas_establecimiento SET
         fecha_solicitud = COALESCE($1, fecha_solicitud),
         nro_registro_nacional = COALESCE($2, nro_registro_nacional),
         tipo_solicitud = COALESCE(NULLIF($3, ''), tipo_solicitud),
         fecha_fundacion = COALESCE($4, fecha_fundacion),
         costo_mensual = COALESCE($5, costo_mensual),
         direccion = COALESCE($6, direccion),
         updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL RETURNING *`,
            [fields.fecha_solicitud || null, fields.nro_registro_nacional || null, fields.tipo_solicitud || null,
            fields.fecha_fundacion || null, fields.costo_mensual || null, fields.direccion || null, fichaId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Ficha no encontrada.' });
        }
        res.json({ message: 'Ficha actualizada.', ficha: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar la ficha', detail: err.message });
    } finally {
        client.release();
    }
};

// Registrar datos de población (histórico)
exports.addPoblacion = async (req, res) => {
    const { fichaId } = req.params;
    const { fecha_corte, registros = [] } = req.body;
    // registros: [{ modalidad, categoria, femenino, masculino }]
    const client = await pool.connect();
    try {
        // Verificar acceso vía ficha
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });

        const hasAccess = await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write');
        if (!hasAccess) return res.status(403).json({ error: 'Sin acceso para registrar población.' });

        await client.query('BEGIN');

        for (const r of registros) {
            await client.query(
                `INSERT INTO public.ficha_poblacion (ficha_id, fecha_corte, modalidad, categoria, femenino, masculino)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (ficha_id, fecha_corte, modalidad, categoria)
         DO UPDATE SET femenino = EXCLUDED.femenino, masculino = EXCLUDED.masculino`,
                [fichaId, fecha_corte, r.modalidad, r.categoria, r.femenino || 0, r.masculino || 0]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Datos de población registrados.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al registrar población', detail: err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// GESTIÓN DE ACCESO DELEGADO
// ============================================================

exports.listCentroUsers = async (req, res) => {
    const { centroId } = req.params;
    const client = await pool.connect();
    try {
        // Solo admins del centro
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'admin');
        if (!hasAccess) return res.status(403).json({ error: 'Sin acceso para gestionar usuarios de este centro.' });

        const result = await client.query(

            `SELECT u.id, u.first_name, u.last_name, u.email, u.cedula,
              uca.access_level, uca.granted_at,
              g.first_name || ' ' || g.last_name AS granted_by_name
       FROM public.user_centro_access uca
       JOIN public.users u ON u.id = uca.user_id
       LEFT JOIN public.users g ON g.id = uca.granted_by
       WHERE uca.centro_id = $1 AND uca.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY u.last_name, u.first_name`,
            [centroId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener usuarios del centro', detail: err.message });
    } finally {
        client.release();
    }
};

exports.grantCentroAccess = async (req, res) => {
    const { centroId } = req.params;
    let { user_id, access_level } = req.body;
    const client = await pool.connect();
    try {
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'admin');
        if (!hasAccess) return res.status(403).json({ error: 'Sin acceso para otorgar permisos en este centro.' });

        // Si viene como objeto { label, value }, extraer value
        if (typeof access_level === 'object' && access_level !== null) {
            access_level = access_level.value;
        }

        // Normalizar access_level a valores canónicos: 'read', 'write', 'admin'
        let normalizedLevel = 'read';
        if (access_level) {
            const lvl = String(access_level).toLowerCase().trim();
            if (['admin', 'administrador', 'owner', 'superadmin'].includes(lvl)) {
                normalizedLevel = 'admin';
            } else if (['write', 'escritura', 'editor', 'operador', 'edicion'].includes(lvl)) {
                normalizedLevel = 'write';
            } else if (['read', 'lectura', 'lector', 'user', 'usuario', 'viewer', 'consulta', 'consultor'].includes(lvl)) {
                normalizedLevel = 'read';
            } else {
                normalizedLevel = 'read';
            }
        }

        await client.query(
            `INSERT INTO public.user_centro_access (user_id, centro_id, access_level, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, centro_id) DO UPDATE
       SET access_level = EXCLUDED.access_level, granted_by = EXCLUDED.granted_by,
           granted_at = NOW(), deleted_at = NULL`,
            [user_id, centroId, normalizedLevel, req.userId]
        );
        res.status(201).json({ message: 'Acceso otorgado.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al otorgar acceso', detail: err.message });
    } finally {
        client.release();
    }
};

exports.revokeCentroAccess = async (req, res) => {
    const { centroId, userId } = req.params;
    const client = await pool.connect();
    try {
        const hasAccess = await verifyCentroAccess(req.userId, centroId, client, 'admin');
        if (!hasAccess) return res.status(403).json({ error: 'Sin acceso para revocar permisos en este centro.' });

        await client.query(

            `UPDATE public.user_centro_access SET deleted_at = NOW()
       WHERE user_id = $1 AND centro_id = $2 AND deleted_at IS NULL`,
            [userId, centroId]
        );
        res.json({ message: 'Acceso revocado.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al revocar acceso', detail: err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// MI CENTRO: Verificar si el usuario ya tiene un centro
// ============================================================

exports.getMiCentro = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT c.*, f.id AS ficha_id, f.is_current
             FROM public.centros c
             JOIN public.users u ON u.centro_id = c.id
             LEFT JOIN public.fichas_establecimiento f ON f.centro_id = c.id AND f.is_current = TRUE AND f.deleted_at IS NULL
             WHERE u.id = $1 AND c.deleted_at IS NULL`,
            [req.userId]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: 'Error', detail: err.message });
    } finally {
        client.release();
    }
};

// ============================================================
// UPSERTS POR SECCIÓN DE FICHA (guardado parcial)
// ============================================================

exports.saveCapacidad = async (req, res) => {
    const { fichaId } = req.params;
    const { capacidad_total_residente, atencion_ambulatoria, capacidad_actual_residente, num_atencion_ambulatoria } = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        const r = await client.query(

            `INSERT INTO public.ficha_capacidad
             (ficha_id, capacidad_total_residente, atencion_ambulatoria, capacidad_actual_residente, num_atencion_ambulatoria)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (ficha_id) DO UPDATE SET
               capacidad_total_residente  = EXCLUDED.capacidad_total_residente,
               atencion_ambulatoria       = EXCLUDED.atencion_ambulatoria,
               capacidad_actual_residente = EXCLUDED.capacidad_actual_residente,
               num_atencion_ambulatoria   = EXCLUDED.num_atencion_ambulatoria,
               updated_at = NOW()
             RETURNING *`,
            [fichaId, capacidad_total_residente, atencion_ambulatoria, capacidad_actual_residente, num_atencion_ambulatoria]
        );
        res.json({ message: 'Capacidad guardada.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar capacidad', detail: err.message });
    } finally { client.release(); }
};

exports.saveServicios = async (req, res) => {
    const { fichaId } = req.params;
    const s = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        const r = await client.query(

            `INSERT INTO public.ficha_servicios
             (ficha_id, farmacia, evaluacion_nutricional, actividades_recreativas, servicio_emergencia,
              servicio_funerario, medicos, medicos_descripcion, lavanderia, lavanderia_descripcion,
              barberia_peluqueria, otros, otros_descripcion)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (ficha_id) DO UPDATE SET
               farmacia=$2, evaluacion_nutricional=$3, actividades_recreativas=$4,
               servicio_emergencia=$5, servicio_funerario=$6, medicos=$7,
               medicos_descripcion=$8, lavanderia=$9, lavanderia_descripcion=$10,
               barberia_peluqueria=$11, otros=$12, otros_descripcion=$13, updated_at=NOW()
             RETURNING *`,
            [fichaId, s.farmacia, s.evaluacion_nutricional, s.actividades_recreativas,
                s.servicio_emergencia, s.servicio_funerario, s.medicos, s.medicos_descripcion,
                s.lavanderia, s.lavanderia_descripcion, s.barberia_peluqueria, s.otros, s.otros_descripcion]
        );
        res.json({ message: 'Servicios guardados.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar servicios', detail: err.message });
    } finally { client.release(); }
};

exports.savePersonal = async (req, res) => {
    const { fichaId } = req.params;
    const p = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        const r = await client.query(

            `INSERT INTO public.ficha_personal
             (ficha_id, num_medicos_geriatra, num_medicos_psiquiatra, num_enfermeros, num_cuidadores,
              num_camareros, num_auxiliares_enfermeria, num_servicios_generales, num_personal_cocina,
              num_personal_no_adscrito, descripcion_no_adscrito, posee_expediente_curricular,
              otros_personal, descripcion_otros_personal)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (ficha_id) DO UPDATE SET
               num_medicos_geriatra=$2, num_medicos_psiquiatra=$3, num_enfermeros=$4,
               num_cuidadores=$5, num_camareros=$6, num_auxiliares_enfermeria=$7,
               num_servicios_generales=$8, num_personal_cocina=$9,
               num_personal_no_adscrito=$10, descripcion_no_adscrito=$11,
               posee_expediente_curricular=$12, otros_personal=$13,
               descripcion_otros_personal=$14, updated_at=NOW()
             RETURNING *`,
            [fichaId, p.num_medicos_geriatra, p.num_medicos_psiquiatra, p.num_enfermeros,
                p.num_cuidadores, p.num_camareros, p.num_auxiliares_enfermeria,
                p.num_servicios_generales, p.num_personal_cocina, p.num_personal_no_adscrito,
                p.descripcion_no_adscrito, p.posee_expediente_curricular,
                p.otros_personal, p.descripcion_otros_personal]
        );
        res.json({ message: 'Personal guardado.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar personal', detail: err.message });
    } finally { client.release(); }
};

exports.saveInfraestructura = async (req, res) => {
    const { fichaId } = req.params;
    const i = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        const r = await client.query(

            `INSERT INTO public.ficha_infraestructura
             (ficha_id, estado_inmueble_id, num_dormitorios, dormitorios_adecuados,
              num_sanitarios, sanitarios_adecuados, tiene_area_cocina, cocina_adecuada,
              areas_atencion_medica, areas_verdes,
              ventilacion_adecuada, iluminacion_adecuada, capacidad_comedor_pct,
              luz_electrica, agua_potable, agua_servidas, deposito_basura, sistema_seguridad, descripcion_otros)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (ficha_id) DO UPDATE SET
               estado_inmueble_id=$2, num_dormitorios=$3, dormitorios_adecuados=$4,
               num_sanitarios=$5, sanitarios_adecuados=$6, tiene_area_cocina=$7,
               cocina_adecuada=$8, areas_atencion_medica=$9, areas_verdes=$10,
               ventilacion_adecuada=$11, iluminacion_adecuada=$12,
               capacidad_comedor_pct=$13, luz_electrica=$14, agua_potable=$15,
               agua_servidas=$16, deposito_basura=$17, sistema_seguridad=$18,
               descripcion_otros=$19, updated_at=NOW()
             RETURNING *`,
            [fichaId, i.estado_inmueble_id, i.num_dormitorios, i.dormitorios_adecuados,
                i.num_sanitarios, i.sanitarios_adecuados, i.tiene_area_cocina, i.cocina_adecuada,
                i.areas_atencion_medica ?? false, i.areas_verdes ?? false,
                i.ventilacion_adecuada, i.iluminacion_adecuada, i.capacidad_comedor_pct,
                i.luz_electrica, i.agua_potable, i.agua_servidas, i.deposito_basura,
                i.sistema_seguridad, i.descripcion_otros]
        );
        res.json({ message: 'Infraestructura guardada.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar infraestructura', detail: err.message });
    } finally { client.release(); }
};

exports.saveAccesibilidad = async (req, res) => {
    const { fichaId } = req.params;
    const a = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        const r = await client.query(
            `INSERT INTO public.ficha_accesibilidad
             (ficha_id, rampas_fijas, piso_antirresbalante, alfombras_sueltas, ascensores,
              num_ascensores, pasamanos, escaleras_antirresbalantes, banos_geriatricos,
              senales_accesibles, timbres_emergencia, pasillos_accesibles_sillas)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (ficha_id) DO UPDATE SET
               rampas_fijas=$2, piso_antirresbalante=$3, alfombras_sueltas=$4, ascensores=$5,
               num_ascensores=$6, pasamanos=$7, escaleras_antirresbalantes=$8, banos_geriatricos=$9,
               senales_accesibles=$10, timbres_emergencia=$11, pasillos_accesibles_sillas=$12, updated_at=NOW()
             RETURNING *`,
            [fichaId, a.rampas_fijas ?? false, a.piso_antirresbalante ?? false,
             a.alfombras_sueltas ?? false, a.ascensores ?? false,
             a.ascensores ? (a.num_ascensores ? parseInt(a.num_ascensores, 10) : null) : null,
             a.pasamanos ?? false, a.escaleras_antirresbalantes ?? false,
             a.banos_geriatricos ?? false, a.senales_accesibles ?? false,
             a.timbres_emergencia ?? false, a.pasillos_accesibles_sillas ?? false]
        );
        res.json({ message: 'Accesibilidad guardada.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar accesibilidad', detail: err.message });
    } finally { client.release(); }
};

exports.saveDocumentos = async (req, res) => {
    const { fichaId } = req.params;
    const { documentos = [] } = req.body;
    const client = await pool.connect();
    try {
        const fichaCheck = await client.query('SELECT centro_id FROM public.fichas_establecimiento WHERE id = $1', [fichaId]);
        if (!fichaCheck.rows.length) return res.status(404).json({ error: 'Ficha no encontrada.' });
        if (!(await verifyCentroAccess(req.userId, fichaCheck.rows[0].centro_id, client, 'write'))) {
            return res.status(403).json({ error: 'Sin acceso.' });
        }

        await client.query('BEGIN');

        for (const doc of documentos) {
            await client.query(
                `INSERT INTO public.ficha_documentos (ficha_id, tipo_documento, tiene_original, tiene_copia, descripcion)
                 VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (ficha_id, tipo_documento) DO UPDATE SET
                   tiene_original=$3, tiene_copia=$4, descripcion=$5, updated_at=NOW()`,
                [fichaId, doc.tipo_documento, doc.tiene_original || false, doc.tiene_copia || false, doc.descripcion || null]
            );
        }
        await client.query('COMMIT');
        res.json({ message: 'Documentos guardados.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al guardar documentos', detail: err.message });
    } finally { client.release(); }
};

// Listar centros a los que un usuario tiene acceso (propio + delegados)
exports.listUserCentros = async (req, res) => {
    const { userId } = req.params;
    const client = await pool.connect();
    try {
        // Solo el propio usuario o un administrador nacional pueden ver esto
        if (req.userId !== parseInt(userId)) {
            const adminResult = await client.query(
                `SELECT 1 FROM (
                    SELECT r.name FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = $1
                ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
                [req.userId]
            );
            if (adminResult.rows.length === 0) {
                return res.status(403).json({ error: 'No tiene permiso para ver los centros de otro usuario.' });
            }
        }

        const sql = `
            SELECT c.id, c.nombre_establecimiento, uca.access_level, uca.granted_at,
                   CASE WHEN u.centro_id = c.id THEN true ELSE false END as is_owner
            FROM public.centros c
            JOIN public.users u ON u.id = $1
            LEFT JOIN public.user_centro_access uca ON uca.centro_id = c.id AND uca.user_id = $1 AND uca.deleted_at IS NULL
            WHERE c.deleted_at IS NULL
              AND (c.id = u.centro_id OR uca.user_id IS NOT NULL)
            ORDER BY c.nombre_establecimiento
        `;

        const result = await client.query(sql, [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar centros del usuario', detail: err.message });
    } finally {
        client.release();
    }
};

// Purga física de registros borrados lógicamente
exports.purgeDeletedRecords = async (req, res) => {
    const client = await pool.connect();
    try {
        // Solo administradores nacionales pueden purgar
        const adminResult = await client.query(
            `SELECT 1 FROM (
                SELECT r.name FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1
            ) roles WHERE LOWER(name) IN ('admin', 'administrador')`,
            [req.userId]
        );
        if (adminResult.rows.length === 0) {
            return res.status(403).json({ error: 'Solo los administradores nacionales pueden purgar el sistema.' });
        }

        await client.query('BEGIN');

        const batch_id = crypto.randomUUID();
        const startTimeSession = Date.now();

        const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

        const tablesToPurge = [
            { name: 'ficha_poblacion', sql: 'DELETE FROM public.ficha_poblacion WHERE deleted_at IS NOT NULL' },
            { name: 'ficha_capacidad', sql: 'DELETE FROM public.ficha_capacidad WHERE deleted_at IS NOT NULL' },
            { name: 'ficha_infraestructura', sql: 'DELETE FROM public.ficha_infraestructura WHERE deleted_at IS NOT NULL' },
            { name: 'ficha_personal', sql: 'DELETE FROM public.ficha_personal WHERE deleted_at IS NOT NULL' },
            { name: 'ficha_servicios', sql: 'DELETE FROM public.ficha_servicios WHERE deleted_at IS NOT NULL' },
            { name: 'ficha_documentos', sql: 'DELETE FROM public.ficha_documentos WHERE deleted_at IS NOT NULL' },
            { name: 'centro_telefonos', sql: 'DELETE FROM public.centro_telefonos WHERE deleted_at IS NOT NULL' },
            { name: 'centro_correos', sql: 'DELETE FROM public.centro_correos WHERE deleted_at IS NOT NULL' },
            { name: 'centro_propietarios', sql: 'DELETE FROM public.centro_propietarios WHERE deleted_at IS NOT NULL' },
            { name: 'centro_representantes', sql: 'DELETE FROM public.centro_representantes WHERE deleted_at IS NOT NULL' },
            { name: 'user_centro_access', sql: 'DELETE FROM public.user_centro_access WHERE deleted_at IS NOT NULL' },
            { name: 'fichas_establecimiento', sql: 'DELETE FROM public.fichas_establecimiento WHERE deleted_at IS NOT NULL' },
            { name: 'centros', sql: 'DELETE FROM public.centros WHERE deleted_at IS NOT NULL' },
            { name: 'users', sql: 'DELETE FROM public.users WHERE deleted_at IS NOT NULL AND id <> $1', params: [req.userId] },
            { name: 'email_verifications', sql: 'DELETE FROM public.email_verifications WHERE deleted_at IS NOT NULL' },
            { name: 'password_resets', sql: 'DELETE FROM public.password_resets WHERE deleted_at IS NOT NULL' },
            { name: 'menu_items', sql: 'DELETE FROM public.menu_items WHERE deleted_at IS NOT NULL' },
            { name: 'menu_categories', sql: 'DELETE FROM public.menu_categories WHERE deleted_at IS NOT NULL' }
        ];

        for (const table of tablesToPurge) {
            const startTable = Date.now();
            try {
                const result = await client.query(table.sql, table.params || []);
                const duration = Date.now() - startTable;

                await client.query(`
                    INSERT INTO public.maintenance_purge_logs 
                    (batch_id, performed_by_id, username, ip_address, table_name, records_purged, duration_ms, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [batch_id, req.userId, req.username || null, ip_address, table.name, result.rowCount, duration, 'SUCCESS']);

            } catch (tableErr) {
                const duration = Date.now() - startTable;
                await client.query(`
                    INSERT INTO public.maintenance_purge_logs 
                    (batch_id, performed_by_id, username, ip_address, table_name, records_purged, duration_ms, status, error_message)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [batch_id, req.userId, req.username || null, ip_address, table.name, 0, duration, 'FAILED', tableErr.message]);
                throw tableErr; // Re-throw to trigger global rollback
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Purga física completada con éxito y registrada en bitácora.', batchId: batch_id });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error durante la purga física', detail: err.message });
    } finally {
        client.release();
    }
};

exports.listMaintenanceLogs = async (req, res) => {
    const client = await pool.connect();
    try {
        // Solo administradores nacionales
        const adminResult = await client.query(
            `SELECT 1 FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1 AND LOWER(r.name) IN ('admin', 'administrador', 'administrador nacional')`,
            [req.userId]
        );
        if (adminResult.rows.length === 0) {
            return res.status(403).json({ error: 'Solo los administradores nacionales pueden ver la bitácora de mantenimiento.' });
        }


        const result = await client.query('SELECT * FROM public.maintenance_purge_logs ORDER BY performed_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener la bitácora de mantenimiento', detail: err.message });
    } finally {
        client.release();
    }
};

// ─── Proxy Geográfico (CORS bypass) ──────────────────────────────────────────

/**
 * Proxy para búsqueda de direcciones (Forward Geocoding)
 * GET /geo/proxy/search?q=...
 */
exports.proxyGeocode = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Falta el parámetro q' });

        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=en&limit=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`External API Error: ${response.status}`);
        const data = await response.json();
        
        const results = (data.features || []).map(f => {
            const p = f.properties;
            return {
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0],
                display_name: [p.name, p.street, p.district, p.city, p.county, p.state, p.country]
                    .filter(Boolean).join(', ')
            };
        });
        res.json(results);
    } catch (err) {
        console.error('Error in proxyGeocode (Photon):', err);
        res.status(502).json({ error: 'Error al consultar el servicio de geocodificación', details: err.message });
    }
};

/**
 * Resuelve nombres geográficos a IDs de la base de datos local
 * POST /geo/resolve
 * Body: { estadoNombre, municipioNombre, parroquiaNombre }
 */
exports.resolveGeoEntities = async (req, res) => {
    let { estadoNombre, municipioNombre, parroquiaNombre, lat, lng } = req.body;
    const client = await pool.connect();

    try {
        const response = { estado: null, municipio: null, parroquia: null };

        // 1. PRIORIDAD: Resolución por Coordenadas (Point-in-Polygon)
        if (lat && lng) {
            const geoResult = await client.query(
                `SELECT cod_entida, estado, cod_munici, municipio, cod_parroq, parroquia,
                        COALESCE(codigo_ine::integer, id) AS parroquia_id
                 FROM public.geografia 
                 WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326)) 
                 LIMIT 1`,
                [lng, lat] // Ojo: PostGIS usa (Longitud, Latitud)
            );

            if (geoResult.rows.length > 0) {
                const row = geoResult.rows[0];
                response.estado = { id: row.cod_entida, nombre: row.estado };
                response.municipio = { id: row.cod_munici, nombre: row.municipio };
                response.parroquia = { id: row.parroquia_id, nombre: row.parroquia };
                return res.json(response);
            }
        }

        // 2. FALLBACK: Resolución por Nombres (si falla GPS o no se enviaron coordenadas)
        const cleanPrefix = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/^(estado|municipio|parroquia|distrito|ciudad|city|state|county|municipality|parish|bolivariano)\s+/i, '')
                .replace(/\s+(state|county|municipality|parish)$/i, '')
                .trim();
        };

        const normalizedStates = {
            'capital district': 'Distrito Capital', 'amazonas state': 'Amazonas',
            'bolivar state': 'Bolívar', 'tachira': 'Táchira', 'falcon': 'Falcón',
            'zulia state': 'Zulia', 'bolivar': 'Bolívar', 'vargas': 'La Guaira'
        };

        if (estadoNombre && normalizedStates[estadoNombre.toLowerCase()]) {
            estadoNombre = normalizedStates[estadoNombre.toLowerCase()];
        }

        let searchEst = cleanPrefix(estadoNombre);
        let searchMun = cleanPrefix(municipioNombre);
        let searchPar = cleanPrefix(parroquiaNombre);

        if ((searchEst === 'distrito capital' || searchEst === 'capital') && (searchMun === 'caracas' || !searchMun)) {
            searchMun = 'libertador';
        }

        if (searchEst) {
            const estRes = await client.query(
                `SELECT DISTINCT cod_entida AS id, estado AS nombre FROM public.geografia 
                 WHERE unaccent(estado) ILIKE unaccent($1) OR unaccent(estado) ILIKE unaccent($2) OR unaccent($3) ILIKE '%' || unaccent(estado) || '%' LIMIT 1`,
                [searchEst, `%${searchEst}%`, estadoNombre]
            );

            if (estRes.rows.length > 0) {
                response.estado = estRes.rows[0];
                if (searchMun) {
                    const munRes = await client.query(
                        `SELECT DISTINCT cod_munici AS id, municipio AS nombre FROM public.geografia 
                         WHERE cod_entida = $1 AND (unaccent(municipio) ILIKE unaccent($2) OR unaccent(municipio) ILIKE unaccent($3) OR unaccent($4) ILIKE '%' || unaccent(municipio) || '%') LIMIT 1`,
                        [response.estado.id, searchMun, `%${searchMun}%`, municipioNombre]
                    );

                    if (munRes.rows.length > 0) {
                        response.municipio = munRes.rows[0];
                        if (searchPar) {
                            const parRes = await client.query(
                                `SELECT COALESCE(codigo_ine::integer, id) AS id, parroquia AS nombre FROM public.geografia 
                                 WHERE cod_entida = $1 AND cod_munici = $2 AND (unaccent(parroquia) ILIKE unaccent($3) OR unaccent(parroquia) ILIKE unaccent($4) OR unaccent($5) ILIKE '%' || unaccent(parroquia) || '%') LIMIT 1`,
                                [response.estado.id, response.municipio.id, searchPar, `%${searchPar}%`, parroquiaNombre]
                            );
                            if (parRes.rows.length > 0) response.parroquia = parRes.rows[0];
                        }
                    }
                }
            }
        }
        res.json(response);
    } catch (err) {
        console.error('Error in resolveGeoEntities:', err);
        res.status(500).json({ error: 'Error al resolver entidades geográficas', detail: err.message });
    } finally {
        client.release();
    }
};

/**
 * Proxy para búsqueda invertida (Reverse Geocoding)
 * GET /geo/proxy/reverse?lat=...&lon=...
 */
exports.proxyReverseGeocode = async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'Faltan parámetros lat/lon' });

        const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`External API Error: ${response.status}`);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const f = data.features[0];
            const p = f.properties;
            const mappedData = {
                display_name: [p.name, p.street, p.district, p.city, p.county, p.state, p.country].filter(Boolean).join(', '),
                address: {
                    road: p.street || p.name,
                    house_number: p.housenumber,
                    neighbourhood: p.district || p.name,
                    suburb: p.district || p.name,
                    city: p.city,
                    county: p.county,
                    state: p.state
                }
            };
            res.json(mappedData);
        } else {
            res.json({});
        }
    } catch (err) {
        console.error('Error in proxyReverseGeocode (Photon):', err);
        res.status(502).json({ error: 'Error al consultar el servicio de geocodificación inversa', details: err.message });
    }
};
