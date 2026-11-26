<template>
    <q-page class="bg-grey-2 q-pa-sm q-pa-md-lg">
        <q-card flat bordered class="verif-card">
            <!-- Encabezado -->
            <q-card-section class="bg-primary text-white text-center q-pb-sm">
                <div class="text-h6 text-weight-bold">
                    <q-icon name="verified" size="sm" class="q-mr-xs" />
                    Verificación de Registro
                </div>
                <div class="text-caption">
                    RENACER — Registro Nacional de Centros de Atención al Adulto Mayor
                </div>
                <q-btn flat dense no-caps color="white" icon="public" class="q-mt-xs"
                    label="Ir al portal del MINAAMP"
                    href="https://adultosmayores.minaamp.gob.ve" target="_blank" />
            </q-card-section>

            <!-- Cargando -->
            <q-card-section v-if="loading" class="text-center q-pa-xl">
                <q-spinner-dots size="40px" color="primary" />
                <div class="text-caption text-grey-7 q-mt-sm">Verificando datos del centro…</div>
            </q-card-section>

            <!-- No encontrado / error -->
            <q-card-section v-else-if="error" class="text-center q-pa-xl">
                <q-icon name="error_outline" size="48px" color="negative" />
                <div class="text-subtitle1 text-weight-medium q-mt-sm">{{ error }}</div>
                <div class="text-caption text-grey-7">
                    El código escaneado no corresponde a un centro registrado o los datos no están disponibles.
                </div>
            </q-card-section>

            <!-- Datos completos (como el PDF, sin cédulas ni documentos) -->
            <template v-else>
                <q-card-section class="q-pb-none">
                    <div class="text-subtitle1 text-weight-bold text-primary nombre-centro">
                        {{ centro.nombre_establecimiento }}
                    </div>
                    <div class="text-caption text-grey-7">
                        Los datos del documento escaneado coinciden con el siguiente registro oficial
                        (consultado el {{ fechaConsulta }}):
                    </div>
                </q-card-section>

                <q-card-section class="q-pt-sm q-gutter-y-sm">
                    <!-- Secciones (marcado inline: los componentes con template-runtime no renderizan
                         en el build runtime-only de Vue/Quasar) -->
                    <q-expansion-item v-for="sec in secciones" :key="sec.titulo" default-opened dense-toggled
                        :icon="sec.icon" :label="sec.titulo" header-class="text-weight-medium bg-grey-1"
                        class="rounded-borders" bordered>
                        <q-card flat>
                            <q-card-section class="row q-col-gutter-sm">
                                <!-- Fotografía -->
                                <div v-if="sec.tipo === 'foto'" class="col-12">
                                    <q-img :src="fotoSrc" contain style="max-height: 260px" class="rounded-borders" />
                                </div>

                                <!-- Población atendida -->
                                <div v-else-if="sec.tipo === 'poblacion'" class="col-12">
                                    <table class="tabla-pob">
                                        <thead>
                                            <tr class="bg-primary text-white">
                                                <th class="text-left">Modalidad</th>
                                                <th class="text-left">Categoría</th>
                                                <th class="text-center">Fecha Corte</th>
                                                <th class="text-center">Fem.</th>
                                                <th class="text-center">Masc.</th>
                                                <th class="text-center">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(r, i) in poblacion" :key="i" :class="i % 2 ? 'bg-grey-1' : ''">
                                                <td>{{ r.modalidad || '—' }}</td>
                                                <td>{{ r.categoria || '—' }}</td>
                                                <td class="text-center">{{ r.fecha_corte || '—' }}</td>
                                                <td class="text-center">{{ r.femenino ?? 0 }}</td>
                                                <td class="text-center">{{ r.masculino ?? 0 }}</td>
                                                <td class="text-center">{{ r.total ?? 0 }}</td>
                                            </tr>
                                            <tr class="text-weight-bold bg-blue-1">
                                                <td colspan="3">TOTAL GENERAL</td>
                                                <td class="text-center">{{ totalesPoblacion.fem }}</td>
                                                <td class="text-center">{{ totalesPoblacion.masc }}</td>
                                                <td class="text-center">{{ totalesPoblacion.total }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Listas de personas (propietarios / representantes) -->
                                <div v-else-if="sec.lineas" class="col-12">
                                    <template v-for="(ln, i) in sec.lineas" :key="i">
                                        <div v-if="ln.bold" class="text-caption text-weight-bold text-grey-8 q-pt-xs">
                                            {{ ln.label }}
                                        </div>
                                        <div v-else :class="ln.sangria ? 'q-ml-md' : ''">{{ ln.label }}</div>
                                    </template>
                                </div>

                                <!-- Filas etiqueta:valor -->
                                <template v-else>
                                    <div v-for="fila in sec.filas" :key="fila.label"
                                        :class="fila.ancho ? 'col-12' : 'col-12 col-sm-6'">
                                        <div class="text-caption text-grey">{{ fila.label }}</div>
                                        <div class="text-body2">{{ textoValor(fila.value) }}</div>
                                    </div>
                                </template>
                            </q-card-section>
                        </q-card>
                    </q-expansion-item>
                </q-card-section>

                <q-separator />
                <q-card-section class="text-center">
                    <q-btn unelevated color="primary" icon="public" label="Ir al portal del MINAAMP"
                        href="https://adultosmayores.minaamp.gob.ve" target="_blank" />
                </q-card-section>
            </template>
        </q-card>
    </q-page>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { verificacionService } from 'src/services/centros.service';
import { Notify } from 'quasar';

// Utilidades
const mayus = (s) => String(s ?? '').toUpperCase();
const siNo = (v) => (v ? 'Sí' : 'No');
const conDesc = (v, desc) => (v ? ('Sí' + (desc ? `: ${desc}` : '')) : 'No');

// Texto de una celda valor (vacío/null → guion)
const textoValor = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default {
    name: 'VerificacionCentroPage',
    setup() {
        const route = useRoute();
        const centro = ref(null);
        const ficha = ref(null);
        const propietarios = ref([]);
        const representantes = ref([]);
        const telefonos = ref([]);
        const correos = ref([]);
        const loading = ref(true);
        const error = ref('');

        const fecha = (d) => {
            if (!d) return '—';
            const dt = new Date(d);
            return isNaN(dt) ? d : dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const fotoSrc = computed(() => {
            const f = centro.value?.foto_base64;
            if (!f) return '';
            return f.startsWith('data:') ? f : `data:image/jpeg;base64,${f}`;
        });

        const fechaConsulta = computed(() =>
            new Date().toLocaleString('es-VE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
        );

        const costoMensual = computed(() =>
            ficha.value?.costo_mensual != null
                ? Number(ficha.value.costo_mensual).toLocaleString('es-VE')
                : '—'
        );

        const telefonosTexto = computed(() =>
            telefonos.value.map(t => `${t.telefono} (${t.tipo || 'tel'})`).join(', ')
        );

        const correosTexto = computed(() =>
            correos.value.map(c => `${c.correo} (${c.tipo || 'email'})`).join(', ')
        );

        // MÁRCA_SECCIONES

        // Población atendida
        const poblacion = computed(() => ficha.value?.poblacion || []);

        const totalesPoblacion = computed(() => poblacion.value.reduce((a, r) => ({
            fem: a.fem + (Number(r.femenino) || 0),
            masc: a.masc + (Number(r.masculino) || 0),
            total: a.total + (Number(r.total) || 0),
        }), { fem: 0, masc: 0, total: 0 }));

        // ── Servicios Prestados (como el PDF) ──
        const serviciosItems = computed(() => {
            const s = ficha.value?.servicios;
            if (!s) return [];
            const items = [
                { label: 'Farmacia', value: siNo(s.farmacia) },
                { label: 'Eval. Nutricional', value: siNo(s.evaluacion_nutricional) },
                { label: 'Act. Recreativas', value: siNo(s.actividades_recreativas) },
                { label: 'Serv. Emergencia', value: siNo(s.servicio_emergencia) },
                { label: 'Serv. Funerario', value: siNo(s.servicio_funerario) },
                { label: 'Barbería / Peluq.', value: siNo(s.barberia_peluqueria) },
                { label: 'Servicio Médico', value: conDesc(s.medicos, s.medicos_descripcion) },
                { label: 'Lavandería', value: conDesc(s.lavanderia, s.lavanderia_descripcion) },
            ];
            if (s.otros) items.push({ label: 'Otros Servicios', value: s.otros_descripcion || 'Sí' });
            (ficha.value.servicios_extras || []).forEach(se => {
                items.push({ label: se.label, value: 'Sí' });
            });
            return items;
        });

        // ── Personal y Talento Humano (como el PDF) ──
        const personalItems = computed(() => {
            const p = ficha.value?.personal;
            if (!p) return [];
            const items = [
                { label: 'Médicos Generales', value: p.num_medicos ?? 0 },
                { label: 'Médicos Geriatras', value: p.num_medicos_geriatra ?? 0 },
                { label: 'Médicos Psiquiatras', value: p.num_medicos_psiquiatra ?? 0 },
                { label: 'Gerontólogos', value: p.num_gerontologos ?? 0 },
                { label: 'Psicólogos', value: p.num_psicologos ?? 0 },
                { label: 'Enfermeros', value: p.num_enfermeros ?? 0 },
                { label: 'Aux. Enfermería', value: p.num_auxiliares_enfermeria ?? 0 },
                { label: 'Cuidadores', value: p.num_cuidadores ?? 0 },
                { label: 'Camareros', value: p.num_camareros ?? 0 },
                { label: 'Serv. Generales', value: p.num_servicios_generales ?? 0 },
                { label: 'Personal de Cocina', value: p.num_personal_cocina ?? 0 },
                { label: 'Resp. Farmacia', value: p.num_responsables_farmacia ?? 0 },
                { label: 'Seguridad', value: p.num_personal_seguridad ?? 0 },
                { label: 'Personal No Adscrito', value: p.num_personal_no_adscrito ?? 0 },
                { label: 'Expediente Curricular', value: siNo(p.posee_expediente_curricular) },
                { label: 'Otros Personal', value: p.otros_personal ? (p.descripcion_otros_personal || 'Sí') : 'No' },
            ];
            return items;
        });

        // ── Infraestructura del Inmueble (como el PDF) ──
        const infraItems = computed(() => {
            const inf = ficha.value?.infraestructura;
            if (!inf) return [];
            return [
                { label: 'Estado Inmueble', value: inf.estado_inmueble_nombre || '—' },
                { label: 'Tipo de Planta', value: inf.planta_electrica_tipo_nombre || '—' },
                { label: 'Área Total (m²)', value: inf.area_total_m2 ?? '—' },
                { label: 'Área Constr. (m²)', value: inf.area_construida_m2 ?? '—' },
                { label: 'Tamaño Habitac. (m²)', value: inf.tamano_habitaciones_m2 ?? '—' },
                { label: 'Personas / Habit.', value: inf.personas_por_habitacion ?? '—' },
                { label: 'Camas / Habit.', value: inf.camas_por_habitacion ?? '—' },
                { label: 'Baños / Habit.', value: inf.banos_por_habitacion ?? '—' },
                { label: 'Nro. Dormitorios', value: inf.num_dormitorios ?? '—' },
                { label: 'Dormit. Adecuados', value: siNo(inf.dormitorios_adecuados) },
                { label: 'Nro. Sanitarios', value: inf.num_sanitarios ?? '—' },
                { label: 'Sanitar. Adecuados', value: siNo(inf.sanitarios_adecuados) },
                { label: 'Baños Completos', value: inf.banos_completos ?? '—' },
                { label: 'Baños sin Ducha', value: inf.banos_sin_ducha ?? '—' },
                { label: 'Cantidad Tinas', value: inf.cant_tinas ?? '—' },
                { label: 'Área de Cocina', value: siNo(inf.tiene_area_cocina) },
                { label: 'Cocina Adecuada', value: siNo(inf.cocina_adecuada) },
                { label: 'Comedor', value: siNo(inf.tiene_comedor) },
                { label: 'Capacidad Comedor', value: inf.capacidad_comedor_pct != null ? `${inf.capacidad_comedor_pct}%` : '—' },
                { label: 'Atención Médica', value: siNo(inf.areas_atencion_medica) },
                { label: 'Áreas Verdes', value: siNo(inf.areas_verdes) },
                { label: 'Farmacia / Depósito', value: siNo(inf.tiene_farmacia_almacen_clinico) },
                { label: 'Aceptan Mascotas', value: siNo(inf.acepta_mascotas) },
                { label: 'Gerogranjas', value: siNo(inf.gerogranjas) },
                { label: 'Residuos Separados', value: siNo(inf.residuos_separados) },
                { label: 'Luz Eléctrica', value: siNo(inf.luz_electrica) },
                { label: 'Agua Potable', value: siNo(inf.agua_potable) },
                { label: 'Aguas Servidas', value: siNo(inf.agua_servidas) },
                { label: 'Depósito Basura', value: siNo(inf.deposito_basura) },
                { label: 'Tanque de Agua', value: inf.tanque_agua ? (`Sí${inf.capacidad_tanque ? ` (${inf.capacidad_tanque}L)` : ''}`) : 'No' },
                { label: 'Bomba de Agua', value: siNo(inf.bomba_agua) },
                { label: 'Sistema Seguridad', value: siNo(inf.sistema_seguridad) },
                { label: 'Cámaras Seguridad', value: siNo(inf.tiene_camaras) },
                { label: 'Control Acceso/Sal.', value: `Acceso: ${siNo(inf.control_acceso)} | Salida: ${siNo(inf.control_salida)}` },
                { label: 'Alarma Emergencia', value: siNo(inf.alarma_emergencia) },
                { label: 'Botones Emergencia', value: `Habit: ${siNo(inf.boton_emergencia_habitaciones)} | Baño: ${siNo(inf.boton_emergencia_banio)} | Pasillo: ${siNo(inf.boton_emergencia_pasillos)}` },
                { label: 'Iluminac. Emergencia', value: siNo(inf.iluminacion_emergencia) },
                { label: 'Iluminación Adecuada', value: siNo(inf.iluminacion_adecuada) },
                { label: 'Ventilación Adecuada', value: siNo(inf.ventilacion_adecuada) },
                { label: 'Sistemas Ventilación', value: siNo(inf.sistemas_ventilacion) },
                { label: 'Aire Acondicionado', value: siNo(inf.aire_acondicionado) },
                { label: 'Prevención Incendios', value: siNo(inf.prevencion_incendios) },
                { label: 'Señalización Clara', value: siNo(inf.senalizacion_clara) },
                { label: 'Normativa Visible', value: siNo(inf.normativa_visible) },
                { label: 'Planta Eléctrica', value: siNo(inf.planta_electrica) },
                { label: 'Panel Solar', value: siNo(inf.planta_electrica_panel_solar) },
            ];
        });

        // ── Accesibilidad y Barreras Arquitectónicas (como el PDF) ──
        const accesItems = computed(() => {
            const acc = ficha.value?.accesibilidad;
            if (!acc) return [];
            return [
                { label: 'Rampas de Acceso', value: siNo(acc.rampas_fijas) },
                { label: 'Marquesinas Acceso', value: siNo(acc.marquesinas_acceso) },
                { label: 'Estacionam. Reservados', value: siNo(acc.estacionamientos_reservados) },
                { label: 'Pasamanos', value: siNo(acc.pasamanos) },
                { label: 'Pasamanos Dobles', value: siNo(acc.pasamanos_dobles) },
                { label: 'Piso Antideslizante', value: siNo(acc.piso_antirresbalante) },
                { label: 'Pasillos Accesibles', value: siNo(acc.pasillos_accesibles_sillas) },
                { label: 'Zonas de Descanso', value: siNo(acc.zonas_descanso) },
                { label: 'Escaleras Antirresb.', value: siNo(acc.escaleras_antirresbalantes) },
                { label: 'Ascensores', value: acc.ascensores ? (`Sí (${acc.num_ascensores || 1})`) : 'No' },
                { label: 'Alfombras Sueltas', value: siNo(acc.alfombras_sueltas) },
                { label: 'Alfombras Aseguradas', value: siNo(acc.alfombras_aseguradas) },
                { label: 'Pisos Podotáctiles', value: siNo(acc.pisos_podotactiles) },
                { label: 'Baños Geriátricos', value: siNo(acc.banos_geriatricos) },
                { label: 'Barras de Apoyo', value: siNo(acc.barras_apoyo) },
                { label: 'Inodoros Elevados', value: siNo(acc.inodoros_elevados) },
                { label: 'Duchas a Ras de Suelo', value: siNo(acc.duchas_ras_suelo) },
                { label: 'Lavamanos Suspendidos', value: siNo(acc.lavamanos_suspendidos) },
                { label: 'Grifería de Palanca', value: siNo(acc.griferia_palanca) },
                { label: 'Botón Emergenc. Baño', value: siNo(acc.boton_emergencia) },
                { label: 'Sillas con Apoyabrazos', value: siNo(acc.sillas_apoyabrazos) },
                { label: 'Mesas sin Obstáculos', value: siNo(acc.mesas_sin_obstaculos) },
                { label: 'Alto Contraste Visual', value: siNo(acc.alto_contraste_visual) },
                { label: 'Pictogramas Univ.', value: siNo(acc.pictogramas_universales) },
                { label: 'Iluminación Homogénea', value: siNo(acc.iluminacion_homogenea) },
                { label: 'Señales Accesibles', value: siNo(acc.senales_accesibles) },
                { label: 'Alarmas Duales', value: siNo(acc.alarmas_duales) },
                { label: 'Rutas Evacuac. Anchas', value: siNo(acc.rutas_evacuacion_anchas) },
                { label: 'Timbres Emergencia', value: siNo(acc.timbres_emergencia) },
            ];
        });

        // ── Secciones a renderizar (orden igual que el PDF) ──
        const secciones = computed(() => {
            const secs = [];
            const c = centro.value;
            if (!c) return secs;
            const f = ficha.value;

            // Datos generales
            const filasGenerales = [
                { label: 'RIF', value: mayus(c.rif) },
                { label: 'Nro. Reg. Mercantil', value: mayus(c.nro_registro_mercantil) },
                { label: 'Tipo de Establecimiento', value: mayus(c.tipo_establecimiento) },
                { label: 'Clasificación', value: mayus(c.tipo_clasificacion) },
                { label: 'Estado', value: mayus(c.estado) },
                { label: 'Municipio', value: mayus(c.municipio) },
                { label: 'Parroquia', value: mayus(c.parroquia) },
                { label: 'Estado del Centro', value: mayus(c.estado_centro) },
            ];
            if (f?.direccion) filasGenerales.push({ label: 'Dirección', value: mayus(f.direccion), ancho: true });
            secs.push({ icon: 'domain', titulo: 'Datos Generales del Centro', filas: filasGenerales });

            // Fotografía
            if (c.foto_base64) {
                secs.push({ icon: 'photo_camera', titulo: 'Fotografía del Centro', tipo: 'foto' });
            }

            // Propietarios y representantes (SIN cédulas)
            const lineasPersonas = [];
            if (propietarios.value.length) {
                lineasPersonas.push({ label: 'Propietario(s):', bold: true });
                propietarios.value.forEach(p => lineasPersonas.push({
                    label: `• ${mayus(p.nombre)}${p.es_principal ? ' (Principal)' : ''}`,
                    sangria: true,
                }));
            }
            if (representantes.value.length) {
                lineasPersonas.push({ label: 'Representante(s) Legal(es):', bold: true });
                representantes.value.forEach(r => lineasPersonas.push({
                    label: `• ${mayus(r.nombre)}${r.cargo ? ` (${r.cargo})` : ''}`,
                    sangria: true,
                }));
            }
            if (lineasPersonas.length) {
                secs.push({ icon: 'groups', titulo: 'Propietarios y Representantes Legales', lineas: lineasPersonas });
            }

            // Contacto
            const filasContacto = [];
            if (telefonos.value.length) filasContacto.push({ label: 'Teléfonos', value: telefonosTexto.value, ancho: true });
            if (correos.value.length) filasContacto.push({ label: 'Correos', value: correosTexto.value, ancho: true });
            if (filasContacto.length) {
                secs.push({ icon: 'contact_phone', titulo: 'Información de Contacto', filas: filasContacto });
            }

            // Ficha técnica vigente
            if (f) {
                secs.push({
                    icon: 'description',
                    titulo: 'Datos de la Ficha Técnica Vigente',
                    filas: [
                        { label: 'Tipo de Solicitud', value: mayus(f.tipo_solicitud) },
                        { label: 'Nro. Reg. Nacional', value: mayus(f.nro_registro_nacional) },
                        { label: 'Fecha Solicitud', value: fecha(f.fecha_solicitud) },
                        { label: 'Fecha Fundación', value: fecha(f.fecha_fundacion) },
                        { label: 'Costo Mensual', value: costoMensual.value },
                        { label: 'Versión Ficha', value: 'v' + (f.version || 1) },
                    ],
                });
            }

            // Capacidad
            if (f?.capacidad) {
                const cap = f.capacidad;
                secs.push({
                    icon: 'king_bed',
                    titulo: 'Capacidad Instalada y Atención',
                    filas: [
                        { label: 'Cap. Total Residentes', value: cap.capacidad_total_residente },
                        { label: 'Residentes Actuales', value: cap.capacidad_actual_residente },
                        { label: 'Atención Ambulatoria', value: siNo(cap.atencion_ambulatoria) },
                        { label: 'Cupos Ambulatorios', value: cap.atencion_ambulatoria ? (cap.num_atencion_ambulatoria ?? 'N/A') : 'N/A' },
                    ],
                });
            }

            // Población
            if (poblacion.value.length) {
                secs.push({ icon: 'diversity_3', titulo: 'Población Atendida', tipo: 'poblacion' });
            }

            // Servicios
            if (serviciosItems.value.length) {
                secs.push({ icon: 'room_service', titulo: 'Servicios Prestados', filas: serviciosItems.value });
            }

            // Personal
            if (personalItems.value.length) {
                const filasPersonal = [...personalItems.value];
                if (f?.personal?.descripcion_no_adscrito) {
                    filasPersonal.push({ label: 'Detalle Personal No Adscrito', value: f.personal.descripcion_no_adscrito, ancho: true });
                }
                secs.push({ icon: 'badge', titulo: 'Personal y Talento Humano', filas: filasPersonal });
            }

            // Infraestructura
            if (infraItems.value.length) {
                const filasInfra = [...infraItems.value];
                if (f?.infraestructura?.descripcion_otros) {
                    filasInfra.push({ label: 'Observaciones', value: f.infraestructura.descripcion_otros, ancho: true });
                }
                secs.push({ icon: 'apartment', titulo: 'Infraestructura del Inmueble', filas: filasInfra });
            }

            // Accesibilidad
            if (accesItems.value.length) {
                secs.push({ icon: 'accessible', titulo: 'Accesibilidad y Barreras Arquitectónicas', filas: accesItems.value });
            }

            return secs;
        });

        onMounted(async () => {
            try {
                const { data } = await verificacionService.getCentro(route.params.id);
                centro.value = data.centro;
                ficha.value = data.ficha;
                propietarios.value = data.propietarios || [];
                representantes.value = data.representantes || [];
                telefonos.value = data.telefonos || [];
                correos.value = data.correos || [];
            } catch (err) {
                console.error(err);
                const status = err?.response?.status;
                if (status === 404) {
                    error.value = 'Centro no encontrado en el registro.';
                } else if (status === 401) {
                    error.value = 'El servicio de verificación no está disponible en el servidor. '
                        + 'Actualice y reinicie el backend.';
                } else if (status) {
                    error.value = `Error al verificar los datos del centro (HTTP ${status}).`;
                } else {
                    error.value = 'No se pudo conectar con el servidor de verificación.';
                }
                if (status !== 404) {
                    Notify.create({ type: 'negative', message: 'Error al verificar los datos.' });
                }
            } finally {
                loading.value = false;
            }
        });

        return {
            centro, ficha, loading, error, fechaConsulta, fotoSrc,
            secciones, textoValor, poblacion, totalesPoblacion,
        };
    },
};
</script>

<style scoped>
.verif-card {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
}

.nombre-centro {
    text-transform: uppercase;
}

.tabla-pob {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
}

.tabla-pob th,
.tabla-pob td {
    padding: 4px 6px;
    border-bottom: 1px solid #e0e3e8;
}
</style>
