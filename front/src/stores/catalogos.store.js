// src/stores/catalogos.store.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { catalogosService } from 'src/services/catalogos.service';

// Valores por defecto como salvaguarda
const DEFAULT_TIPOS_ESTAB = [
    { value: 'publico', label: 'Público' },
    { value: 'afiliada_ivss', label: 'Afiliada IVSS' },
    { value: 'privado', label: 'Privado' },
    { value: 'religiosa', label: 'Religioso' },
    { value: 'otra', label: 'Otra' },
];

const DEFAULT_TIPOS_CLASIF = [
    { value: 'geriatrico', label: 'Geriátrico' },
    { value: 'gronto_psiquiatrico', label: 'Gronto-Psiquiátrico' },
    { value: 'casa_hogar', label: 'Casa Hogar' },
    { value: 'unidades_gerontologicas', label: 'Unidades Gerontológicas' },
    { value: 'fundacion', label: 'Fundación' },
    { value: 'otras', label: 'Otras' },
];

const DEFAULT_DOCS = [
    { tipo_documento: 'carta_solicitud', tipo_documento_label: 'Carta de solicitud' },
    { tipo_documento: 'copia_cedula_propietario', tipo_documento_label: 'Copia cédula propietario' },
    { tipo_documento: 'registro_mercantil', tipo_documento_label: 'Registro mercantil' },
    { tipo_documento: 'rif', tipo_documento_label: 'RIF' },
    { tipo_documento: 'documento_inmueble', tipo_documento_label: 'Documento del inmueble' },
    { tipo_documento: 'conformidad_uso', tipo_documento_label: 'Conformidad de uso' },
    { tipo_documento: 'permiso_sanitario_local', tipo_documento_label: 'Permiso sanitario local' },
    { tipo_documento: 'permiso_sanitario_alimentos', tipo_documento_label: 'Permiso sanitario alimentos' },
    { tipo_documento: 'plano_inmueble', tipo_documento_label: 'Plano del inmueble' },
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

export const useCatalogosStore = defineStore('catalogos', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const tiposEstablecimiento = ref([]);
    const tiposClasificacion = ref([]);
    const tiposDocumentos = ref([]);
    const serviciosCatalogo = ref([]);
    const loading = ref(false);
    const initialized = ref(false);

    // ─── Getters formateados para componentes ────────────────────────────────
    const opcionesTipoEstab = computed(() => {
        if (tiposEstablecimiento.value.length > 0) {
            return tiposEstablecimiento.value
                .filter(t => t.activo !== false)
                .map(t => ({ value: t.codigo, label: t.nombre }));
        }
        return DEFAULT_TIPOS_ESTAB;
    });

    const opcionesTipoClasif = computed(() => {
        if (tiposClasificacion.value.length > 0) {
            return tiposClasificacion.value
                .filter(t => t.activo !== false)
                .map(t => ({ value: t.codigo, label: t.nombre }));
        }
        return DEFAULT_TIPOS_CLASIF;
    });

    const opcionesDocumentos = computed(() => {
        if (tiposDocumentos.value.length > 0) {
            return tiposDocumentos.value
                .filter(d => d.activo !== false)
                .map(d => ({
                    tipo_documento: d.codigo,
                    tipo_documento_label: d.nombre,
                    descripcion: d.descripcion || ''
                }));
        }
        return DEFAULT_DOCS;
    });

    const opcionesServicios = computed(() => {
        if (serviciosCatalogo.value.length > 0) {
            return serviciosCatalogo.value
                .filter(s => s.activo !== false)
                .map(s => ({
                    field: s.codigo,
                    label: s.nombre,
                    categoria: s.categoria || 'General',
                    desc: ['medicos', 'lavanderia', 'otros'].includes(s.codigo) ? `${s.codigo}_descripcion` : null
                }));
        }
        return DEFAULT_SERVICIOS;
    });

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
            }
        } catch (err) {
            console.error(`Error al actualizar catálogo '${catalogKey}':`, err);
        }
    }

    async function fetchAll(force = false) {
        if (initialized.value && !force) return;
        loading.value = true;
        try {
            await Promise.allSettled([
                fetchCatalog('tipos_establecimiento'),
                fetchCatalog('tipos_clasificacion'),
                fetchCatalog('tipos_documentos'),
                fetchCatalog('servicios_catalogo')
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
        loading,
        initialized,
        // Getters reactivos
        opcionesTipoEstab,
        opcionesTipoClasif,
        opcionesDocumentos,
        opcionesServicios,
        // Acciones
        fetchCatalog,
        fetchAll,
        initWebSocketListener
    };
});
