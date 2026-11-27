// src/controllers_verificacion.js
// Verificación pública de centros (acceso sin autenticación).
// Usada por la página de verificación a la que apunta el QR del PDF de la ficha.
// Devuelve TODA la data que muestra el PDF, EXCEPTO:
//  - números de cédula de propietarios y representantes legales
//  - las secciones de documentos (del centro ni del personal)
const pool = require('./db');

/**
 * GET /verificacion/centros/:id  (público)
 */
exports.getCentroVerificacion = async (req, res) => {
    const { id } = req.params;
    const centroId = parseInt(id, 10);
    if (!Number.isInteger(centroId) || centroId < 1) {
        return res.status(400).json({ error: 'Identificador de centro inválido.' });
    }

    const client = await pool.connect();
    try {
        // ── Centro (solo columnas comprobadas; sin datos sensibles) ──
        const centroRes = await client.query(
            `SELECT c.id,
                    c.nombre_establecimiento,
                    c.rif,
                    c.nro_registro_mercantil,
                    te.nombre AS tipo_establecimiento,
                    tc.nombre AS tipo_clasificacion,
                    c.estado_centro,
                    c.foto_base64,
                    g.parroquia,
                    g.municipio,
                    g.estado
             FROM public.centros c
             LEFT JOIN LATERAL (
                 SELECT g.parroquia, g.municipio, g.estado
                 FROM public.geografia g
                 WHERE g.codigo_ine::integer = c.parroquia_id
                    OR g.id = c.parroquia_id
                    OR g.parish_id = c.parroquia_id
                 ORDER BY
                     (g.codigo_ine::integer = c.parroquia_id) DESC,
                     (g.id = c.parroquia_id) DESC,
                     (g.parish_id = c.parroquia_id) DESC
                 LIMIT 1
             ) g ON TRUE
             LEFT JOIN public.tipos_establecimiento te ON te.id = c.tipo_establecimiento_id
             LEFT JOIN public.tipos_clasificacion tc ON tc.id = c.tipo_clasificacion_id
             WHERE c.id = $1 AND c.deleted_at IS NULL`,
            [centroId]
        );

        if (!centroRes.rows.length) {
            return res.status(404).json({ error: 'Centro no encontrado o inexistente.' });
        }
        const centro = centroRes.rows[0];

        // ── Propietarios (SIN cédulas), representantes (SIN cédulas) y contacto ──
        const [propietarios, representantes, telefonos, correos] = await Promise.all([
            client.query(
                `SELECT nombre, es_principal
                 FROM public.centro_propietarios
                 WHERE centro_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
                [centroId]
            ),
            client.query(
                `SELECT nombre, cargo
                 FROM public.centro_representantes
                 WHERE centro_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
                [centroId]
            ),
            client.query(
                `SELECT telefono, tipo
                 FROM public.centro_telefonos
                 WHERE centro_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
                [centroId]
            ),
            client.query(
                `SELECT correo, tipo
                 FROM public.centro_correos
                 WHERE centro_id = $1 AND deleted_at IS NULL ORDER BY id ASC`,
                [centroId]
            ),
        ]);

        // ── Ficha técnica vigente (sin documentos) ──
        const fichaRes = await client.query(
            `SELECT f.id, f.version, f.tipo_solicitud, f.nro_registro_nacional,
                    f.fecha_solicitud, f.fecha_fundacion, f.costo_mensual, f.direccion,
                    f.created_at, f.updated_at
             FROM public.fichas_establecimiento f
             WHERE f.centro_id = $1 AND f.is_current = TRUE AND f.deleted_at IS NULL
             ORDER BY f.version DESC
             LIMIT 1`,
            [centroId]
        );

        let ficha = null;
        if (fichaRes.rows.length) {
            const fichaId = fichaRes.rows[0].id;

            const [servicios, personal, infraestructura, accesibilidad, capacidad, poblacion] = await Promise.all([
                client.query('SELECT * FROM public.ficha_servicios WHERE ficha_id = $1', [fichaId]),
                client.query('SELECT * FROM public.ficha_personal WHERE ficha_id = $1', [fichaId]),
                client.query(`
                    SELECT fi.*,
                           ei.nombre AS estado_inmueble_nombre,
                           tp.nombre AS planta_electrica_tipo_nombre
                    FROM public.ficha_infraestructura fi
                    LEFT JOIN public.estados_inmueble ei ON ei.id = fi.estado_inmueble_id
                    LEFT JOIN public.tipo_planta tp ON tp.id = fi.planta_electrica_tipo_id
                    WHERE fi.ficha_id = $1
                `, [fichaId]),
                client.query('SELECT * FROM public.ficha_accesibilidad WHERE ficha_id = $1', [fichaId]),
                client.query('SELECT * FROM public.ficha_capacidad WHERE ficha_id = $1', [fichaId]),
                client.query(
                    'SELECT * FROM public.ficha_poblacion WHERE ficha_id = $1 ORDER BY fecha_corte DESC',
                    [fichaId]
                ),
            ]);

            // Servicios adicionales del catálogo (ficha_servicios.extras jsonb {id: true})
            // rotulados con el nombre del catálogo servicios_catalogo
            let serviciosExtras = [];
            const sRow = servicios.rows[0];
            if (sRow?.extras && typeof sRow.extras === 'object') {
                const catalogo = await client.query(
                    'SELECT id, nombre FROM public.servicios_catalogo WHERE activo IS NOT FALSE'
                );
                const nombres = new Map(catalogo.rows.map(c => [String(c.id), c.nombre]));
                serviciosExtras = Object.entries(sRow.extras)
                    .filter(([, v]) => v)
                    .map(([id]) => ({
                        id,
                        label: nombres.get(String(id))
                            || String(id).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    }));
            }

            ficha = {
                ...fichaRes.rows[0],
                capacidad: capacidad.rows[0] || null,
                poblacion: poblacion.rows,
                servicios: sRow || null,
                servicios_extras: serviciosExtras,
                personal: personal.rows[0] || null,
                infraestructura: infraestructura.rows[0] || null,
                accesibilidad: accesibilidad.rows[0] || null,
            };
        }

        res.json({
            centro,
            propietarios: propietarios.rows,
            representantes: representantes.rows,
            telefonos: telefonos.rows,
            correos: correos.rows,
            ficha,
            generado_en: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Error en verificación pública de centro:', err);
        res.status(500).json({ error: 'Error al verificar los datos del centro.' });
    } finally {
        client.release();
    }
};
