<template>
    <q-page padding>
        <!-- Encabezado -->
        <div class="row items-center q-mb-md">
            <q-btn flat icon="arrow_back" @click="$router.push('/admin/centros')" />
            <div class="q-ml-sm">
                <div class="text-h5">{{ centro?.nombre_establecimiento || 'Cargando...' }}</div>
                <div class="text-caption text-grey" v-if="centro">
                    <q-badge :color="colorEstado(centro.estado_centro)" :label="centro.estado_centro" />
                    &nbsp;·&nbsp;{{ labelTipo(centro.tipo_establecimiento) }}
                    &nbsp;·&nbsp;{{ centro.municipio }}, {{ centro.estado }}
                </div>
            </div>
            <q-space />
            <q-btn v-if="canEdit" icon="edit" label="Editar" flat color="primary"
                @click="$router.push(`/admin/centros/${centroId}/editar`)" />
        </div>

        <q-inner-loading :showing="centrosStore.loading" label="Cargando..." />

        <div v-if="centro">
            <q-tabs v-model="tab" align="left" class="q-mb-md">
                <q-tab name="resumen" label="Resumen" icon="info" />
                <q-tab name="ficha" label="Ficha Actual" icon="assignment" />
                <q-tab name="historial" label="Historial" icon="history" />
                <q-tab name="acceso" label="Acceso" icon="people" v-if="canManageAccess" />
            </q-tabs>

            <q-tab-panels v-model="tab" animated>

                <!-- ── RESUMEN ──── -->
                <q-tab-panel name="resumen">
                    <div class="row q-col-gutter-md">

                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="business" /> Datos del Centro
                                    </p>
                                    <table style="width:100%; border-collapse:collapse">
                                        <tr>
                                            <td class="text-caption text-grey" style="width:45%;padding:2px 4px">RIF
                                            </td>
                                            <td class="text-body2" style="padding:2px 4px">{{ centro.rif || '—' }}</td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Nro. Reg.
                                                Mercantil</td>
                                            <td class="text-body2" style="padding:2px 4px">{{
                                                centro.nro_registro_mercantil || '—' }}</td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Tipo</td>
                                            <td class="text-body2" style="padding:2px 4px">{{
                                                labelTipo(centro.tipo_establecimiento) }}</td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Clasificación
                                            </td>
                                            <td class="text-body2" style="padding:2px 4px">{{
                                                labelClasif(centro.tipo_clasificacion) }}</td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Parroquia</td>
                                            <td class="text-body2" style="padding:2px 4px">{{ centro.parroquia || '—' }}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Municipio</td>
                                            <td class="text-body2" style="padding:2px 4px">{{ centro.municipio || '—' }}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="text-caption text-grey" style="padding:2px 4px">Estado</td>
                                            <td class="text-body2" style="padding:2px 4px">{{ centro.estado || '—' }}
                                            </td>
                                        </tr>
                                    </table>
                                </q-card-section>
                            </q-card>
                        </div>

                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="person" />
                                        Propietario(s)</p>
                                    <div v-for="p in centro.propietarios" :key="p.id" class="q-mb-xs text-body2">
                                        {{ p.cedula_tipo }}-{{ p.cedula_nro }} — {{ p.nombre }}
                                        <q-badge v-if="p.es_principal" color="primary" label="Principal"
                                            class="q-ml-xs" />
                                    </div>
                                    <div v-if="!centro.propietarios?.length" class="text-grey text-body2">Sin
                                        propietarios</div>
                                </q-card-section>
                            </q-card>
                        </div>

                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="badge" />
                                        Representante(s)</p>
                                    <div v-for="r in centro.representantes" :key="r.id" class="q-mb-xs text-body2">
                                        {{ r.cedula_tipo }}-{{ r.cedula_nro }} — {{ r.nombre }}
                                        <span class="text-grey-7" v-if="r.cargo"> ({{ r.cargo }})</span>
                                    </div>
                                    <div v-if="!centro.representantes?.length" class="text-grey text-body2">Sin
                                        representantes</div>
                                </q-card-section>
                            </q-card>
                        </div>

                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="contact_phone" />
                                        Contacto</p>
                                    <div v-for="t in centro.telefonos" :key="t.id" class="text-body2">
                                        📞 {{ t.telefono }} <span class="text-caption text-grey">({{ t.tipo }})</span>
                                    </div>
                                    <div v-for="c in centro.correos" :key="c.id" class="text-body2">
                                        ✉ {{ c.correo }} <span class="text-caption text-grey">({{ c.tipo }})</span>
                                    </div>
                                    <div v-if="!centro.telefonos?.length && !centro.correos?.length"
                                        class="text-grey text-body2">Sin contacto</div>
                                </q-card-section>
                            </q-card>
                        </div>
                    </div>
                </q-tab-panel>

                <!-- ── FICHA ACTUAL ──── -->
                <q-tab-panel name="ficha">
                    <div v-if="!ficha" class="text-center q-pa-xl text-grey">
                        <q-icon name="assignment_late" size="4rem" class="q-mb-sm" />
                        <div>No hay ficha activa para este centro.</div>
                        <q-btn v-if="canEdit" class="q-mt-md" color="primary" unelevated label="Crear primera ficha"
                            @click="$router.push(`/admin/centros/${centroId}/ficha/nueva`)" />
                    </div>

                    <div v-else>
                        <div class="row q-col-gutter-md q-mb-md">
                            <!-- Datos básicos -->
                            <div class="col-12 col-md-4">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="event_note" />
                                            Datos de la Ficha</p>
                                        <table style="width:100%; border-collapse:collapse">
                                            <tr>
                                                <td class="text-caption text-grey" style="width:50%;padding:2px 4px">
                                                    Nro. Registro Nal.</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    ficha.nro_registro_nacional || '—' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Tipo de
                                                    Solicitud</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    labelSolicitud(ficha.tipo_solicitud) }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Fecha
                                                    Solicitud</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    formatDate(ficha.fecha_solicitud) }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Fecha
                                                    Fundación</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    formatDate(ficha.fecha_fundacion) }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Costo Mensual
                                                </td>
                                                <td class="text-body2" style="padding:2px 4px">{{ ficha.costo_mensual ?
                                                    'Bs. ' + ficha.costo_mensual : '—' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Dirección
                                                </td>
                                                <td class="text-body2" style="padding:2px 4px">{{ ficha.direccion || '—'
                                                    }}</td>
                                            </tr>
                                        </table>
                                    </q-card-section>
                                </q-card>
                            </div>

                            <!-- Capacidad -->
                            <div class="col-12 col-md-4" v-if="ficha.capacidad">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="people" />
                                            Capacidad</p>
                                        <table style="width:100%; border-collapse:collapse">
                                            <tr>
                                                <td class="text-caption text-grey" style="width:60%;padding:2px 4px">
                                                    Cap. Total Residentes</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    ficha.capacidad.capacidad_total_residente ?? '—' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Residentes
                                                    Actuales</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    ficha.capacidad.capacidad_actual_residente ?? '—' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Atención
                                                    Ambulatoria</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    ficha.capacidad.atencion_ambulatoria ? 'Sí' : 'No' }}</td>
                                            </tr>
                                            <tr v-if="ficha.capacidad.atencion_ambulatoria">
                                                <td class="text-caption text-grey" style="padding:2px 4px">Cupos
                                                    Ambulatorios</td>
                                                <td class="text-body2" style="padding:2px 4px">{{
                                                    ficha.capacidad.num_atencion_ambulatoria ?? '—' }}</td>
                                            </tr>
                                        </table>
                                    </q-card-section>
                                </q-card>
                            </div>

                            <!-- Población -->
                            <div class="col-12 col-md-4" v-if="ficha.poblacion?.length">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="bar_chart" /> Población ({{
                                            formatDate(ficha.poblacion[0].fecha_corte) }})
                                        </p>
                                        <q-table :rows="pobUltimaFecha" :columns="colsPob" flat dense hide-bottom />
                                    </q-card-section>
                                </q-card>
                            </div>
                        </div>

                        <!-- Servicios -->
                        <q-expansion-item v-if="ficha.servicios" icon="medical_services" label="Servicios Prestados"
                            default-opened class="q-mb-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="row q-gutter-sm">
                                        <q-chip v-if="ficha.servicios.farmacia" color="positive" text-color="white"
                                            dense>Farmacia</q-chip>
                                        <q-chip v-if="ficha.servicios.evaluacion_nutricional" color="positive"
                                            text-color="white" dense>Eval. Nutricional</q-chip>
                                        <q-chip v-if="ficha.servicios.actividades_recreativas" color="positive"
                                            text-color="white" dense>Act. Recreativas</q-chip>
                                        <q-chip v-if="ficha.servicios.servicio_emergencia" color="positive"
                                            text-color="white" dense>Emergencia</q-chip>
                                        <q-chip v-if="ficha.servicios.servicio_funerario" color="positive"
                                            text-color="white" dense>Funerario</q-chip>
                                        <q-chip v-if="ficha.servicios.medicos" color="positive" text-color="white"
                                            dense>Médicos{{ ficha.servicios.medicos_descripcion ? ': ' +
                                            ficha.servicios.medicos_descripcion : '' }}</q-chip>
                                        <q-chip v-if="ficha.servicios.lavanderia" color="positive" text-color="white"
                                            dense>Lavandería{{ ficha.servicios.lavanderia_descripcion ? ': ' +
                                            ficha.servicios.lavanderia_descripcion : '' }}</q-chip>
                                        <q-chip v-if="ficha.servicios.barberia_peluqueria" color="positive"
                                            text-color="white" dense>Barbería/Peluquería</q-chip>
                                        <q-chip v-if="ficha.servicios.otros" color="positive" text-color="white"
                                            dense>Otros{{ ficha.servicios.otros_descripcion ? ': ' +
                                            ficha.servicios.otros_descripcion : '' }}</q-chip>
                                        <span v-if="!tieneServicios" class="text-grey text-body2">Ningún servicio
                                            registrado</span>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>

                        <!-- Personal -->
                        <q-expansion-item v-if="ficha.personal" icon="group" label="Personal" class="q-mb-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="row q-col-gutter-md">
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Méd. Geriatra</div>{{
                                            ficha.personal.num_medicos_geriatra }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Méd. Psiquiatra</div>{{
                                            ficha.personal.num_medicos_psiquiatra }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Enfermeros</div>{{
                                            ficha.personal.num_enfermeros }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Cuidadores</div>{{
                                            ficha.personal.num_cuidadores }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Camareros</div>{{
                                            ficha.personal.num_camareros }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Aux. Enfermería</div>{{
                                            ficha.personal.num_auxiliares_enfermeria }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Serv. Generales</div>{{
                                            ficha.personal.num_servicios_generales }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Personal Cocina</div>{{
                                            ficha.personal.num_personal_cocina }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">No Adscritos</div>{{
                                            ficha.personal.num_personal_no_adscrito }}
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>

                        <!-- Infraestructura -->
                        <q-expansion-item v-if="ficha.infraestructura" icon="home" label="Infraestructura"
                            class="q-mb-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="row q-col-gutter-md">
                                        <div class="col-12 col-md-5">
                                            <table style="width:100%; border-collapse:collapse">
                                                <tr>
                                                    <td class="text-caption text-grey"
                                                        style="width:55%;padding:2px 4px">Estado inmueble</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.estado_inmueble || '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:2px 4px">Nro.
                                                        dormitorios</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.num_dormitorios ?? '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:2px 4px">
                                                        Dormitorios adecuados</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.dormitorios_adecuados ? 'Sí' : 'No' }}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:2px 4px">Nro.
                                                        sanitarios</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.num_sanitarios ?? '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:2px 4px">
                                                        Sanitarios adecuados</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.sanitarios_adecuados ? 'Sí' : 'No' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:2px 4px">Cap.
                                                        comedor</td>
                                                    <td class="text-body2" style="padding:2px 4px">{{
                                                        ficha.infraestructura.capacidad_comedor_pct != null ?
                                                        ficha.infraestructura.capacidad_comedor_pct + '%' : '—' }}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="col-12 col-md-7">
                                            <div class="text-caption text-grey q-mb-xs">Servicios básicos</div>
                                            <div class="row q-gutter-xs">
                                                <q-chip
                                                    :color="ficha.infraestructura.luz_electrica ? 'positive' : 'grey-4'"
                                                    :text-color="ficha.infraestructura.luz_electrica ? 'white' : 'grey-7'"
                                                    dense>Luz eléctrica</q-chip>
                                                <q-chip
                                                    :color="ficha.infraestructura.agua_potable ? 'positive' : 'grey-4'"
                                                    :text-color="ficha.infraestructura.agua_potable ? 'white' : 'grey-7'"
                                                    dense>Agua potable</q-chip>
                                                <q-chip
                                                    :color="ficha.infraestructura.agua_servidas ? 'positive' : 'grey-4'"
                                                    :text-color="ficha.infraestructura.agua_servidas ? 'white' : 'grey-7'"
                                                    dense>Aguas servidas</q-chip>
                                                <q-chip
                                                    :color="ficha.infraestructura.deposito_basura ? 'positive' : 'grey-4'"
                                                    :text-color="ficha.infraestructura.deposito_basura ? 'white' : 'grey-7'"
                                                    dense>Depósito basura</q-chip>
                                                <q-chip
                                                    :color="ficha.infraestructura.sistema_seguridad ? 'positive' : 'grey-4'"
                                                    :text-color="ficha.infraestructura.sistema_seguridad ? 'white' : 'grey-7'"
                                                    dense>Seguridad</q-chip>
                                            </div>
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>

                        <!-- Documentos -->
                        <q-expansion-item v-if="ficha.documentos?.length" icon="folder" label="Documentos"
                            class="q-mb-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div v-for="d in ficha.documentos" :key="d.id" class="row q-mb-xs">
                                        <div class="col text-body2">{{ d.tipo_documento.replace(/_/g, ' ') }}</div>
                                        <div class="col-auto">
                                            <q-chip dense :color="d.tiene_original ? 'positive' : 'grey-4'"
                                                :text-color="d.tiene_original ? 'white' : 'grey-7'">Original</q-chip>
                                            <q-chip dense :color="d.tiene_copia ? 'positive' : 'grey-4'"
                                                :text-color="d.tiene_copia ? 'white' : 'grey-7'">Copia</q-chip>
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>
                    </div>
                </q-tab-panel>

                <!-- ── HISTORIAL ──── -->
                <q-tab-panel name="historial">
                    <div class="text-grey text-center q-pa-xl">
                        <q-icon name="history" size="3rem" />
                        <div>Historial de versiones — próximamente</div>
                    </div>
                </q-tab-panel>

                <!-- ── ACCESO ──── -->
                <q-tab-panel name="acceso" v-if="canManageAccess">
                    <div class="text-grey text-center q-pa-xl">
                        <q-icon name="people" size="3rem" />
                        <div>Gestión de acceso — próximamente</div>
                    </div>
                </q-tab-panel>

            </q-tab-panels>
        </div>
    </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { LocalStorage } from 'quasar';
import { useCentrosStore } from 'src/stores/centros.store';

const route = useRoute();
const centrosStore = useCentrosStore();
const centroId = computed(() => route.params.id);

const tab = ref('resumen');
const centro = computed(() => centrosStore.current);
const ficha = computed(() => centrosStore.ficha);

// Servicios con al menos uno activo
const tieneServicios = computed(() => {
    const s = ficha.value?.servicios;
    if (!s) return false;
    return ['farmacia', 'evaluacion_nutricional', 'actividades_recreativas',
        'servicio_emergencia', 'servicio_funerario', 'medicos',
        'lavanderia', 'barberia_peluqueria', 'otros'].some(k => s[k]);
});

// Población de la última fecha de corte
const pobUltimaFecha = computed(() => {
    const pob = ficha.value?.poblacion;
    if (!pob?.length) return [];
    const ultima = pob[0].fecha_corte;
    return pob.filter(r => r.fecha_corte === ultima);
});

const colsPob = [
    { name: 'modalidad', label: 'Modalidad', field: 'modalidad', align: 'left' },
    { name: 'categoria', label: 'Categoría', field: 'categoria', align: 'left' },
    { name: 'femenino', label: 'Fem.', field: 'femenino', align: 'center' },
    { name: 'masculino', label: 'Masc.', field: 'masculino', align: 'center' },
    { name: 'total', label: 'Total', field: 'total', align: 'center' },
];

const permisos = LocalStorage.getItem('permissions') || [];
const role = (LocalStorage.getItem('role') || '').toLowerCase();
const adminUser = ['admin', 'administrador', 'administrator'].includes(role);
function hasPerm(p) { return adminUser || permisos.some(x => x.name === p); }
const canEdit = computed(() => hasPerm('edit_centro'));
const canManageAccess = computed(() => hasPerm('manage_centro_access'));

function colorEstado(e) {
    return { activo: 'positive', inactivo: 'grey', suspendido: 'negative' }[e] || 'grey';
}
function labelTipo(t) {
    return { publico: 'Público', afiliada_ivss: 'Afiliada IVSS', privado: 'Privado', religiosa: 'Religioso', otra: 'Otro' }[t] || t || '—';
}
function labelClasif(c) {
    return { geriatrico: 'Geriátrico', gronto_psiquiatrico: 'Gronto-Psiquiátrico', casa_hogar: 'Casa Hogar', unidades_gerontologicas: 'Unidades Gerontológicas', fundacion: 'Fundación', otras: 'Otras' }[c] || c || '—';
}
function labelSolicitud(s) {
    return { registro_autorizacion: 'Registro y Autorización', renovacion_autorizacion: 'Renovación' }[s] || s || '—';
}
function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(async () => {
    await centrosStore.fetchCentro(centroId.value);
    await centrosStore.fetchFichaActual(centroId.value);
});
</script>
