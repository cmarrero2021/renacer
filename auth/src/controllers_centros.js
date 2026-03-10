// src/controllers_centros.js
// Controladores para el módulo de Centros de Atención al Adulto Mayor
const pool = require('./db');

// ============================================================
// HELPER: Determina el filtro SQL según el tipo de usuario
// - Admin nacional (sin centro_id y con permiso view_all_centros): ve todo
// - Usuario con centro propio: ve el suyo + los delegados
// ============================================================
async function getCentroFilter(userId, client) {
    // Verificar si tiene permiso para ver todos los centros
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

    // Construir lista de centros accesibles (propio + delegados)
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
// GEO: Catálogos geográficos (públicos dentro de la sesión)
// ============================================================

exports.listEstados = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, nombre, codigo, codigo_ine, codigo_cne, codigo_igsb
       FROM public.estados ORDER BY nombre`
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
        const query = estado_id
            ? `SELECT id, estado_id, nombre, codigo_ine, codigo_cne, codigo_igsb
         FROM public.municipios WHERE estado_id = $1 ORDER BY nombre`
            : `SELECT id, estado_id, nombre, codigo_ine, codigo_cne, codigo_igsb
         FROM public.municipios ORDER BY nombre`;
        const params = estado_id ? [estado_id] : [];
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener municipios', detail: err.message });
    } finally {
        client.release();
    }
};

exports.listParroquias = async (req, res) => {
    const { municipio_id } = req.query;
    const client = await pool.connect();
    try {
        const query = municipio_id
            ? `SELECT id, municipio_id, nombre, codigo_ine, codigo_cne, codigo_igsb
         FROM public.parroquias WHERE municipio_id = $1 ORDER BY nombre`
            : `SELECT id, municipio_id, nombre, codigo_ine, codigo_cne, codigo_igsb
         FROM public.parroquias ORDER BY nombre`;
        const params = municipio_id ? [municipio_id] : [];
        const result = await client.query(query, params);
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
             p.nombre AS parroquia, m.nombre AS municipio, e.nombre AS estado,
             f.id AS ficha_id, f.nro_registro_nacional, f.tipo_solicitud,
             f.fecha_solicitud, f.version
      FROM public.centros c
      LEFT JOIN public.parroquias p ON p.id = c.parroquia_id
      LEFT JOIN public.municipios m ON m.id = p.municipio_id
      LEFT JOIN public.estados e ON e.id = m.estado_id
      LEFT JOIN public.fichas_establecimiento f ON f.centro_id = c.id AND f.is_current = TRUE AND f.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      ${filter.replace('$__PARAM__', `$${paramIdx}`)}
      ORDER BY c.nombre_establecimiento
    `;

        const result = await client.query(sql, params);
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
            `SELECT c.*, p.nombre AS parroquia, m.nombre AS municipio, e.nombre AS estado
       FROM public.centros c
       LEFT JOIN public.parroquias p ON p.id = c.parroquia_id
       LEFT JOIN public.municipios m ON m.id = p.municipio_id
       LEFT JOIN public.estados e ON e.id = m.estado_id
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

        res.json({
            ...result.rows[0],
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

exports.createCentro = async (req, res) => {
    const {
        nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
        tipo_establecimiento, tipo_establecimiento_descripcion,
        tipo_clasificacion, estado_centro = 'activo',
        propietarios = [], representantes = [], telefonos = [], correos = []
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const centroResult = await client.query(
            `INSERT INTO public.centros
       (nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
        tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
                tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro]
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
        tipo_clasificacion, estado_centro
    } = req.body;

    const client = await pool.connect();
    try {
        // Verificar acceso
        const access = await client.query(
            `SELECT 1 FROM public.centros c
       WHERE c.id = $1 AND c.deleted_at IS NULL
       AND (
         c.id = (SELECT centro_id FROM users WHERE id = $2)
         OR EXISTS (SELECT 1 FROM user_centro_access WHERE user_id = $2 AND centro_id = $1 AND access_level IN ('write','admin') AND deleted_at IS NULL)
         OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $2 AND r.name IN ('admin','administrador'))
       )`,
            [id, req.userId]
        );

        if (!access.rows.length) {
            return res.status(403).json({ error: 'Sin acceso para editar este centro.' });
        }

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
         updated_at = NOW()
       WHERE id = $9 AND deleted_at IS NULL RETURNING *`,
            [nombre_establecimiento, parroquia_id, nro_registro_mercantil, rif,
                tipo_establecimiento, tipo_establecimiento_descripcion, tipo_clasificacion, estado_centro, id]
        );

        res.json({ message: 'Centro actualizado.', centro: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el centro', detail: err.message });
    } finally {
        client.release();
    }
};

exports.deleteCentro = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE public.centros SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );
        res.json({ message: 'Centro eliminado (borrado lógico).' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el centro', detail: err.message });
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
        const [documentos, servicios, personal, infraestructura, capacidad, poblacion] = await Promise.all([
            client.query('SELECT * FROM public.ficha_documentos WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_servicios WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_personal WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_infraestructura WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_capacidad WHERE ficha_id = $1', [ficha.id]),
            client.query('SELECT * FROM public.ficha_poblacion WHERE ficha_id = $1 ORDER BY fecha_corte DESC', [ficha.id]),
        ]);

        res.json({
            ...ficha,
            documentos: documentos.rows,
            servicios: servicios.rows[0] || null,
            personal: personal.rows[0] || null,
            infraestructura: infraestructura.rows[0] || null,
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
        infraestructura = null, capacidad = null
    } = req.body;

    const client = await pool.connect();
    try {
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
            [centroId, nextVersion, fecha_solicitud, nro_registro_nacional, tipo_solicitud,
                fecha_fundacion, costo_mensual, direccion]
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
         (ficha_id, estado_inmueble, num_dormitorios, dormitorios_adecuados,
          num_sanitarios, sanitarios_adecuados, tiene_area_cocina, cocina_adecuada,
          ventilacion_adecuada, iluminacion_adecuada, capacidad_comedor_pct,
          luz_electrica, agua_potable, agua_servidas, deposito_basura, sistema_seguridad, descripcion_otros)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
                [ficha.id, infraestructura.estado_inmueble, infraestructura.num_dormitorios,
                infraestructura.dormitorios_adecuados, infraestructura.num_sanitarios,
                infraestructura.sanitarios_adecuados, infraestructura.tiene_area_cocina,
                infraestructura.cocina_adecuada, infraestructura.ventilacion_adecuada,
                infraestructura.iluminacion_adecuada, infraestructura.capacidad_comedor_pct,
                infraestructura.luz_electrica, infraestructura.agua_potable,
                infraestructura.agua_servidas, infraestructura.deposito_basura,
                infraestructura.sistema_seguridad, infraestructura.descripcion_otros]
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
        const result = await client.query(
            `UPDATE public.fichas_establecimiento SET
         fecha_solicitud = COALESCE($1, fecha_solicitud),
         nro_registro_nacional = COALESCE($2, nro_registro_nacional),
         tipo_solicitud = COALESCE($3, tipo_solicitud),
         fecha_fundacion = COALESCE($4, fecha_fundacion),
         costo_mensual = COALESCE($5, costo_mensual),
         direccion = COALESCE($6, direccion),
         updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL RETURNING *`,
            [fields.fecha_solicitud, fields.nro_registro_nacional, fields.tipo_solicitud,
            fields.fecha_fundacion, fields.costo_mensual, fields.direccion, fichaId]
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
    const { user_id, access_level = 'read' } = req.body;
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO public.user_centro_access (user_id, centro_id, access_level, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, centro_id) DO UPDATE
       SET access_level = EXCLUDED.access_level, granted_by = EXCLUDED.granted_by,
           granted_at = NOW(), deleted_at = NULL`,
            [user_id, centroId, access_level, req.userId]
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
        const r = await client.query(
            `INSERT INTO public.ficha_infraestructura
             (ficha_id, estado_inmueble, num_dormitorios, dormitorios_adecuados,
              num_sanitarios, sanitarios_adecuados, tiene_area_cocina, cocina_adecuada,
              ventilacion_adecuada, iluminacion_adecuada, capacidad_comedor_pct,
              luz_electrica, agua_potable, agua_servidas, deposito_basura, sistema_seguridad, descripcion_otros)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (ficha_id) DO UPDATE SET
               estado_inmueble=$2, num_dormitorios=$3, dormitorios_adecuados=$4,
               num_sanitarios=$5, sanitarios_adecuados=$6, tiene_area_cocina=$7,
               cocina_adecuada=$8, ventilacion_adecuada=$9, iluminacion_adecuada=$10,
               capacidad_comedor_pct=$11, luz_electrica=$12, agua_potable=$13,
               agua_servidas=$14, deposito_basura=$15, sistema_seguridad=$16,
               descripcion_otros=$17, updated_at=NOW()
             RETURNING *`,
            [fichaId, i.estado_inmueble, i.num_dormitorios, i.dormitorios_adecuados,
                i.num_sanitarios, i.sanitarios_adecuados, i.tiene_area_cocina, i.cocina_adecuada,
                i.ventilacion_adecuada, i.iluminacion_adecuada, i.capacidad_comedor_pct,
                i.luz_electrica, i.agua_potable, i.agua_servidas, i.deposito_basura,
                i.sistema_seguridad, i.descripcion_otros]
        );
        res.json({ message: 'Infraestructura guardada.', data: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar infraestructura', detail: err.message });
    } finally { client.release(); }
};

exports.saveDocumentos = async (req, res) => {
    const { fichaId } = req.params;
    const { documentos = [] } = req.body;
    const client = await pool.connect();
    try {
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
