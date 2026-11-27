// src/stores/catalogos.store.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { catalogosService } from 'src/services/catalogos.service';

// Valores por defecto como salvaguarda (ids alineados con bd/20261126_2100_tipos_documentos_sin_codigo.sql)
const DEFAULT_DOCS = [
    { tipo_documento: '1', tipo_documento_label: 'Carta de solicitud' },
    { tipo_documento: '2', tipo_documento_label: 'Copia cédula propietario' },
    { tipo_documento: '3', tipo_documento_label: 'Registro mercantil' },
    { tipo_documento: '4', tipo_documento_label: 'RIF' },
    { tipo_documento: '5', tipo_documento_label: 'Documento del inmueble' },
    { tipo_documento: '6', tipo_documento_label: 'Conformidad de uso' },
    { tipo_documento: '7', tipo_documento_label: 'Permiso sanitario local' },
    { tipo_documento: '8', tipo_documento_label: 'Permiso sanitario alimentos' },
    { tipo_documento: '9', tipo_documento_label: 'Plano del inmueble' },
];

const DEFAULT_SERVICIOS = [
    { field: 'farmacia', label: 'Farmacia' },
    { field: 'evaluacion_nutricional', label: 'Evaluación Nutricional' },
    { field: 'actividades_recreativas', label: 'Actividades Recreativas' },
    { field: 'servicio_emergencia', label: 'Servicio de Emergencia' },
    { field: 'servicio_funerario', label: 'Servicio Funerario' },
    { field: 'medicos', label: 'Médicos', desc: 'medicos_descripcion' },
    { field: 'lavanderia', label: 'Lavandería', desc: 'lavanderia_descripcion' },
    { field: 'barberia_peluqueria', label: 'Barbería / Peluquería' },
    { field: 'otros', label: 'Otros Servicios', desc: 'otros_descripcion' },
];

// Id del RIF en tipos_documentos (estable en dev y producción); acepta también el
// codigo legado 'rif' por compatibilidad con datos viejos
export const ID_TIPO_DOC_RIF = 4;
export const esTipoDocRif = (v) => {
    const s = String(v ?? '').trim();
    return s === String(ID_TIPO_DOC_RIF) || s.toLowerCase() === 'rif';
};

// Columnas fijas de ficha_servicios para los ids 1-9 del catálogo; los demás
// servicios se guardan en ficha_servicios.extras con el id (como texto) como clave
const SERVICIOS_FIJOS = {
    1: { field: 'farmacia' },
    2: { field: 'evaluacion_nutricional' },
    3: { field: 'actividades_recreativas' },
    4: { field: 'servicio_emergencia' },
    5: { field: 'servicio_funerario' },
    6: { field: 'medicos', desc: 'medicos_descripcion' },
    7: { field: 'lavanderia', desc: 'lavanderia_descripcion' },
    8: { field: 'barberia_peluqueria' },
    9: { field: 'otros', desc: 'otros_descripcion' },
};

const DEFAULT_ESTADOS_INMUEBLE = [
    { value: 1, label: 'Excelente' },
    { value: 2, label: 'Bueno' },
    { value: 3, label: 'Deficiente' },
    { value: 4, label: 'Regular' },
];

const DEFAULT_TIPOS_PLANTA = [
    { value: 1, label: 'Combustible gasolina', es_baterias: false },
    { value: 2, label: 'Combustible gasoil', es_baterias: false },
    { value: 3, label: 'Combustible kerosen', es_baterias: false },
    { value: 4, label: 'Estaciones de baterías fijas', es_baterias: true },
    { value: 5, label: 'Estaciones de baterías portátiles', es_baterias: true },
];

// Capitaliza un nombre para su visualización: primera letra en mayúsculas,
// resto en minúsculas, independientemente de cómo esté almacenado
const capitalizarNombre = (s) => {
    const str = String(s || '').trim();
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;
};

export const useCatalogosStore = defineStore('catalogos', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const tiposEstablecimiento = ref([]);
    const tiposClasificacion = ref([]);
    const tiposDocumentos = ref([]);
    const serviciosCatalogo = ref([]);
    const estadosInmueble = ref([]);
    const tiposPlanta = ref([]);
    const tiposDocumentoTrabajador = ref([]);
    const loading = ref(false);
    const initialized = ref(false);

    // ─── Getters formateados para componentes ────────────────────────────────
    const opcionesTipoEstab = computed(() =>
        tiposEstablecimiento.value
            .filter(t => t.activo !== false)
            .map(t => ({ value: Number(t.id), label: t.nombre, requiere_descripcion: !!t.requiere_descripcion }))
    );

    const opcionesTipoClasif = computed(() =>
        tiposClasificacion.value
            .filter(t => t.activo !== false)
            .map(t => ({ value: Number(t.id), label: t.nombre }))
    );

    const opcionesDocumentos = computed(() => {
        if (tiposDocumentos.value.length > 0) {
            return tiposDocumentos.value
                .filter(d => d.activo !== false)
                .map(d => ({
                    tipo_documento: String(d.id),
                    tipo_documento_label: capitalizarNombre(d.nombre),
                    descripcion: d.descripcion || ''
                }));
        }
        return DEFAULT_DOCS;
    });

    const opcionesServicios = computed(() => {
        if (serviciosCatalogo.value.length > 0) {
            return serviciosCatalogo.value
                .filter(s => s.activo !== false)
                .map(s => {
                    const fijo = SERVICIOS_FIJOS[s.id];
                    return {
                        field: fijo?.field ?? String(s.id),
                        label: s.nombre,
                        categoria: s.categoria || 'General',
                        desc: fijo?.desc ?? null
                    };
                });
        }
        return DEFAULT_SERVICIOS;
    });

    const opcionesEstadoInmueble = computed(() => {
        if (estadosInmueble.value.length > 0) {
            return estadosInmueble.value
                .filter(e => e.activo !== false)
                .map(e => ({ value: Number(e.id), label: e.nombre }));
        }
        return DEFAULT_ESTADOS_INMUEBLE;
    });

    const opcionesTiposPlanta = computed(() => {
        if (tiposPlanta.value.length > 0) {
            return tiposPlanta.value
                .filter(t => t.activo !== false)
                .map(t => ({ value: Number(t.id), label: t.nombre, es_baterias: !!t.es_baterias }));
        }
        return DEFAULT_TIPOS_PLANTA;
    });

    const opcionesDocsTrabajador = computed(() =>
        tiposDocumentoTrabajador.value
            .filter(t => t.activo !== false)
            .map(t => ({ id: Number(t.id), label: capitalizarNombre(t.nombre) }))
    );

    // ─── Acciones de consulta ────────────────────────────────────────────────
    async function fetchCatalog(catalogKey) {
        try {
            const { data } = await catalogosService.list(catalogKey, { limit: 500 });
            const items = data.data || [];

            if (catalogKey === 'tipos_establecimiento') {
                tiposEstablecimiento.value = items;
            } else if (catalogKey === 'tipos_clasificacion') {
                tiposClasificacion.value = items;
            } else if (catalogKey === 'tipos_documentos') {
                tiposDocumentos.value = items;
            } else if (catalogKey === 'servicios_catalogo') {
                serviciosCatalogo.value = items;
            } else if (catalogKey === 'estados_inmueble') {
                estadosInmueble.value = items;
            } else if (catalogKey === 'tipo_documento_trabajador') {
                tiposDocumentoTrabajador.value = items;
            } else if (catalogKey === 'tipo_planta') {
                tiposPlanta.value = items;
            }
        } catch (err) {
            console.error(`Error al actualizar catálogo '${catalogKey}':`, err);
        }
    }

    async function fetchAll(force = false) {
        if (initialized.value && !force && estadosInmueble.value.length > 0) return;
        loading.value = true;
        try {
            await Promise.allSettled([
                fetchCatalog('tipos_establecimiento'),
                fetchCatalog('tipos_clasificacion'),
                fetchCatalog('tipos_documentos'),
                fetchCatalog('servicios_catalogo'),
                fetchCatalog('estados_inmueble'),
                fetchCatalog('tipo_documento_trabajador'),
                fetchCatalog('tipo_planta')
            ]);
            initialized.value = true;
        } finally {
            loading.value = false;
        }
    }

    // ─── Listener en tiempo real para eventos de WebSocket ───────────────────
    let isListening = false;

    function initWebSocketListener() {
        if (isListening || typeof window === 'undefined') return;
        isListening = true;

        window.addEventListener('catalogs-updated', async (event) => {
            const catalog = event?.detail?.catalog;
            console.log(`⚡ Evento en tiempo real: Catálogo '${catalog}' actualizado. Refrescando opciones...`);

            if (catalog) {
                await fetchCatalog(catalog);
            } else {
                await fetchAll(true);
            }
        });
    }

    // Inicializar listener inmediatamente
    initWebSocketListener();

    return {
        // Estado
        tiposEstablecimiento,
        tiposClasificacion,
        tiposDocumentos,
        serviciosCatalogo,
        estadosInmueble,
        tiposPlanta,
        tiposDocumentoTrabajador,
        loading,
        initialized,
        // Getters reactivos
        opcionesTipoEstab,
        opcionesTipoClasif,
        opcionesDocumentos,
        opcionesServicios,
        opcionesEstadoInmueble,
        opcionesTiposPlanta,
        opcionesDocsTrabajador,
        // Acciones
        fetchCatalog,
        fetchAll,
        initWebSocketListener
    };
});
