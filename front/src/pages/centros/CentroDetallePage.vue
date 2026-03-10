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
                <!-- ── RESUMEN ─────────────────────────────────────────────────── -->
                <q-tab-panel name="resumen">
                    <div class="row q-col-gutter-md">
                        <!-- Info básica -->
                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="business" class="q-mr-xs" /> Datos del Centro
                                    </div>
                                    <detalle-campo label="RIF" :value="centro.rif" />
                                    <detalle-campo label="Nro. Registro Mercantil"
                                        :value="centro.nro_registro_mercantil" />
                                    <detalle-campo label="Parroquia" :value="centro.parroquia" />
                                    <detalle-campo label="Municipio" :value="centro.municipio" />
                                    <detalle-campo label="Estado" :value="centro.estado" />
                                    <detalle-campo label="Clasificación"
                                        :value="labelClasif(centro.tipo_clasificacion)" />
                                </q-card-section>
                            </q-card>
                        </div>

                        <!-- Propietarios -->
                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="person" class="q-mr-xs" /> Propietario(s)
                                    </div>
                                    <div v-for="p in centro.propietarios" :key="p.id" class="q-mb-xs">
                                        {{ p.cedula_tipo }}-{{ p.cedula_nro }} — {{ p.nombre }}
                                        <q-badge v-if="p.es_principal" color="primary" label="Principal"
                                            class="q-ml-xs" />
                                    </div>
                                    <div v-if="!centro.propietarios?.length" class="text-grey">Sin propietarios
                                        registrados</div>
                                </q-card-section>
                            </q-card>
                        </div>

                        <!-- Representantes -->
                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="badge" class="q-mr-xs" /> Representante(s) Legal(es)
                                    </div>
                                    <div v-for="r in centro.representantes" :key="r.id" class="q-mb-xs">
                                        {{ r.cedula_tipo }}-{{ r.cedula_nro }} — {{ r.nombre }}
                                        <span class="text-grey-7" v-if="r.cargo"> ({{ r.cargo }})</span>
                                    </div>
                                    <div v-if="!centro.representantes?.length" class="text-grey">Sin representantes
                                        registrados</div>
                                </q-card-section>
                            </q-card>
                        </div>

                        <!-- Contacto -->
                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="contact_phone" class="q-mr-xs" /> Contacto
                                    </div>
                                    <div v-for="t in centro.telefonos" :key="t.id">
                                        <q-icon name="phone" size="xs" class="q-mr-xs" />{{ t.telefono }}
                                        <span class="text-caption text-grey q-ml-xs">({{ t.tipo }})</span>
                                    </div>
                                    <div v-for="c in centro.correos" :key="c.id">
                                        <q-icon name="email" size="xs" class="q-mr-xs" />{{ c.correo }}
                                        <span class="text-caption text-grey q-ml-xs">({{ c.tipo }})</span>
                                    </div>
                                    <div v-if="!centro.telefonos?.length && !centro.correos?.length" class="text-grey">
                                        Sin datos de contacto
                                    </div>
                                </q-card-section>
                            </q-card>
                        </div>
                    </div>
                </q-tab-panel>

                <!-- ── FICHA ACTUAL ─────────────────────────────────────────────── -->
                <q-tab-panel name="ficha">
                    <div v-if="!ficha" class="text-center q-pa-xl text-grey">
                        <q-icon name="assignment_late" size="4rem" class="q-mb-sm" />
                        <div>No hay ficha activa registrada para este centro.</div>
                        <q-btn v-if="canEdit" class="q-mt-md" color="primary" unelevated label="Crear primera ficha"
                            @click="$router.push(`/admin/centros/${centroId}/ficha/nueva`)" />
                    </div>

                    <div v-else>
                        <!-- Header ficha -->
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-4">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <detalle-campo label="Nro. Registro Nacional"
                                            :value="ficha.nro_registro_nacional" />
                                        <detalle-campo label="Tipo de Solicitud"
                                            :value="ficha.tipo_solicitud === 'registro_autorizacion' ? 'Registro y Autorización' : 'Renovación'" />
                                        <detalle-campo label="Fecha de Solicitud"
                                            :value="formatDate(ficha.fecha_solicitud)" />
                                        <detalle-campo label="Fecha de Fundación"
                                            :value="formatDate(ficha.fecha_fundacion)" />
                                        <detalle-campo label="Costo Mensual"
                                            :value="ficha.costo_mensual ? `Bs. ${ficha.costo_mensual}` : '—'" />
                                        <detalle-campo label="Dirección" :value="ficha.direccion" />
                                    </q-card-section>
                                </q-card>
                            </div>

                            <!-- Capacidad -->
                            <div class="col-12 col-md-4" v-if="ficha.capacidad">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="people" class="q-mr-xs" /> Capacidad
                                        </div>
                                        <detalle-campo label="Cap. Total Residentes"
                                            :value="ficha.capacidad.capacidad_total_residente" />
                                        <detalle-campo label="Residentes Actuales"
                                            :value="ficha.capacidad.capacidad_actual_residente" />
                                        <detalle-campo label="Atención Ambulatoria"
                                            :value="ficha.capacidad.atencion_ambulatoria ? 'Sí' : 'No'" />
                                        <detalle-campo v-if="ficha.capacidad.atencion_ambulatoria"
                                            label="Nro. Ambulatorios"
                                            :value="ficha.capacidad.num_atencion_ambulatoria" />
                                    </q-card-section>
                                </q-card>
                            </div>

                            <!-- Última población -->
                            <div class="col-12 col-md-4" v-if="ficha.poblacion?.length">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <div class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="bar_chart" class="q-mr-xs" />
                                            Población ({{ formatDate(ficha.poblacion[0].fecha_corte) }})
                                        </div>
                                        <q-table
                                            :rows="ficha.poblacion.filter(p => p.fecha_corte === ficha.poblacion[0].fecha_corte)"
                                            :columns="colsPoblacion" flat dense hide-bottom />
                                    </q-card-section>
                                </q-card>
                            </div>
                        </div>

                        <!-- Servicios y Personal en acordeones -->
                        <q-expansion-item v-if="ficha.servicios" icon="medical_services" label="Servicios Prestados"
                            default-opened>
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="row q-col-gutter-xs">
                                        <servicio-badge label="Farmacia" :activo="ficha.servicios.farmacia" />
                                        <servicio-badge label="Eval. Nutricional"
                                            :activo="ficha.servicios.evaluacion_nutricional" />
                                        <servicio-badge label="Act. Recreativas"
                                            :activo="ficha.servicios.actividades_recreativas" />
                                        <servicio-badge label="Serv. Emergencia"
                                            :activo="ficha.servicios.servicio_emergencia" />
                                        <servicio-badge label="Serv. Funerario"
                                            :activo="ficha.servicios.servicio_funerario" />
                                        <servicio-badge label="Médicos" :activo="ficha.servicios.medicos" />
                                        <servicio-badge label="Lavandería" :activo="ficha.servicios.lavanderia" />
                                        <servicio-badge label="Barbería/Peluquería"
                                            :activo="ficha.servicios.barberia_peluqueria" />
                                        <servicio-badge label="Otros" :activo="ficha.servicios.otros"
                                            :desc="ficha.servicios.otros_descripcion" />
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>

                        <q-expansion-item v-if="ficha.personal" icon="group" label="Personal" class="q-mt-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div class="row q-col-gutter-md">
                                        <div class="col-6 col-md-3" v-for="(val, key) in personalFields(ficha.personal)"
                                            :key="key">
                                            <detalle-campo :label="key" :value="val" />
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>
                    </div>
                </q-tab-panel>

                <!-- ── HISTORIAL ────────────────────────────────────────────────── -->
                <q-tab-panel name="historial">
                    <FichaHistorialPanel :centro-id="centroId" />
                </q-tab-panel>

                <!-- ── ACCESO DELEGADO ──────────────────────────────────────────── -->
                <q-tab-panel name="acceso" v-if="canManageAccess">
                    <CentroAccesoPanel :centro-id="centroId" />
                </q-tab-panel>
            </q-tab-panels>
        </div>
    </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LocalStorage } from 'quasar';
import { useCentrosStore } from 'src/stores/centros.store';

// Sub-paneles (componentes simples inline)
const DetalleCampo = {
    props: ['label', 'value'],
    template: `<div class="row q-mb-xs"><div class="col-5 text-caption text-grey">{{ label }}</div><div class="col text-body2">{{ value || '—' }}</div></div>`
};
const ServicioBadge = {
    props: ['label', 'activo', 'desc'],
    template: `<div class="col-6 col-md-4"><q-chip :color="activo ? 'positive' : 'grey-4'" :text-color="activo ? 'white' : 'grey-7'" dense>{{ label }}{{ desc ? ': ' + desc : '' }}</q-chip></div>`
};
const FichaHistorialPanel = { props: ['centroId'], template: `<div class="text-grey text-center q-pa-xl"><q-icon name="history" size="3rem" /><div>Historial de versiones — próximamente</div></div>` };
const CentroAccesoPanel = { props: ['centroId'], template: `<div class="text-grey text-center q-pa-xl"><q-icon name="people" size="3rem" /><div>Gestión de acceso — próximamente</div></div>` };

const route = useRoute();
const centrosStore = useCentrosStore();
const centroId = computed(() => route.params.id);

const tab = ref('resumen');
const centro = computed(() => centrosStore.current);
const ficha = computed(() => centrosStore.ficha);

const permisos = LocalStorage.getItem('permissions') || [];
const role = (LocalStorage.getItem('role') || '').toLowerCase();
const adminUser = ['admin', 'administrador', 'administrator'].includes(role);
function hasPerm(p) { return adminUser || permisos.some(x => x.name === p); }

const canEdit = computed(() => hasPerm('edit_centro'));
const canManageAccess = computed(() => hasPerm('manage_centro_access'));

// ── Tablas de población ────────────────────────────────────────────────
const colsPoblacion = [
    { name: 'modalidad', label: 'Modalidad', field: 'modalidad', align: 'left' },
    { name: 'categoria', label: 'Categoría', field: 'categoria', align: 'left' },
    { name: 'femenino', label: 'Femen.', field: 'femenino', align: 'center' },
    { name: 'masculino', label: 'Masc.', field: 'masculino', align: 'center' },
    { name: 'total', label: 'Total', field: 'total', align: 'center' },
];

// ── Helpers ───────────────────────────────────────────────────────────
function colorEstado(e) {
    return { activo: 'positive', inactivo: 'grey', suspendido: 'negative' }[e] || 'grey';
}
function labelTipo(t) {
    return { publico: 'Público', afiliada_ivss: 'Afiliada IVSS', privado: 'Privado', religiosa: 'Religioso', otra: 'Otro' }[t] || t || '—';
}
function labelClasif(c) {
    return { geriatrico: 'Geriátrico', gronto_psiquiatrico: 'Gronto-Psiquiátrico', casa_hogar: 'Casa Hogar', unidades_gerontologicas: 'Unidades Gerontológicas', fundacion: 'Fundación', otras: 'Otras' }[c] || c || '—';
}
function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-VE');
}
function personalFields(p) {
    return {
        'Méd. Geriatra': p.num_medicos_geriatra,
        'Méd. Psiquiatra': p.num_medicos_psiquiatra,
        'Enfermeros': p.num_enfermeros,
        'Cuidadores': p.num_cuidadores,
        'Camareros': p.num_camareros,
        'Aux. Enfermería': p.num_auxiliares_enfermeria,
        'Serv. Generales': p.num_servicios_generales,
        'Personal Cocina': p.num_personal_cocina,
        'No Adscritos': p.num_personal_no_adscrito,
    };
}

onMounted(async () => {
    await centrosStore.fetchCentro(centroId.value);
    await centrosStore.fetchFichaActual(centroId.value);
});
</script>
