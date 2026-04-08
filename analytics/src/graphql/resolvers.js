// analytics/src/graphql/resolvers.js
const pool = require('../db');
const { getAccessibleCentroIds, buildTenantClause } = require('../tenant-filter');

// ─── Mapa de campos disponibles para dashboardData ────────────────────────────
const FIELD_MAP = {
    // Centro
    'centro.nombre': { sql: 'c.nombre_establecimiento', table: 'centros', label: 'Nombre del Centro', category: 'Centro' },
    'centro.tipo_establecimiento': { sql: 'c.tipo_establecimiento', table: 'centros', label: 'Tipo de Establecimiento', category: 'Centro' },
    'centro.tipo_clasificacion': { sql: 'c.tipo_clasificacion', table: 'centros', label: 'Clasificación', category: 'Centro' },
    'centro.estado_centro': { sql: 'c.estado_centro', table: 'centros', label: 'Estado del Centro', category: 'Centro' },
    'centro.rif': { sql: 'c.rif', table: 'centros', label: 'RIF', category: 'Centro' },
    'centro.latitud': { sql: 'c.latitud', table: 'centros', label: 'Latitud', category: 'Centro', numeric: true },
    'centro.longitud': { sql: 'c.longitud', table: 'centros', label: 'Longitud', category: 'Centro', numeric: true },

    // Geografía
    'geo.estado': { sql: 'g.estado', table: 'geo', label: 'Estado', category: 'Geografía' },
    'geo.municipio': { sql: 'g.municipio', table: 'geo', label: 'Municipio', category: 'Geografía' },
    'geo.parroquia': { sql: 'g.parroquia', table: 'geo', label: 'Parroquia', category: 'Geografía' },

    // Ficha
    'ficha.version': { sql: 'f.version', table: 'ficha', label: 'Versión Ficha', category: 'Ficha', numeric: true },
    'ficha.fecha_solicitud': { sql: 'f.fecha_solicitud', table: 'ficha', label: 'Fecha de Solicitud', category: 'Ficha', date: true },
    'ficha.tipo_solicitud': { sql: 'f.tipo_solicitud', table: 'ficha', label: 'Tipo de Solicitud', category: 'Ficha' },
    'ficha.fecha_fundacion': { sql: 'f.fecha_fundacion', table: 'ficha', label: 'Fecha de Fundación', category: 'Ficha', date: true },
    'ficha.costo_mensual': { sql: 'f.costo_mensual', table: 'ficha', label: 'Costo Mensual', category: 'Ficha', numeric: true },
    'ficha.direccion': { sql: 'f.direccion', table: 'ficha', label: 'Dirección', category: 'Ficha' },

    // Capacidad
    'capacidad.total_residente': { sql: 'cap.capacidad_total_residente', table: 'capacidad', label: 'Capacidad Total Residente', category: 'Capacidad', numeric: true },
    'capacidad.actual_residente': { sql: 'cap.capacidad_actual_residente', table: 'capacidad', label: 'Capacidad Actual Residente', category: 'Capacidad', numeric: true },
    'capacidad.atencion_ambulatoria': { sql: 'cap.atencion_ambulatoria', table: 'capacidad', label: 'Atención Ambulatoria', category: 'Capacidad' },
    'capacidad.num_ambulatoria': { sql: 'cap.num_atencion_ambulatoria', table: 'capacidad', label: 'Nº Atención Ambulatoria', category: 'Capacidad', numeric: true },

    // Personal
    'personal.medicos_geriatra': { sql: 'per.num_medicos_geriatra', table: 'personal', label: 'Médicos Geriatra', category: 'Personal', numeric: true },
    'personal.medicos_psiquiatra': { sql: 'per.num_medicos_psiquiatra', table: 'personal', label: 'Médicos Psiquiatra', category: 'Personal', numeric: true },
    'personal.enfermeros': { sql: 'per.num_enfermeros', table: 'personal', label: 'Enfermeros', category: 'Personal', numeric: true },
    'personal.cuidadores': { sql: 'per.num_cuidadores', table: 'personal', label: 'Cuidadores', category: 'Personal', numeric: true },
    'personal.camareros': { sql: 'per.num_camareros', table: 'personal', label: 'Camareros', category: 'Personal', numeric: true },
    'personal.auxiliares_enfermeria': { sql: 'per.num_auxiliares_enfermeria', table: 'personal', label: 'Auxiliares Enfermería', category: 'Personal', numeric: true },
    'personal.servicios_generales': { sql: 'per.num_servicios_generales', table: 'personal', label: 'Servicios Generales', category: 'Personal', numeric: true },
    'personal.cocina': { sql: 'per.num_personal_cocina', table: 'personal', label: 'Personal de Cocina', category: 'Personal', numeric: true },
    'personal.no_adscrito': { sql: 'per.num_personal_no_adscrito', table: 'personal', label: 'Personal No Adscrito', category: 'Personal', numeric: true },
    'personal.expediente_curricular': { sql: 'per.posee_expediente_curricular', table: 'personal', label: 'Posee Exp. Curricular', category: 'Personal' },

    // Servicios
    'servicios.farmacia': { sql: 'srv.farmacia', table: 'servicios', label: 'Farmacia', category: 'Servicios' },
    'servicios.evaluacion_nutricional': { sql: 'srv.evaluacion_nutricional', table: 'servicios', label: 'Evaluación Nutricional', category: 'Servicios' },
    'servicios.actividades_recreativas': { sql: 'srv.actividades_recreativas', table: 'servicios', label: 'Actividades Recreativas', category: 'Servicios' },
    'servicios.servicio_emergencia': { sql: 'srv.servicio_emergencia', table: 'servicios', label: 'Servicio de Emergencia', category: 'Servicios' },
    'servicios.servicio_funerario': { sql: 'srv.servicio_funerario', table: 'servicios', label: 'Servicio Funerario', category: 'Servicios' },
    'servicios.medicos': { sql: 'srv.medicos', table: 'servicios', label: 'Servicio Médico', category: 'Servicios' },
    'servicios.lavanderia': { sql: 'srv.lavanderia', table: 'servicios', label: 'Lavandería', category: 'Servicios' },
    'servicios.barberia_peluqueria': { sql: 'srv.barberia_peluqueria', table: 'servicios', label: 'Barbería/Peluquería', category: 'Servicios' },

    // Infraestructura
    'infraestructura.estado_inmueble': { sql: 'inf.estado_inmueble', table: 'infraestructura', label: 'Estado del Inmueble', category: 'Infraestructura' },
    'infraestructura.num_dormitorios': { sql: 'inf.num_dormitorios', table: 'infraestructura', label: 'Nº Dormitorios', category: 'Infraestructura', numeric: true },
    'infraestructura.dormitorios_adecuados': { sql: 'inf.dormitorios_adecuados', table: 'infraestructura', label: 'Dormitorios Adecuados', category: 'Infraestructura' },
    'infraestructura.num_sanitarios': { sql: 'inf.num_sanitarios', table: 'infraestructura', label: 'Nº Sanitarios', category: 'Infraestructura', numeric: true },
    'infraestructura.sanitarios_adecuados': { sql: 'inf.sanitarios_adecuados', table: 'infraestructura', label: 'Sanitarios Adecuados', category: 'Infraestructura' },
    'infraestructura.cocina': { sql: 'inf.tiene_area_cocina', table: 'infraestructura', label: 'Tiene Área Cocina', category: 'Infraestructura' },
    'infraestructura.cocina_adecuada': { sql: 'inf.cocina_adecuada', table: 'infraestructura', label: 'Cocina Adecuada', category: 'Infraestructura' },
    'infraestructura.ventilacion': { sql: 'inf.ventilacion_adecuada', table: 'infraestructura', label: 'Ventilación Adecuada', category: 'Infraestructura' },
    'infraestructura.iluminacion': { sql: 'inf.iluminacion_adecuada', table: 'infraestructura', label: 'Iluminación Adecuada', category: 'Infraestructura' },
    'infraestructura.luz_electrica': { sql: 'inf.luz_electrica', table: 'infraestructura', label: 'Luz Eléctrica', category: 'Infraestructura' },
    'infraestructura.agua_potable': { sql: 'inf.agua_potable', table: 'infraestructura', label: 'Agua Potable', category: 'Infraestructura' },
    'infraestructura.sistema_seguridad': { sql: 'inf.sistema_seguridad', table: 'infraestructura', label: 'Sistema de Seguridad', category: 'Infraestructura' },

    // Población
    'poblacion.fecha_corte': { sql: 'pob.fecha_corte', table: 'poblacion', label: 'Fecha de Corte', category: 'Población', date: true },
    'poblacion.modalidad': { sql: 'pob.modalidad', table: 'poblacion', label: 'Modalidad', category: 'Población' },
    'poblacion.categoria': { sql: 'pob.categoria', table: 'poblacion', label: 'Categoría', category: 'Población' },
    'poblacion.femenino': { sql: 'pob.femenino', table: 'poblacion', label: 'Femenino', category: 'Población', numeric: true },
    'poblacion.masculino': { sql: 'pob.masculino', table: 'poblacion', label: 'Masculino', category: 'Población', numeric: true },
    'poblacion.total': { sql: 'pob.total', table: 'poblacion', label: 'Total', category: 'Población', numeric: true },
};

// ─── Generador de JOINs dinámicos ─────────────────────────────────────────────
function buildJoins(requiredTables) {
    const joins = [];
    const unique = new Set(requiredTables);

    if (unique.has('geo')) {
        joins.push(`LEFT JOIN public.geografia g ON g.parish_id = c.parroquia_id`);
    }
    if (unique.has('ficha') || unique.has('capacidad') || unique.has('personal') ||
        unique.has('servicios') || unique.has('infraestructura') || unique.has('poblacion')) {
        joins.push(`LEFT JOIN public.fichas_establecimiento f ON f.centro_id = c.id AND f.is_current = TRUE AND f.deleted_at IS NULL`);
    }
    if (unique.has('capacidad')) {
        joins.push(`LEFT JOIN public.ficha_capacidad cap ON cap.ficha_id = f.id AND cap.deleted_at IS NULL`);
    }
    if (unique.has('personal')) {
        joins.push(`LEFT JOIN public.ficha_personal per ON per.ficha_id = f.id AND per.deleted_at IS NULL`);
    }
    if (unique.has('servicios')) {
        joins.push(`LEFT JOIN public.ficha_servicios srv ON srv.ficha_id = f.id AND srv.deleted_at IS NULL`);
    }
    if (unique.has('infraestructura')) {
        joins.push(`LEFT JOIN public.ficha_infraestructura inf ON inf.ficha_id = f.id AND inf.deleted_at IS NULL`);
    }
    if (unique.has('poblacion')) {
        joins.push(`LEFT JOIN public.ficha_poblacion pob ON pob.ficha_id = f.id AND pob.deleted_at IS NULL`);
    }

    return joins.join('\n');
}

// ─── Operadores de filtro ─────────────────────────────────────────────────────
function buildFilterCondition(filter, paramIdx) {
    const fieldDef = FIELD_MAP[filter.field];
    if (!fieldDef) return null;

    const sql = fieldDef.sql;
    const op = (filter.operator || 'eq').toLowerCase();

    switch (op) {
        case 'eq': return { clause: `${sql} = $${paramIdx}`, value: filter.value };
        case 'neq': return { clause: `${sql} != $${paramIdx}`, value: filter.value };
        case 'gt': return { clause: `${sql} > $${paramIdx}`, value: filter.value };
        case 'lt': return { clause: `${sql} < $${paramIdx}`, value: filter.value };
        case 'gte': return { clause: `${sql} >= $${paramIdx}`, value: filter.value };
        case 'lte': return { clause: `${sql} <= $${paramIdx}`, value: filter.value };
        case 'like': return { clause: `${sql} ILIKE $${paramIdx}`, value: `%${filter.value}%` };
        case 'in': return { clause: `${sql} = ANY($${paramIdx})`, value: filter.value.split(',') };
        default: return { clause: `${sql} = $${paramIdx}`, value: filter.value };
    }
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

const resolvers = {
    // Lista de centros con datos anidados
    centros: async (_, args, context) => {
        const client = await pool.connect();
        try {
            const centroIds = await getAccessibleCentroIds(context.userId, client);
            const { clause: tenantClause, params: tenantParams, nextParam } = buildTenantClause(centroIds, 'c', 1);

            let filterClauses = [];
            let filterParams = [];
            let paramIdx = nextParam || 1;

            if (args.tipo_establecimiento) {
                filterClauses.push(`c.tipo_establecimiento = $${paramIdx}`);
                filterParams.push(args.tipo_establecimiento);
                paramIdx++;
            }
            if (args.tipo_clasificacion) {
                filterClauses.push(`c.tipo_clasificacion = $${paramIdx}`);
                filterParams.push(args.tipo_clasificacion);
                paramIdx++;
            }
            if (args.estado_centro) {
                filterClauses.push(`c.estado_centro = $${paramIdx}`);
                filterParams.push(args.estado_centro);
                paramIdx++;
            }

            const allParams = [...tenantParams, ...filterParams];
            const filterSQL = filterClauses.length ? 'AND ' + filterClauses.join(' AND ') : '';

            const sql = `
                SELECT c.*, g.parroquia AS parroquia, g.municipio AS municipio, g.estado AS estado
                FROM public.centros c
                LEFT JOIN public.geografia g ON g.parish_id = c.parroquia_id
                WHERE c.deleted_at IS NULL ${tenantClause} ${filterSQL}
                ORDER BY c.nombre_establecimiento
            `;

            const result = await client.query(sql, allParams);
            return result.rows;
        } finally {
            client.release();
        }
    },

    // Centro individual con datos completos
    centro: async (_, args, context) => {
        const client = await pool.connect();
        try {
            const centroIds = await getAccessibleCentroIds(context.userId, client);
            if (centroIds !== null && !centroIds.includes(args.id)) {
                return null; // Sin acceso
            }

            const result = await client.query(
                `SELECT c.*, g.parroquia AS parroquia, g.municipio AS municipio, g.estado AS estado
                 FROM public.centros c
                 LEFT JOIN public.geografia g ON g.parish_id = c.parroquia_id
                 WHERE c.id = $1 AND c.deleted_at IS NULL`,
                [args.id]
            );

            if (!result.rows.length) return null;
            const centro = result.rows[0];

            // Cargar datos anidados
            const [propietarios, representantes, telefonos, correos] = await Promise.all([
                client.query('SELECT * FROM public.centro_propietarios WHERE centro_id = $1 AND deleted_at IS NULL', [args.id]),
                client.query('SELECT * FROM public.centro_representantes WHERE centro_id = $1 AND deleted_at IS NULL', [args.id]),
                client.query('SELECT * FROM public.centro_telefonos WHERE centro_id = $1 AND deleted_at IS NULL', [args.id]),
                client.query('SELECT * FROM public.centro_correos WHERE centro_id = $1 AND deleted_at IS NULL', [args.id]),
            ]);

            // Ficha actual
            const fichaResult = await client.query(
                `SELECT * FROM public.fichas_establecimiento WHERE centro_id = $1 AND is_current = TRUE AND deleted_at IS NULL`,
                [args.id]
            );

            let ficha_actual = null;
            if (fichaResult.rows.length) {
                const ficha = fichaResult.rows[0];
                const [cap, per, srv, inf, pob, doc] = await Promise.all([
                    client.query('SELECT * FROM public.ficha_capacidad WHERE ficha_id = $1 AND deleted_at IS NULL', [ficha.id]),
                    client.query('SELECT * FROM public.ficha_personal WHERE ficha_id = $1 AND deleted_at IS NULL', [ficha.id]),
                    client.query('SELECT * FROM public.ficha_servicios WHERE ficha_id = $1 AND deleted_at IS NULL', [ficha.id]),
                    client.query('SELECT * FROM public.ficha_infraestructura WHERE ficha_id = $1 AND deleted_at IS NULL', [ficha.id]),
                    client.query('SELECT * FROM public.ficha_poblacion WHERE ficha_id = $1 AND deleted_at IS NULL ORDER BY fecha_corte DESC', [ficha.id]),
                    client.query('SELECT * FROM public.ficha_documentos WHERE ficha_id = $1 AND deleted_at IS NULL', [ficha.id]),
                ]);

                ficha_actual = {
                    ...ficha,
                    capacidad: cap.rows[0] || null,
                    personal: per.rows[0] || null,
                    servicios: srv.rows[0] || null,
                    infraestructura: inf.rows[0] || null,
                    poblacion: pob.rows,
                    documentos: doc.rows,
                };
            }

            return {
                ...centro,
                ficha_actual,
                propietarios: propietarios.rows,
                representantes: representantes.rows,
                telefonos: telefonos.rows,
                correos: correos.rows,
            };
        } finally {
            client.release();
        }
    },

    // ─── Dashboard Data: consulta flexible para tabla pivote ──────────────────
    dashboardData: async (_, args, context) => {
        const client = await pool.connect();
        try {
            const centroIds = await getAccessibleCentroIds(context.userId, client);

            const requestedFields = args.fields || ['centro.nombre', 'centro.tipo_establecimiento'];
            const filters = args.filters || [];
            const groupByFields = args.groupBy || [];
            const valueFields = args.values || [];
            const limit = args.limit || 5000;

            // Determinar tablas necesarias
            const allFieldKeys = [
                ...requestedFields,
                ...groupByFields,
                ...valueFields.map(v => v.field),
                ...filters.map(f => f.field),
            ];
            const requiredTables = [...new Set(allFieldKeys.map(f => FIELD_MAP[f]?.table).filter(Boolean))];

            // JOIN dinámico
            const joinsSQL = buildJoins(requiredTables);

            // Tenant filter
            const { clause: tenantClause, params: tenantParams } = buildTenantClause(centroIds, 'c', 1);
            let paramIdx = tenantParams.length + 1;

            // User filters
            let filterClauses = [];
            let filterParamValues = [];
            for (const f of filters) {
                const result = buildFilterCondition(f, paramIdx);
                if (result) {
                    filterClauses.push(result.clause);
                    filterParamValues.push(result.value);
                    paramIdx++;
                }
            }
            const filterSQL = filterClauses.length ? 'AND ' + filterClauses.join(' AND ') : '';

            // SELECT columns
            let selectParts = [];
            let columnNames = [];

            if (groupByFields.length > 0 || valueFields.length > 0) {
                // Agregación (con o sin agrupamiento)
                for (const gf of groupByFields) {
                    const def = FIELD_MAP[gf];
                    if (def) {
                        const alias = gf.replace('.', '_');
                        selectParts.push(`${def.sql} AS ${alias}`);
                        columnNames.push(gf);
                    }
                }
                for (const vf of valueFields) {
                    const def = FIELD_MAP[vf.field];
                    if (def) {
                        const agg = vf.aggregation || 'COUNT';
                        const alias = `${vf.field.replace('.', '_')}_${agg.toLowerCase()}`;
                        if (agg === 'COUNT') {
                            selectParts.push(`COUNT(${def.sql}) AS ${alias}`);
                        } else {
                            selectParts.push(`${agg}(${def.sql}::numeric) AS ${alias}`);
                        }
                        columnNames.push(`${vf.field}(${agg})`);
                    }
                }
                // Si hay valores pero no agrupación, resultará en 1 sola fila (Total Global)
                if (groupByFields.length === 0 && valueFields.length === 0) {
                    selectParts.push('COUNT(*) AS count');
                    columnNames.push('count');
                }
            } else {
                // Sin agregación: SELECT raw fields
                for (const rf of requestedFields) {
                    const def = FIELD_MAP[rf];
                    if (def) {
                        const alias = rf.replace('.', '_');
                        selectParts.push(`${def.sql} AS ${alias}`);
                        columnNames.push(rf);
                    }
                }
            }

            if (selectParts.length === 0) {
                selectParts.push('c.id AS centro_id');
                columnNames.push('centro.id');
            }

            const groupBySQL = groupByFields.length
                ? 'GROUP BY ' + groupByFields.map(gf => FIELD_MAP[gf]?.sql).filter(Boolean).join(', ')
                : '';

            const sql = `
                SELECT ${selectParts.join(', ')}
                FROM public.centros c
                ${joinsSQL}
                WHERE c.deleted_at IS NULL ${tenantClause} ${filterSQL}
                ${groupBySQL}
                ORDER BY 1
                LIMIT ${Math.min(limit, 10000)}
            `;

            const allParams = [...tenantParams, ...filterParamValues];
            const result = await client.query(sql, allParams);

            return {
                columns: columnNames,
                rows: JSON.stringify(result.rows),
                totalRows: result.rows.length,
            };
        } finally {
            client.release();
        }
    },

    // Metadata de campos disponibles
    availableFields: async () => {
        const fields = Object.entries(FIELD_MAP).map(([key, def]) => ({
            key,
            label: def.label,
            category: def.category,
            numeric: !!def.numeric,
            date: !!def.date,
        }));
        return JSON.stringify(fields);
    },
};

module.exports = { resolvers, FIELD_MAP };
