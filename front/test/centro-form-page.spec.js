import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { Quasar, Notify, QSelect } from 'quasar';
import { quasarComponents, quasarDirectives } from './quasar-components.js';
import CentroFormPage from 'src/pages/centros/CentroFormPage.vue';
import { fichasService } from 'src/services/centros.service';

// ── Estado compartido (hoisted para usarlo dentro de los factories de vi.mock) ──
const state = vi.hoisted(() => ({
    centro: null,
    ficha: null,
    order: [],   // registro del orden de llamadas de guardado
    opcionesDocumentos: [],   // catálogo de documentos (configurable por test)
}));

// ── Mocks de módulos externos ─────────────────────────────────────────────────
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useRoute: () => ({ params: { id: '336' } }),   // modo edición: centro 336
}));

vi.mock('quasar', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Notify: { create: vi.fn() },
        LocalStorage: { getItem: vi.fn(() => null), set: vi.fn(), remove: vi.fn() },
    };
});

vi.mock('src/services/centros.service', () => ({
    miCentroService: { get: vi.fn(async () => ({ data: null })) },
    geoService: {
        getEstados: vi.fn(async () => ({ data: [] })),
        getMunicipios: vi.fn(async () => ({ data: [] })),
        getParroquias: vi.fn(async () => ({ data: [] })),
        proxySearch: vi.fn(async () => ({ data: [] })),
        proxyReverse: vi.fn(async () => ({ data: {} })),
        resolveGeo: vi.fn(async () => ({ data: {} })),
    },
    centrosService: {
        create: vi.fn(async () => ({ data: { centro: { id: 1 } } })),
        update: vi.fn(async () => ({ data: {} })),
        get: vi.fn(async () => ({ data: {} })),
        consultarIdentidad: vi.fn(async () => ({ data: { encontrado: false } })),
        getRifArchivo: vi.fn(async () => ({ data: new Blob() })),
        reemplazarRifArchivo: vi.fn(async () => ({ data: {} })),
    },
    fichasService: {
        create: vi.fn(async () => ({ data: { ficha: { id: 777 } } })),
        update: vi.fn(async () => ({ data: {} })),
        saveCapacidad: vi.fn(async () => { state.order.push('capacidad'); return { data: {} }; }),
        addPoblacion: vi.fn(async () => { state.order.push('poblacion'); return { data: {} }; }),
        saveInfraestructura: vi.fn(async () => ({ data: {} })),
        saveAccesibilidad: vi.fn(async () => ({ data: {} })),
        savePersonal: vi.fn(async () => ({ data: {} })),
        saveServicios: vi.fn(async () => ({ data: {} })),
        saveDocumentos: vi.fn(async () => ({ data: {} })),
        getDocumentoArchivo: vi.fn(async () => ({ data: new Blob() })),
    },
}));

vi.mock('src/stores/centros.store', () => ({
    useCentrosStore: () => ({
        estados: [], municipios: [], parroquias: [],
        loading: false, centroUsers: [],
        fetchEstados: vi.fn(async () => {}),
        fetchMunicipios: vi.fn(async () => {}),
        fetchParroquias: vi.fn(async () => {}),
        fetchCentro: vi.fn(async () => state.centro),
        fetchFichaActual: vi.fn(async () => state.ficha),
    }),
}));

vi.mock('src/stores/catalogos.store', () => ({
    useCatalogosStore: () => ({
        opcionesTipoEstab: [], opcionesTipoClasif: [], opcionesEstadoInmueble: [],
        opcionesTiposPlanta: [], opcionesServicios: [],
        opcionesDocumentos: state.opcionesDocumentos,
        fetchAll: vi.fn(async () => {}),
        fetchCatalog: vi.fn(async () => {}),
    }),
}));

// ── Polyfills jsdom ───────────────────────────────────────────────────────────
class RO { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = window.ResizeObserver || RO;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {} }));

// ── Fixtures (centro 336) ─────────────────────────────────────────────────────
const CENTRO_BASE = {
    id: 336,
    nombre_establecimiento: 'Centro Trescientos Treinta y Seis',
    rif: 'J-12345678-9',
    nro_registro_mercantil: 'RM-001',
    parroquia_id: 1,
    tipo_establecimiento: 'hogar',
    tipo_clasificacion: 'privado',
    latitud: 10.5, longitud: -66.9,
    foto_base64: null, rif_archivo: null,
    propietarios: [], representantes: [], telefonos: [], correos: [],
};

const FICHA_COMPLETA = {
    id: 777,
    tipo_solicitud: 'registro_autorizacion',
    fecha_fundacion: '2000-01-01',
    direccion: 'Calle 1',
    capacidad: { capacidad_total_residente: 20, capacidad_actual_residente: 15, atencion_ambulatoria: true, num_atencion_ambulatoria: 5 },
    poblacion: [{ modalidad: 'residente', categoria: 'adultos', femenino: 8, masculino: 7 }],
    servicios: { farmacia: true },
    personal: { num_medicos: 1 },
    infraestructura: { estado_inmueble_id: 1, luz_electrica: true },
    accesibilidad: { rampas_fijas: true },
    documentos: [],
};

const FICHA_SIN_POB_CAP = { ...FICHA_COMPLETA, capacidad: null, poblacion: null };

async function mountPage(ficha, centro = CENTRO_BASE, opcionesDocumentos = []) {
    state.centro = centro;
    state.ficha = ficha;
    state.opcionesDocumentos = opcionesDocumentos;
    const wrapper = mount(CentroFormPage, {
        global: {
            plugins: [[Quasar, {}]],
            components: quasarComponents,
            directives: quasarDirectives,
            stubs: { QPage: { template: '<div><slot /></div>' } },
        },
    });
    await flushPromises();
    return wrapper;
}

function progressCard(wrapper) {
    return wrapper.findAll('.q-card').at(0);   // primera tarjeta = barra de progreso global
}

function progressText(wrapper) {
    return progressCard(wrapper).text();
}

function divisiones(wrapper) {
    return progressCard(wrapper).find('.row.no-wrap.items-center').findAll(':scope > div');
}

async function abrirTabPoblacion(wrapper) {
    await wrapper.findAll('.q-tab').at(1).trigger('click');
    await flushPromises();
}

function boton(wrapper, texto) {
    return wrapper.findAll('button').find(b => b.text().includes(texto));
}

beforeEach(() => {
    vi.clearAllMocks();
    state.order = [];
    state.opcionesDocumentos = [];
});

// Etiqueta de tab sin el nombre del ícono (ligadura de Material Icons)
function etiquetaTab(tab) {
    return tab.text().replace(/^[a-z_]+/, '');
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Estructura general: 7 secciones
// ══════════════════════════════════════════════════════════════════════════════
describe('CentroFormPage (centro 336, edición) — estructura de 7 secciones', () => {
    it('renderiza exactamente 7 tabs con la numeración correcta', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        const tabs = wrapper.findAll('.q-tab');
        expect(tabs.length).toBe(7);
        const textos = tabs.map(etiquetaTab);
        expect(textos).toEqual([
            '1. Datos del Centro',
            '2. Población y Capacidad',
            '3. Infraestructura',
            '4. Accesibilidad',
            '5. Personal',
            '6. Servicios',
            '7. Documentos',
        ]);
        // Ya no existen los tabs separados
        expect(textos.join(' ')).not.toContain('2. Capacidad');
        expect(textos.join(' ')).not.toContain('3. Población');
    });

    it('la etiqueta de progreso general dice "de 7 secciones completadas"', async () => {        const wrapper = await mountPage(FICHA_COMPLETA);
        expect(progressText(wrapper)).toContain('de 7 secciones completadas');
        // Ficha completa salvo documentos → 6 de 7
        expect(progressText(wrapper)).toContain('6 de 7');
    });

    it('la barra de progreso tiene 7 divisiones y los chips son 7', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        expect(divisiones(wrapper).length).toBe(7);
        expect(progressCard(wrapper).findAll('.q-chip').length).toBe(7);
    });

    it('semáforo: 3 rojas / 3 naranjas / última pendiente en gris', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        const divs = divisiones(wrapper);
        for (let i = 0; i < 3; i++) {
            expect(divs[i].element.style.backgroundColor).toBe('rgb(229, 57, 53)'); // rojo #e53935
        }
        for (let i = 3; i < 6; i++) {
            expect(divs[i].element.style.backgroundColor).toBe('rgb(251, 140, 0)'); // naranja #fb8c00
        }
        expect(divs[6].element.style.backgroundColor).toBe('rgb(224, 224, 224)'); // documentos pendiente
    });

    it('semáforo: la última división se vuelve verde cuando las 7 secciones están guardadas', async () => {
        // Ficha con el documento del catálogo ya cargado → documentos completo
        const wrapper = await mountPage(
            {
                ...FICHA_COMPLETA,
                documentos: [{ tipo_documento: 'dni', tiene_archivo: true, archivo_nombre: 'dni.pdf' }],
            },
            CENTRO_BASE,
            [{ tipo_documento: 'dni', tipo_documento_label: 'DNI', descripcion: '' }]
        );
        expect(progressText(wrapper)).toContain('7 de 7');
        const divs = divisiones(wrapper);
        expect(divs[6].element.style.backgroundColor).toBe('rgb(46, 125, 50)'); // verde #2e7d32
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Tab fusionado POBLACIÓN Y CAPACIDAD
// ══════════════════════════════════════════════════════════════════════════════
describe('CentroFormPage (centro 336) — tab fusionado Población y Capacidad', () => {
    it('contiene 2 secciones colapsables: Capacidad primero, Población después', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        const expansiones = wrapper.findAll('.q-expansion-item');
        expect(expansiones.length).toBe(2);
        expect(expansiones[0].text()).toContain('Capacidad Instalada y Uso');
        expect(expansiones[1].text()).toContain('Registro de Población');

        const texto = wrapper.text();
        expect(texto.indexOf('Capacidad total de residentes'))
            .toBeLessThan(texto.indexOf('Fecha de corte'));
    });

    it('ambas secciones colapsables están desplegadas por defecto', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        // Contenido visible sin hacer clic en ningún colapsable
        expect(wrapper.text()).toContain('Capacidad total de residentes');
        expect(wrapper.text()).toContain('Residentes actuales');
        expect(wrapper.text()).toContain('Atención ambulatoria');
        expect(wrapper.text()).toContain('Fecha de corte');
        expect(wrapper.text()).toContain('Residentes y ambulatorios por condición de autonomía');
    });

    it('muestra UNA sola barra de progreso combinada (Capacidad + Población = 5 campos)', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        const contador = wrapper.findAll('.text-caption').map(c => c.text())
            .find(t => t.includes('Campos diligenciados en esta sección'));
        expect(contador).toBeTruthy();
        // capacidad: 3 campos llenos (residentes actuales se calcula) + población:
        // fecha_corte + registros (hidratados desde la ficha en edición) → 5/5
        expect(wrapper.text()).toContain('5 / 5');
    });

    it('el tab fusionado muestra el badge de "guardada" cuando ambos datos existen', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        const tabs = wrapper.findAll('.q-tab');
        expect(tabs[1].find('.q-badge').exists()).toBe(true);   // 2. Población y Capacidad
        expect(tabs[0].find('.q-badge').exists()).toBe(true);   // 1. Datos
    });

    it('el select de categoría usa option-value="value" (regresión: "valu" enviaba el objeto y causaba error 500 varchar(30))', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        // Agregar una fila a la tabla de población (en edición no se hidratan
        // las filas guardadas: comportamiento preexistente)
        const btnFila = wrapper.findAll('button').find(b => b.text().includes('Agregar fila'));
        expect(btnFila).toBeTruthy();
        await btnFila.trigger('click');
        await flushPromises();

        // Buscar por la definición del componente (el registro manual de
        // Quasar no permite findAllComponents({ name }) de forma fiable)
        const selects = wrapper.findAllComponents(QSelect);
        const catSelect = selects.find(s =>
            JSON.stringify(s.props('options')).includes('con_discapacidad'));
        expect(catSelect).toBeTruthy();
        expect(catSelect.props('optionValue')).toBe('value');
        // Todas las opciones del select deben tener la propiedad 'value'
        catSelect.props('options').forEach(o => {
            expect(o).toHaveProperty('value');
        });
    });

    it('el tab fusionado NO muestra badge si faltan capacidad o población', async () => {
        const wrapper = await mountPage(FICHA_SIN_POB_CAP);
        const tabs = wrapper.findAll('.q-tab');
        expect(tabs[1].find('.q-badge').exists()).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Residentes actuales calculados + validación de capacidad
// ══════════════════════════════════════════════════════════════════════════════
describe('CentroFormPage (centro 336) — residentes actuales calculados', () => {
    it('Residentes actuales es de solo lectura y muestra el acumulado de la tabla (15)', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        // Buscar entre los inputs deshabilitados el que vale 15
        // (fecha_corte también es disabled, pero su valor es una fecha)
        const deshabilitados = wrapper.findAll('input')
            .filter(i => i.attributes('disabled') !== undefined);
        const residentes = deshabilitados.find(i => i.element.value === '15');
        expect(residentes).toBeTruthy();
    });

    it('muestra advertencia y bloquea guardar/avanzar cuando el acumulado excede la capacidad', async () => {
        // Capacidad total 10, población registrada 8+7 = 15 → excede
        const wrapper = await mountPage({
            ...FICHA_COMPLETA,
            capacidad: { ...FICHA_COMPLETA.capacidad, capacidad_total_residente: 10 },
        });
        await abrirTabPoblacion(wrapper);

        // Banner de advertencia visible
        const plano = wrapper.text().replace(/\s+/g, ' ');
        expect(plano).toContain('excede la Capacidad Total de Residentes');

        // GUARDAR bloqueado: no llama a los servicios y notifica el motivo
        await boton(wrapper, 'Guardar Población y Capacidad').trigger('click');
        await flushPromises();
        expect(fichasService.saveCapacidad).not.toHaveBeenCalled();
        expect(fichasService.addPoblacion).not.toHaveBeenCalled();
        expect(Notify.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'negative',
                message: expect.stringContaining('excede la capacidad total de residentes'),
            })
        );

        // GUARDAR Y SIGUIENTE también bloqueado: no avanza a Infraestructura
        await boton(wrapper, 'Guardar y Siguiente').trigger('click');
        await flushPromises();
        const tabs = wrapper.findAll('.q-tab');
        expect(tabs[1].classes()).toContain('q-tab--active');
        expect(tabs[2].classes()).not.toContain('q-tab--active');

        // Clic en el tab 3 (Infraestructura) tampoco permite cambiar
        await tabs[2].trigger('click');
        await flushPromises();
        expect(wrapper.findAll('.q-tab').at(1).classes()).toContain('q-tab--active');
    });

    it('permite guardar normalmente cuando el acumulado no excede la capacidad', async () => {
        // Capacidad total 20, población registrada 15 → válido
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        expect(wrapper.text()).not.toContain('excede la Capacidad Total');
        await boton(wrapper, 'Guardar Población y Capacidad').trigger('click');
        await flushPromises();
        expect(fichasService.saveCapacidad).toHaveBeenCalledTimes(1);
        expect(fichasService.addPoblacion).toHaveBeenCalledTimes(1);
        expect(Notify.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'positive', message: 'Población y Capacidad guardadas.' })
        );
    });

    it('los registros de población guardados se hidratan al entrar en edición', async () => {
        const wrapper = await mountPage(FICHA_COMPLETA);
        await abrirTabPoblacion(wrapper);

        // La tabla debe mostrar la fila guardada (residente/adultos 8+7)
        const plano = wrapper.text().replace(/\s+/g, ' ');
        expect(plano).toContain('Adultos');
        // Y el acumulado calculado es 15
        const deshabilitados = wrapper.findAll('input')
            .filter(i => i.attributes('disabled') !== undefined);
        expect(deshabilitados.find(i => i.element.value === '15')).toBeTruthy();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Guardado conjunto de los botones del tab fusionado
// ══════════════════════════════════════════════════════════════════════════════
describe('CentroFormPage (centro 336) — guardado de Población y Capacidad', () => {
    it('GUARDAR llama a saveCapacidad y luego a addPoblacion con la ficha 777, y marca la sección', async () => {
        const wrapper = await mountPage(FICHA_SIN_POB_CAP);
        await abrirTabPoblacion(wrapper);

        const btn = boton(wrapper, 'Guardar Población y Capacidad');
        expect(btn).toBeTruthy();
        await btn.trigger('click');
        await flushPromises();

        expect(fichasService.saveCapacidad).toHaveBeenCalledTimes(1);
        expect(fichasService.saveCapacidad).toHaveBeenCalledWith(777,
            expect.objectContaining({ capacidad_total_residente: null }));
        expect(fichasService.addPoblacion).toHaveBeenCalledTimes(1);
        expect(fichasService.addPoblacion).toHaveBeenCalledWith(777,
            expect.objectContaining({ registros: [] }));
        // Orden: primero capacidad, después población
        expect(state.order).toEqual(['capacidad', 'poblacion']);
        // Notificación de éxito conjunta
        expect(Notify.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'positive', message: 'Población y Capacidad guardadas.' })
        );
        // Progreso general: 5 → 6 de 7
        expect(progressText(wrapper)).toContain('6 de 7');
        // La 2ª división del semáforo ya no está gris: toma el color de su posición (rojo)
        expect(divisiones(wrapper)[1].element.style.backgroundColor).toBe('rgb(229, 57, 53)');
    });

    it('GUARDAR Y SIGUIENTE guarda ambas secciones y avanza a Infraestructura', async () => {
        const wrapper = await mountPage(FICHA_SIN_POB_CAP);
        await abrirTabPoblacion(wrapper);

        const btn = boton(wrapper, 'Guardar y Siguiente');
        expect(btn).toBeTruthy();
        await btn.trigger('click');
        await flushPromises();

        expect(fichasService.saveCapacidad).toHaveBeenCalledTimes(1);
        expect(fichasService.addPoblacion).toHaveBeenCalledTimes(1);
        expect(state.order).toEqual(['capacidad', 'poblacion']);

        // El panel activo ahora es Infraestructura
        const tabs = wrapper.findAll('.q-tab');
        expect(tabs[2].classes()).toContain('q-tab--active');
        expect(wrapper.text()).toContain('Infraestructura del Inmueble');
    });

    it('si saveCapacidad falla, no se marca la sección ni se guarda población', async () => {
        fichasService.saveCapacidad.mockRejectedValueOnce(new Error('boom'));
        const wrapper = await mountPage(FICHA_SIN_POB_CAP);
        await abrirTabPoblacion(wrapper);

        await boton(wrapper, 'Guardar Población y Capacidad').trigger('click');
        await flushPromises();

        expect(fichasService.saveCapacidad).toHaveBeenCalledTimes(1);
        expect(fichasService.addPoblacion).not.toHaveBeenCalled();
        expect(Notify.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'negative', message: 'Error al guardar Población y Capacidad.' })
        );
        // El progreso no cambia: sigue 5 de 7
        expect(progressText(wrapper)).toContain('5 de 7');
    });
});
