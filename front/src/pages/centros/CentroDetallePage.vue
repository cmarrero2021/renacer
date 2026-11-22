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
            <!-- Oculto temporalmente (rehabilitable): no eliminar el código -->
            <q-btn v-if="false && canDelete" icon="delete" label="Eliminar" flat color="negative"
                @click="confirmarEliminar" />
            <q-btn icon="picture_as_pdf" label="PDF" flat color="primary"
                @click="generarPdfPrinterFriendly" />
        </div>

        <q-inner-loading :showing="centrosStore.loading" label="Cargando..." />

        <div v-if="centro">
            <q-tabs v-model="tab" align="left" class="q-mb-md">
                <q-tab name="resumen" label="Resumen" icon="info" />
                <q-tab name="ficha" label="Ficha Actual" icon="assignment" />
                <!-- Ocultos temporalmente (rehabilitables): no eliminar el código -->
                <q-tab name="historial" label="Historial" icon="history" v-if="false" />
                <q-tab name="acceso" label="Acceso" icon="people" v-if="false && canManageAccess" />
            </q-tabs>

            <q-tab-panels v-model="tab" animated>

                <!-- ── RESUMEN ──── -->
                <q-tab-panel name="resumen">
                    <div class="row q-col-gutter-md">

                        <!-- ── FOTO DEL CENTRO ──── -->
                        <div class="col-12" v-if="centro.foto_base64">
                            <q-card flat bordered>
                                <q-card-section class="q-pb-sm">
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="photo_camera" /> Foto del Centro
                                    </p>
                                </q-card-section>
                                <q-card-section class="q-pt-none">
                                    <div class="foto-container">
                                        <img
                                            :src="centro.foto_base64"
                                            alt="Foto del centro"
                                            class="foto-centro"
                                        />
                                    </div>
                                </q-card-section>
                            </q-card>
                        </div>

                        <div class="col-12 col-md-6">
                            <q-card flat bordered>
                                <q-card-section>
                                    <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                        <q-icon name="business" /> Datos del Centro
                                    </p>
                                </q-card-section>
                                <q-card-section>
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
                        <!-- ── 1. Titularidad y Contacto del Centro (centro_propietarios, centro_representantes, centro_telefonos, centro_correos) ── -->
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-4">
                                <q-card flat bordered class="fit">
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="person" color="primary" /> Propietario(s)
                                        </p>
                                        <div v-for="p in centro.propietarios" :key="p.id" class="q-mb-xs text-body2">
                                            {{ p.cedula_tipo }}-{{ p.cedula_nro }} — {{ p.nombre }}
                                            <q-badge v-if="p.es_principal" color="primary" label="Principal" class="q-ml-xs" />
                                        </div>
                                        <div v-if="!centro.propietarios?.length" class="text-grey text-body2">Sin propietarios</div>
                                    </q-card-section>
                                </q-card>
                            </div>

                            <div class="col-12 col-md-4">
                                <q-card flat bordered class="fit">
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="badge" color="primary" /> Representante(s) Legal(es)
                                        </p>
                                        <div v-for="r in centro.representantes" :key="r.id" class="q-mb-xs text-body2">
                                            {{ r.cedula_tipo }}-{{ r.cedula_nro }} — {{ r.nombre }}
                                            <span class="text-grey-7" v-if="r.cargo"> ({{ r.cargo }})</span>
                                        </div>
                                        <div v-if="!centro.representantes?.length" class="text-grey text-body2">Sin representantes</div>
                                    </q-card-section>
                                </q-card>
                            </div>

                            <div class="col-12 col-md-4">
                                <q-card flat bordered class="fit">
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm">
                                            <q-icon name="contact_phone" color="primary" /> Contacto (Teléfonos y Correos)
                                        </p>
                                        <div v-for="t in centro.telefonos" :key="t.id" class="text-body2">
                                            📞 {{ t.telefono }} <span class="text-caption text-grey">({{ t.tipo }})</span>
                                        </div>
                                        <div v-for="c in centro.correos" :key="c.id" class="text-body2">
                                            ✉ {{ c.correo }} <span class="text-caption text-grey">({{ c.tipo }})</span>
                                        </div>
                                        <div v-if="!centro.telefonos?.length && !centro.correos?.length" class="text-grey text-body2">Sin contacto</div>
                                    </q-card-section>
                                </q-card>
                            </div>
                        </div>

                        <!-- ── 2. Datos de la Ficha, Capacidad y Población ── -->
                        <div class="row q-col-gutter-md q-mb-md">
                            <!-- Datos básicos -->
                            <div class="col-12 col-md-4">
                                <q-card flat bordered>
                                    <q-card-section>
                                        <p class="text-subtitle1 text-weight-bold q-mb-sm"><q-icon name="event_note" color="primary" />
                                            Datos de la Ficha</p>
                                        <table style="width:100%; border-collapse:collapse">
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">RIF</td>
                                                <td class="text-body2 text-weight-bold" style="padding:2px 4px">{{ centro.rif || '—' }}</td>
                                            </tr>
                                            <tr v-if="centro.nro_registro_mercantil">
                                                <td class="text-caption text-grey" style="padding:2px 4px">Reg. Mercantil</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ centro.nro_registro_mercantil }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Tipo de Solicitud</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ labelSolicitud(ficha.tipo_solicitud) }}</td>
                                            </tr>
                                            <tr v-if="ficha.nro_registro_nacional">
                                                <td class="text-caption text-grey" style="padding:2px 4px">Nro. Reg. Nacional</td>
                                                <td class="text-body2 text-weight-bold" style="padding:2px 4px">{{ ficha.nro_registro_nacional }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Fecha Solicitud</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ formatDate(ficha.fecha_solicitud) }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Fecha Fundación</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ formatDate(ficha.fecha_fundacion) }}</td>
                                            </tr>
                                            <tr v-if="ficha.costo_mensual != null">
                                                <td class="text-caption text-grey" style="padding:2px 4px">Costo Mensual</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ Number(ficha.costo_mensual).toLocaleString('es-VE') }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Versión Ficha</td>
                                                <td class="text-body2" style="padding:2px 4px">v{{ ficha.version || 1 }}</td>
                                            </tr>
                                            <tr>
                                                <td class="text-caption text-grey" style="padding:2px 4px">Dirección</td>
                                                <td class="text-body2" style="padding:2px 4px">{{ ficha.direccion || '—' }}</td>
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
                            class="q-mb-sm">
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
                                            dense>Médicos{{ ficha.servicios.medicos_descripcion ? ': ' + toTitleCase(ficha.servicios.medicos_descripcion) : '' }}</q-chip>
                                        <q-chip v-if="ficha.servicios.lavanderia" color="positive" text-color="white"
                                            dense>Lavandería{{ ficha.servicios.lavanderia_descripcion ? ': ' + toTitleCase(ficha.servicios.lavanderia_descripcion) : '' }}</q-chip>
                                        <q-chip v-if="ficha.servicios.barberia_peluqueria" color="positive"
                                            text-color="white" dense>Barbería/Peluquería</q-chip>
                                        <q-chip v-if="ficha.servicios.otros" color="positive" text-color="white"
                                            dense>Otros{{ ficha.servicios.otros_descripcion ? ': ' + toTitleCase(ficha.servicios.otros_descripcion) : '' }}</q-chip>
                                        <!-- Servicios adicionales del catálogo (persistidos en ficha_servicios.extras) -->
                                        <q-chip v-for="s in serviciosExtras" :key="s.codigo" color="positive"
                                            text-color="white" dense>{{ s.label }}</q-chip>
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
                                            <div class="text-caption text-grey">Médicos Generales</div>{{
                                            ficha.personal.num_medicos ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2" v-if="ficha.personal.num_medicos_geriatra != null">
                                            <div class="text-caption text-grey">Médicos Geriatras</div>{{
                                            ficha.personal.num_medicos_geriatra }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2" v-if="ficha.personal.num_medicos_psiquiatra != null">
                                            <div class="text-caption text-grey">Médicos Psiquiatras</div>{{
                                            ficha.personal.num_medicos_psiquiatra }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Gerontólogos</div>{{
                                            ficha.personal.num_gerontologos ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Psicólogos</div>{{
                                            ficha.personal.num_psicologos ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Enfermeros</div>{{
                                            ficha.personal.num_enfermeros ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Aux. Enfermería</div>{{
                                            ficha.personal.num_auxiliares_enfermeria ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Cuidadores</div>{{
                                            ficha.personal.num_cuidadores ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Camareros</div>{{
                                            ficha.personal.num_camareros ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Serv. Generales</div>{{
                                            ficha.personal.num_servicios_generales ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Cocina y comedor</div>{{
                                            ficha.personal.num_personal_cocina ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Resp. de farmacia</div>{{
                                            ficha.personal.num_responsables_farmacia ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">Personal de seguridad</div>{{
                                            ficha.personal.num_personal_seguridad ?? 0 }}
                                        </div>
                                        <div class="col-6 col-md-3 text-body2">
                                            <div class="text-caption text-grey">No Adscritos</div>{{
                                            ficha.personal.num_personal_no_adscrito ?? 0 }}
                                            <span v-if="ficha.personal.descripcion_no_adscrito" class="text-caption text-grey block">
                                                ({{ toTitleCase(ficha.personal.descripcion_no_adscrito) }})
                                            </span>
                                        </div>
                                        <div class="col-12 col-md-6 text-body2" v-if="ficha.personal.posee_expediente_curricular != null">
                                            <span class="text-caption text-grey q-mr-sm">Posee expediente curricular:</span>
                                            <q-badge :color="ficha.personal.posee_expediente_curricular ? 'positive' : 'grey-5'"
                                                :label="ficha.personal.posee_expediente_curricular ? 'Sí' : 'No'" />
                                        </div>
                                        <div class="col-12 text-body2" v-if="ficha.personal.otros_personal">
                                            <span class="text-caption text-grey q-mr-sm">Otros tipos de personal:</span>
                                            <span>{{ toTitleCase(ficha.personal.descripcion_otros_personal) || 'Registrado' }}</span>
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                        </q-expansion-item>

                        <!-- ── Infraestructura y Accesibilidad ▸ secciones colapsables ── -->
                        <q-expansion-item v-if="ficha.infraestructura || ficha.accesibilidad"
                            icon="foundation" label="Infraestructura y Accesibilidad"
                            header-class="text-weight-bold" class="q-mb-sm">

                            <!-- Sub-sección colapsable ▸ Infraestructura -->
                            <q-expansion-item v-if="ficha.infraestructura"
                                header-class="text-weight-bold">
                                <template #header>
                                    <q-item-section avatar>
                                        <q-icon name="foundation" color="primary" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label class="text-weight-bold">Infraestructura</q-item-label>
                                        <q-item-label caption>Dimensiones, condiciones, seguridad y convivencia</q-item-label>
                                    </q-item-section>
                                </template>
                                <q-card flat bordered>
                                    <q-card-section>
                                    <div class="row q-col-gutter-md">
                                        <div class="col-12 col-md-6">
                                            <table style="width:100%; border-collapse:collapse">
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Estado inmueble</td>
                                                    <td class="text-body2" style="padding:4px">{{ toTitleCase(ficha.infraestructura.estado_inmueble_nombre) || '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Nro. dormitorios</td>
                                                    <td class="text-body2" style="padding:4px">{{
                                                        ficha.infraestructura.num_dormitorios ?? '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Dormitorios adecuados</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.dormitorios_adecuados ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.dormitorios_adecuados ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Nro. sanitarios</td>
                                                    <td class="text-body2" style="padding:4px">{{
                                                        ficha.infraestructura.num_sanitarios ?? '—' }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Sanitarios adecuados</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.sanitarios_adecuados ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.sanitarios_adecuados ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Área de cocina</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.tiene_area_cocina ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.tiene_area_cocina ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.tiene_area_cocina">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Cocina adecuada</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.cocina_adecuada ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.cocina_adecuada ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Áreas de atención médica/enfermería</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.areas_atencion_medica ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.areas_atencion_medica ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Áreas verdes</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.areas_verdes ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.areas_verdes ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.area_total_m2 != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Área total (m²)</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.area_total_m2 }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.area_construida_m2 != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Área construida (m²)</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.area_construida_m2 }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.tamano_habitaciones_m2 != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Tamaño de habitaciones (m²)</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.tamano_habitaciones_m2 }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.personas_por_habitacion != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Personas por habitación</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.personas_por_habitacion }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.camas_por_habitacion != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Camas por habitación</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.camas_por_habitacion }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.banos_por_habitacion != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Baños por habitación</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.banos_por_habitacion }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.banos_completos != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Baños completos</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.banos_completos }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.banos_sin_ducha != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Baños sin ducha</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.banos_sin_ducha }}</td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.cant_tinas != null">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Cantidad de tinas</td>
                                                    <td class="text-body2" style="padding:4px">{{ ficha.infraestructura.cant_tinas }}</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Cap. comedor</td>
                                                    <td class="text-body2" style="padding:4px">{{
                                                        ficha.infraestructura.capacidad_comedor_pct != null ?
                                                        ficha.infraestructura.capacidad_comedor_pct + '%' : '—' }}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="col-12 col-md-6">
                                            <table style="width:100%; border-collapse:collapse">
                                                <tr>
                                                    <td colspan="2" class="text-caption text-grey text-weight-medium" style="padding:4px">Servicios básicos</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Luz eléctrica</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.luz_electrica ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.luz_electrica ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Agua potable</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.agua_potable ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.agua_potable ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Aguas servidas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.agua_servidas ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.agua_servidas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Depósito basura</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.deposito_basura ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.deposito_basura ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Tanque de agua</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.tanque_agua ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.tanque_agua ? ('Sí' + (ficha.infraestructura.capacidad_tanque ? ' (' + ficha.infraestructura.capacidad_tanque + 'L)' : '')) : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.tanque_agua">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Bomba de agua</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.bomba_agua ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.bomba_agua ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colspan="2" class="text-caption text-grey text-weight-medium q-pt-md" style="padding:4px">Áreas e instalaciones</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Comedor</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.tiene_comedor ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.tiene_comedor ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Farmacia / almacén clínico</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.tiene_farmacia_almacen_clinico ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.tiene_farmacia_almacen_clinico ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Aceptan mascotas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.acepta_mascotas ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.acepta_mascotas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Gerogranjas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.gerogranjas ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.gerogranjas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Residuos separados</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.residuos_separados ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.residuos_separados ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colspan="2" class="text-caption text-grey text-weight-medium q-pt-md" style="padding:4px">Seguridad y energía</td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Sistema de seguridad</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.sistema_seguridad ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.sistema_seguridad ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Cámaras de seguridad</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.tiene_camaras ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.tiene_camaras ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Control de acceso / salida</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <span class="q-mr-xs">Acceso: <q-badge :color="ficha.infraestructura.control_acceso ? 'positive' : 'grey-5'" :label="ficha.infraestructura.control_acceso ? 'Sí' : 'No'" /></span>
                                                        <span>Salida: <q-badge :color="ficha.infraestructura.control_salida ? 'positive' : 'grey-5'" :label="ficha.infraestructura.control_salida ? 'Sí' : 'No'" /></span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Alarma de emergencia</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.alarma_emergencia ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.alarma_emergencia ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Botones de emergencia</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <span class="q-mr-xs">Habitaciones: <q-badge :color="ficha.infraestructura.boton_emergencia_habitaciones ? 'positive' : 'grey-5'" :label="ficha.infraestructura.boton_emergencia_habitaciones ? 'Sí' : 'No'" /></span>
                                                        <span class="q-mr-xs">Baños: <q-badge :color="ficha.infraestructura.boton_emergencia_banio ? 'positive' : 'grey-5'" :label="ficha.infraestructura.boton_emergencia_banio ? 'Sí' : 'No'" /></span>
                                                        <span>Pasillos: <q-badge :color="ficha.infraestructura.boton_emergencia_pasillos ? 'positive' : 'grey-5'" :label="ficha.infraestructura.boton_emergencia_pasillos ? 'Sí' : 'No'" /></span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Iluminación de emergencia</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.iluminacion_emergencia ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.iluminacion_emergencia ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Iluminación adecuada</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.iluminacion_adecuada ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.iluminacion_adecuada ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Ventilación adecuada</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.ventilacion_adecuada ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.ventilacion_adecuada ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Señalización clara</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.senalizacion_clara ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.senalizacion_clara ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Prevención de incendios</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.prevencion_incendios ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.prevencion_incendios ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Sistemas de ventilación</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.sistemas_ventilacion ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.sistemas_ventilacion ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Aire acondicionado</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.aire_acondicionado ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.aire_acondicionado ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Normativa visible</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.normativa_visible ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.normativa_visible ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Planta eléctrica</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.infraestructura.planta_electrica ? 'positive' : 'grey-5'"
                                                            :label="ficha.infraestructura.planta_electrica ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.planta_electrica && ficha.infraestructura.planta_electrica_panel_solar">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Panel solar</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge color="positive" label="Sí" />
                                                    </td>
                                                </tr>
                                                <tr v-if="ficha.infraestructura.planta_electrica && ficha.infraestructura.planta_electrica_tipo_nombre">
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Tipo de planta</td>
                                                    <td class="text-body2" style="padding:4px">{{ toTitleCase(ficha.infraestructura.planta_electrica_tipo_nombre) }}</td>
                                                </tr>
                                            </table>
                                            <div v-if="ficha.infraestructura.descripcion_otros" class="q-mt-sm">
                                                <div class="text-caption text-grey">Observaciones adicionales</div>
                                                <div class="text-body2">{{ toTitleCase(ficha.infraestructura.descripcion_otros) }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </q-card-section>
                                </q-card>
                            </q-expansion-item>

                            <!-- Sub-sección colapsable ▸ Accesibilidad -->
                            <q-expansion-item v-if="ficha.accesibilidad"
                                header-class="text-weight-bold">
                                <template #header>
                                    <q-item-section avatar>
                                        <q-icon name="accessible" color="primary" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label class="text-weight-bold">Accesibilidad</q-item-label>
                                        <q-item-label caption>Accesos, pasillos, baños, mobiliario y señalización</q-item-label>
                                    </q-item-section>
                                </template>
                                <q-card flat bordered>
                                    <q-card-section>
                                    <div class="row q-col-gutter-md">
                                        <div class="col-12 col-md-6">
                                            <table style="width:100%; border-collapse:collapse">
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Rampas fijas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.rampas_fijas ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.rampas_fijas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Piso acabado antirresbalante</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.piso_antirresbalante ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.piso_antirresbalante ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Alfombras sueltas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.alfombras_sueltas ? 'warning' : 'grey-5'"
                                                            :label="ficha.accesibilidad.alfombras_sueltas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Alfombras aseguradas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.alfombras_aseguradas ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.alfombras_aseguradas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Ascensores</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.ascensores ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.ascensores ? ('Sí' + (ficha.accesibilidad.num_ascensores ? ' (' + ficha.accesibilidad.num_ascensores + ')' : '')) : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Pasamanos</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.pasamanos ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.pasamanos ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Marquesinas de acceso</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.marquesinas_acceso ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.marquesinas_acceso ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Estacionamientos reservados</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.estacionamientos_reservados ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.estacionamientos_reservados ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Pasamanos dobles</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.pasamanos_dobles ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.pasamanos_dobles ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Zonas de descanso</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.zonas_descanso ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.zonas_descanso ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Barras de apoyo</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.barras_apoyo ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.barras_apoyo ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Inodoros elevados</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.inodoros_elevados ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.inodoros_elevados ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Duchas a ras del suelo</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.duchas_ras_suelo ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.duchas_ras_suelo ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Lavamanos suspendidos</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.lavamanos_suspendidos ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.lavamanos_suspendidos ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Grifería de palanca</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.griferia_palanca ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.griferia_palanca ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Sillas con apoyabrazos</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.sillas_apoyabrazos ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.sillas_apoyabrazos ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Mesas sin obstáculos</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.mesas_sin_obstaculos ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.mesas_sin_obstaculos ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="col-12 col-md-6">
                                            <table style="width:100%; border-collapse:collapse">
                                                <tr>
                                                    <td class="text-caption text-grey" style="width:60%;padding:4px">Escaleras con huellas antirresbalantes</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.escaleras_antirresbalantes ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.escaleras_antirresbalantes ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Baños Geriátricos</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.banos_geriatricos ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.banos_geriatricos ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Señales visuales, audibles y táctiles</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.senales_accesibles ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.senales_accesibles ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Timbres de emergencia</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.timbres_emergencia ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.timbres_emergencia ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Pasillos accesibles para sillas de ruedas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.pasillos_accesibles_sillas ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.pasillos_accesibles_sillas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Botón de emergencia</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.boton_emergencia ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.boton_emergencia ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Baldosas para invidentes (podotáctiles)</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.pisos_podotactiles ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.pisos_podotactiles ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Alto contraste visual en avisos y señales</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.alto_contraste_visual ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.alto_contraste_visual ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Pictogramas universales</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.pictogramas_universales ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.pictogramas_universales ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Iluminación homogénea</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.iluminacion_homogenea ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.iluminacion_homogenea ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Alarmas duales auditivas y visuales</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.alarmas_duales ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.alarmas_duales ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="text-caption text-grey" style="padding:4px">Rutas de evacuación anchas</td>
                                                    <td class="text-body2" style="padding:4px">
                                                        <q-badge :color="ficha.accesibilidad.rutas_evacuacion_anchas ? 'positive' : 'grey-5'"
                                                            :label="ficha.accesibilidad.rutas_evacuacion_anchas ? 'Sí' : 'No'" />
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                </q-card-section>
                            </q-card>
                            </q-expansion-item>
                        </q-expansion-item>

                        <!-- Documentos (solo tipos activos en el catálogo) -->
                        <q-expansion-item v-if="documentosVisibles.length" icon="folder" label="Documentos"
                            class="q-mb-sm">
                            <q-card flat bordered>
                                <q-card-section>
                                    <div v-for="d in documentosVisibles" :key="d.id" class="row items-center q-py-xs q-col-gutter-sm" style="border-bottom: 1px solid #f0f0f0">
                                        <div class="col-12 col-md-5 text-body2 text-weight-medium">
                                            {{ labelTipoDoc(d.tipo_documento) }}
                                            <div v-if="d.descripcion" class="text-caption text-grey-7">{{ d.descripcion }}</div>
                                        </div>
                                        <div class="col-auto" v-if="!esRifRow(d)">
                                            <q-chip dense :color="d.tiene_original ? 'positive' : 'grey-4'"
                                                :text-color="d.tiene_original ? 'white' : 'grey-7'">Original</q-chip>
                                            <q-chip dense :color="d.tiene_copia ? 'positive' : 'grey-4'"
                                                :text-color="d.tiene_copia ? 'white' : 'grey-7'">Copia</q-chip>
                                        </div>
                                        <div class="col-12 col-md-5">
                                            <!-- RIF precargado del autorregistro: vive en centros.rif_archivo -->
                                            <div v-if="d.es_rif_precargado" class="row items-center q-gutter-xs">
                                                <q-chip dense color="green-1" text-color="green-8" icon="verified">
                                                    Cargado en el registro
                                                </q-chip>
                                                <q-btn flat round dense size="sm" icon="visibility" color="primary"
                                                    @click="verRifPrecargado" title="Abrir en nueva pestaña" />
                                                <q-btn flat round dense size="sm" icon="download" color="grey-8"
                                                    @click="descargarRifPrecargado" title="Descargar RIF" />
                                            </div>
                                            <div v-else-if="d.tiene_archivo || d.archivo_nombre" class="row items-center q-gutter-xs">
                                                <q-chip dense color="red-1" text-color="negative" icon="picture_as_pdf">
                                                    <span class="ellipsis" style="max-width: 150px" :title="d.archivo_nombre || 'Documento PDF'">
                                                        {{ d.archivo_nombre || 'Documento PDF' }}
                                                    </span>
                                                    <span v-if="d.archivo_tamano" class="text-caption text-grey-7 q-ml-xs">
                                                        ({{ formatFileSize(d.archivo_tamano) }})
                                                    </span>
                                                </q-chip>
                                                <q-btn flat round dense size="sm" icon="visibility" color="primary"
                                                    @click="verDocumentoPdf(d)" title="Abrir en nueva pestaña" />
                                                <q-btn flat round dense size="sm" icon="download" color="grey-8"
                                                    @click="descargarDocumentoPdf(d)" title="Descargar PDF" />
                                            </div>
                                            <div v-else class="text-caption text-grey-5 italic">
                                                Sin archivo digital adjunto
                                            </div>
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
                    <div class="row items-center q-mb-md">
                        <div class="text-h6">Usuarios con Acceso</div>
                        <q-space />
                        <q-btn color="primary" icon="person_add" label="Otorgar Acceso" @click="showAddDialog = true" />
                    </div>

                    <q-table :rows="centrosStore.centroUsers" :columns="colsAcceso" flat bordered row-key="id"
                        :loading="centrosStore.loading">
                        <template v-slot:body-cell-access_level="props">
                            <q-td :props="props">
                                <q-badge :color="props.value === 'admin' ? 'negative' : 'primary'">
                                    {{ labelAccess(props.value) }}
                                </q-badge>
                            </q-td>
                        </template>
                        <template v-slot:body-cell-actions="props">
                            <q-td :props="props">
                                <q-btn flat round color="negative" icon="delete" size="sm" @click="confirmRevoke(props.row)">
                                    <q-tooltip>Revocar acceso</q-tooltip>
                                </q-btn>
                            </q-td>
                        </template>
                    </q-table>

                    <!-- Diálogo para agregar usuario -->
                    <q-dialog v-model="showAddDialog" persistent>
                        <q-card style="min-width: 400px">
                            <q-card-section class="row items-center q-pb-none">
                                <div class="text-h6">Otorgar Acceso a Centro</div>
                                <q-space />
                                <q-btn icon="close" flat round dense v-close-popup />
                            </q-card-section>

                            <q-card-section class="q-pt-md">
                                <q-select v-model="selectedUser" use-input hide-selected fill-input input-debounce="300"
                                    label="Buscar Usuario (mín. 2 letras)" :options="userOptions" @filter="filterUsers"
                                    outlined class="q-mb-md">
                                    <template v-slot:no-option>
                                        <q-item>
                                            <q-item-section class="text-grey">
                                                No se encontraron resultados
                                            </q-item-section>
                                        </q-item>
                                    </template>
                                </q-select>

                                <q-select v-model="selectedAccessLevel" :options="accessLevelOptions" label="Nivel de Acceso"
                                    emit-value map-options outlined />
                            </q-card-section>

                            <q-card-actions align="right" class="text-primary q-pb-md q-px-md">
                                <q-btn flat label="Cancelar" v-close-popup />
                                <q-btn unelevated color="primary" label="Otorgar Acceso" @click="handleGrantAccess"
                                    :disable="!selectedUser" />
                            </q-card-actions>
                        </q-card>
                    </q-dialog>
                </q-tab-panel>


            </q-tab-panels>
        </div>

        <!-- Modal Visor de PDF en Detalle -->
        <q-dialog v-model="pdfViewerOpen" maximized>
            <q-card class="column full-height">
                <q-bar class="bg-primary text-white">
                    <q-icon name="picture_as_pdf" />
                    <div>{{ pdfViewerTitle }}</div>
                    <q-space />
                    <q-btn dense flat icon="open_in_new" label="Abrir en pestaña" @click="openPdfInNewTab" class="q-mr-sm" />
                    <q-btn dense flat icon="download" label="Descargar" @click="downloadCurrentPdf" class="q-mr-sm" />
                    <q-btn dense flat icon="close" v-close-popup />
                </q-bar>
                <q-card-section class="col q-pa-none">
                    <iframe :src="pdfViewerUrl" class="fit" style="border: none;"></iframe>
                </q-card-section>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch, } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LocalStorage, Notify, useQuasar } from 'quasar';
import { jsPDF } from 'jspdf';
import { useCentrosStore } from 'src/stores/centros.store';
import { useCatalogosStore } from 'src/stores/catalogos.store';
import { centrosService, fichasService } from 'src/services/centros.service';

// autoTable no está instalado – se usa renderizado manual de tablas en el PDF
let autoTable = null;

// ────────────────────────────────────────────────────────────────────────────
// Inicialización de stores, route, y datos reactivos del componente
// ──────────────────────────────────────────────────────────────────────────
const route = useRoute();
const router = useRouter();
const centrosStore = useCentrosStore();
const catalogosStore = useCatalogosStore();

const centroId = computed(() => route.params.id);
const tab = ref('resumen');
const centro = computed(() => centrosStore.current);
const ficha = computed(() => centrosStore.ficha);

// Cuando esté listo autoTable, lo asignamos
const formatDateVue = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Convierte a "primera en mayúsculas, resto minúsculas"
const toTitleCase = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// ─── PDF Printer Friendly ──────────────────────────────────────────────
const generarPdfPrinterFriendly = async () => {
  const centroData = centro.value;
  const fichaData = ficha.value;
  if (!centroData) return;
  if (!fichaData && !centroData.foto_base64) {
    Notify.create({ type: 'warning', message: 'No hay datos suficientes para generar el PDF.' });
    return;
  }

  // Cargar imagen del cintillo institucional (/img/cintillo.png)
  let cintilloBase64 = null;
  for (const url of ['/img/cintillo.png', 'img/cintillo.png']) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        cintilloBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (cintilloBase64) break;
      }
    } catch {
      // continuar con siguiente ruta
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight; // 182
  const topMargin = 25; // Debajo del encabezado con cintillo
  const bottomMargin = 14;
  const maxY = pageHeight - bottomMargin;

  // ─── Encabezado en cada página ───
  const headerImgHeight = 11; // 1868 x 113 px -> 182 / 16.53 = ~11 mm
  const dibujarEncabezado = (pageNumber, totalPages) => {
    if (cintilloBase64) {
      try {
        doc.addImage(cintilloBase64, 'PNG', marginLeft, 6, contentWidth, headerImgHeight);
      } catch (err) {
        console.warn('No se pudo insertar el cintillo en el PDF:', err);
      }
    } else {
      // Fallback si la imagen no está disponible
      doc.setFillColor(0, 51, 102);
      doc.rect(marginLeft, 6, contentWidth, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(
        'REPÚBLICA BOLIVARIANA DE VENEZUELA - MINISTERIO PARA LA ATENCIÓN DEL ADULTO MAYOR',
        pageWidth / 2,
        12.5,
        { align: 'center' }
      );
    }

    // Texto RENACER - alineado a la izquierda, debajo del cintillo
    /*doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 51, 102);
    doc.text('RENACER - Registro Nacional de Centros de Atención al Adulto Mayor', marginLeft, 20);
    */
  };

  // ─── Pie de página en cada página ───
  const dibujarPiePagina = (pageNumber, totalPages, fechaHora) => {
    const yFooter = pageHeight - 9;
    doc.setDrawColor(210, 215, 225);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, yFooter - 3, pageWidth - marginRight, yFooter - 3);

    doc.setTextColor(110, 115, 125);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('RENACER - Registro Nacional de Centros de Atención al Adulto Mayor', marginLeft, yFooter + 1);
    doc.text(`Página ${pageNumber} de ${totalPages}   ·   Emisión: ${fechaHora}`, pageWidth - marginRight, yFooter + 1, { align: 'right' });
  };

  // ─── Control de salto de página automático ───
  let currentY = topMargin;
  const checkPageBreak = (neededHeight) => {
    if (currentY + neededHeight > maxY) {
      doc.addPage();
      currentY = topMargin;
    }
  };

  // ─── Helpers para dibujar bloques de contenido ───
  const drawSectionHeader = (title) => {
    checkPageBreak(11);
    currentY += 1.5;
    doc.setFillColor(242, 245, 249);
    doc.rect(marginLeft, currentY, contentWidth, 5.5, 'F');
    doc.setFillColor(0, 51, 102); // Barra izquierda azul
    doc.rect(marginLeft, currentY, 2.5, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 51, 102);
    doc.text(toTitleCase(title), marginLeft + 5, currentY + 3.8);
    currentY += 7.5;
  };

  const drawKeyValueGrid = (items, cols = 2) => {
    const colWidth = contentWidth / cols;
    const rowHeight = 4.2;
    const numRows = Math.ceil(items.length / cols);
    checkPageBreak(numRows * rowHeight + 2);

    doc.setFontSize(6.8);
    for (let r = 0; r < numRows; r++) {
      const yLine = currentY + r * rowHeight;
      if (r % 2 === 1) {
        doc.setFillColor(249, 250, 252);
        doc.rect(marginLeft, yLine - 3.2, contentWidth, rowHeight, 'F');
      }
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < items.length) {
          const item = items[idx];
          const xCol = marginLeft + c * colWidth;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(90, 95, 105);
          doc.text(toTitleCase(`${item.label}:`), xCol + 2, yLine);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(20, 25, 35);
          const labelW = doc.getTextWidth(toTitleCase(`${item.label}: `));
          const xVal = xCol + 2 + Math.max(labelW, 36);
          const maxValW = colWidth - Math.max(labelW, 36) - 4;
          const valStr = toTitleCase(String(item.value ?? '—'));
          const truncVal = doc.splitTextToSize(valStr, maxValW)[0] || '—';
          doc.text(truncVal, xVal, yLine);
        }
      }
    }
    currentY += numRows * rowHeight + 2;
  };

  const drawFullRow = (label, value) => {
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    const labelW = doc.getTextWidth(toTitleCase(`${label}: `));
    const maxValW = contentWidth - Math.max(labelW, 36) - 4;
    const valStr = toTitleCase(String(value || '—'));
    const splitLines = doc.splitTextToSize(valStr, maxValW);
    const blockHeight = Math.max(splitLines.length * 3.5, 4.5);
    checkPageBreak(blockHeight + 1);

    doc.setTextColor(90, 95, 105);
    doc.text(toTitleCase(`${label}:`), marginLeft + 2, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 25, 35);
    doc.text(splitLines, marginLeft + 2 + Math.max(labelW, 36), currentY);
    currentY += blockHeight + 1;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CUERPO DEL REPORTE
  // ══════════════════════════════════════════════════════════════════════════

  // 1. Título principal del centro
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 51, 102);
  const nombreCentro = centroData?.nombre_establecimiento || 'Centro de Atención';
  const nombreUpper = nombreCentro.toUpperCase();

  // Si el nombre excede los 64 caracteres, se parte en varias líneas:
  // el resto del contenido se desplaza hacia abajo automáticamente porque
  // todo se posiciona con currentY.
  const LIMITE_CARACTERES_TITULO = 64;
  const tituloLines = nombreUpper.length > LIMITE_CARACTERES_TITULO
    ? doc.splitTextToSize(nombreUpper, contentWidth)
    : [nombreUpper];
  const tituloLineHeight = 4.5;

  doc.text(tituloLines, marginLeft, currentY);
  currentY += tituloLines.length * tituloLineHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 105, 115);
  const estadoBadge = (centroData?.estado_centro || 'activo').toUpperCase();
  const subtitulo = `RIF: ${centroData?.rif || '—'}   ·   Estado: ${estadoBadge}   ·   ${labelTipo(centroData?.tipo_establecimiento)}   ·   ${labelClasif(centroData?.tipo_clasificacion)}`;
  doc.text(subtitulo, marginLeft, currentY);
  currentY += 5;

  // 2. Datos Generales del Centro
  drawSectionHeader('Datos Generales del Centro');
  const infoGeneral = [
    { label: 'RIF', value: centroData?.rif || '—' },
    { label: 'Nro. Reg. Mercantil', value: centroData?.nro_registro_mercantil || '—' },
    { label: 'Tipo Establecimiento', value: labelTipo(centroData?.tipo_establecimiento) },
    { label: 'Clasificación', value: labelClasif(centroData?.tipo_clasificacion) },
    { label: 'Estado', value: centroData?.estado || '—' },
    { label: 'Municipio', value: centroData?.municipio || '—' },
    { label: 'Parroquia', value: centroData?.parroquia || '—' },
    { label: 'Estado del Centro', value: estadoBadge },
  ];
  drawKeyValueGrid(infoGeneral, 2);

  if (centroData?.direccion_corta || fichaData?.direccion) {
    drawFullRow('Dirección', centroData?.direccion_corta || fichaData?.direccion);
  }

  // 3. Fotografía del Centro (si existe)
  if (centroData?.foto_base64) {
    checkPageBreak(40);
    drawSectionHeader('Fotografía del Centro');
    try {
      let fotoData = centroData.foto_base64;
      if (!fotoData.startsWith('data:')) {
        fotoData = `data:image/jpeg;base64,${fotoData}`;
      }
      doc.addImage(fotoData, 'JPEG', marginLeft + 2, currentY, 55, 30);
      doc.setDrawColor(210, 215, 225);
      doc.setLineWidth(0.3);
      doc.rect(marginLeft + 2, currentY, 55, 30);
      currentY += 33;
    } catch (err) {
      console.warn('Error al incluir foto en PDF:', err);
    }
  }

  // 4. Propietarios y Representantes
  const hayPropietarios = Boolean(centroData?.propietarios?.length);
  const hayRepresentantes = Boolean(centroData?.representantes?.length);
  if (hayPropietarios || hayRepresentantes) {
    drawSectionHeader('Propietarios y Representantes Legales');
    if (hayPropietarios) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(60, 65, 75);
      doc.text('Propietario(s):', marginLeft + 2, currentY);
      currentY += 3.5;
      centroData.propietarios.forEach((p) => {
        checkPageBreak(4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 25, 35);
        const cedula = `${p.cedula_tipo}-${p.cedula_nro}`;
        const principalTag = p.es_principal ? ' (Principal)' : '';
        doc.text(`• ${cedula} — ${p.nombre}${principalTag}`, marginLeft + 5, currentY);
        currentY += 3.5;
      });
      currentY += 1;
    }
    if (hayRepresentantes) {
      checkPageBreak(4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(60, 65, 75);
      doc.text('Representante(s) Legal(es):', marginLeft + 2, currentY);
      currentY += 3.5;
      centroData.representantes.forEach((r) => {
        checkPageBreak(4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 25, 35);
        const cedula = `${r.cedula_tipo}-${r.cedula_nro}`;
        const cargo = r.cargo ? ` (${r.cargo})` : '';
        doc.text(`• ${cedula} — ${r.nombre}${cargo}`, marginLeft + 5, currentY);
        currentY += 3.5;
      });
      currentY += 1;
    }
  }

  // 5. Contacto
  const hayTelefonos = Boolean(centroData?.telefonos?.length);
  const hayCorreos = Boolean(centroData?.correos?.length);
  if (hayTelefonos || hayCorreos) {
    drawSectionHeader('Información de Contacto');
    const itemsContacto = [];
    if (hayTelefonos) {
      const tels = centroData.telefonos.map(t => `${t.telefono} (${t.tipo || 'tel'})`).join(', ');
      itemsContacto.push({ label: 'Teléfonos', value: tels });
    }
    if (hayCorreos) {
      const emails = centroData.correos.map(c => `${c.correo} (${c.tipo || 'email'})`).join(', ');
      itemsContacto.push({ label: 'Correos', value: emails });
    }
    drawKeyValueGrid(itemsContacto, 1);
  }

  // 6. Ficha Actual (si existe)
  if (fichaData) {
    // 6.1 Datos de la Ficha
    drawSectionHeader('Datos de la Ficha Técnica Actual (fichas_establecimiento)');
    const fichaInfo = [
      { label: 'Tipo de Solicitud', value: labelSolicitud(fichaData.tipo_solicitud) },
      { label: 'Nro. Reg. Nacional', value: fichaData.nro_registro_nacional || '—' },
      { label: 'Fecha Solicitud', value: formatDateVue(fichaData.fecha_solicitud) },
      { label: 'Fecha Fundación', value: formatDateVue(fichaData.fecha_fundacion) },
      { label: 'Costo Mensual', value: fichaData.costo_mensual != null ? Number(fichaData.costo_mensual).toLocaleString('es-VE') : '—' },
      { label: 'Versión Ficha', value: `v${fichaData.version || 1}` },
      { label: 'ID Ficha', value: fichaData.id ? String(fichaData.id) : '—' },
    ];
    drawKeyValueGrid(fichaInfo, 2);
    if (fichaData.direccion) {
      drawFullRow('Dirección Ficha', fichaData.direccion);
    }

    // 6.2 Capacidad
    if (fichaData.capacidad) {
      drawSectionHeader('Capacidad Instalada y Atención (ficha_capacidad)');
      const cap = fichaData.capacidad;
      const capInfo = [
        { label: 'Cap. Total Residentes', value: cap.capacidad_total_residente ?? '—' },
        { label: 'Residentes Actuales', value: cap.capacidad_actual_residente ?? '—' },
        { label: 'Atención Ambulatoria', value: cap.atencion_ambulatoria ? 'Sí' : 'No' },
        { label: 'Cupos Ambulatorios', value: cap.atencion_ambulatoria ? (cap.num_atencion_ambulatoria ?? '—') : 'N/A' },
      ];
      drawKeyValueGrid(capInfo, 2);
    }

    // 6.3 Población
    if (fichaData.poblacion?.length) {
      const fechaCorte = fichaData.poblacion[0]?.fecha_corte ? formatDateVue(fichaData.poblacion[0].fecha_corte) : '—';
      drawSectionHeader(`Población Atendida (ficha_poblacion · Fecha de corte: ${fechaCorte})`);

      const cols = [
        { label: 'Modalidad', width: 44, align: 'left' },
        { label: 'Categoría', width: 44, align: 'left' },
        { label: 'Fem.', width: 28, align: 'center' },
        { label: 'Masc.', width: 28, align: 'center' },
        { label: 'Total', width: 34, align: 'center' },
      ];

      // Cabecera de la tabla
      checkPageBreak(6 + (fichaData.poblacion.length + 1) * 4);
      doc.setFillColor(0, 51, 102);
      doc.rect(marginLeft, currentY, contentWidth, 4.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);

      let xOffset = marginLeft;
      cols.forEach((col) => {
        if (col.align === 'center') {
          doc.text(col.label, xOffset + col.width / 2, currentY + 3.2, { align: 'center' });
        } else {
          doc.text(col.label, xOffset + 2, currentY + 3.2);
        }
        xOffset += col.width;
      });
      currentY += 4.5;

      // Filas
      doc.setFontSize(6.8);
      let totalFem = 0;
      let totalMasc = 0;
      let totalGral = 0;

      fichaData.poblacion.forEach((r, idx) => {
        checkPageBreak(4);
        if (idx % 2 === 1) {
          doc.setFillColor(248, 249, 251);
          doc.rect(marginLeft, currentY, contentWidth, 4, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 25, 35);

        const femVal = Number(r.femenino) || 0;
        const mascVal = Number(r.masculino) || 0;
        const totVal = Number(r.total) || 0;
        totalFem += femVal;
        totalMasc += mascVal;
        totalGral += totVal;

        let colX = marginLeft;
        doc.text(String(r.modalidad || '—'), colX + 2, currentY + 2.8);
        colX += cols[0].width;
        doc.text(String(r.categoria || '—'), colX + 2, currentY + 2.8);
        colX += cols[1].width;
        doc.text(String(r.femenino ?? '0'), colX + cols[2].width / 2, currentY + 2.8, { align: 'center' });
        colX += cols[2].width;
        doc.text(String(r.masculino ?? '0'), colX + cols[3].width / 2, currentY + 2.8, { align: 'center' });
        colX += cols[3].width;
        doc.text(String(r.total ?? '0'), colX + cols[4].width / 2, currentY + 2.8, { align: 'center' });

        currentY += 4;
      });

      // Fila de total acumulado
      checkPageBreak(4.5);
      doc.setFillColor(235, 240, 248);
      doc.rect(marginLeft, currentY, contentWidth, 4.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 51, 102);
      doc.text('TOTAL GENERAL', marginLeft + 2, currentY + 3.2);
      let totColX = marginLeft + cols[0].width + cols[1].width;
      doc.text(String(totalFem), totColX + cols[2].width / 2, currentY + 3.2, { align: 'center' });
      totColX += cols[2].width;
      doc.text(String(totalMasc), totColX + cols[3].width / 2, currentY + 3.2, { align: 'center' });
      totColX += cols[3].width;
      doc.text(String(totalGral), totColX + cols[4].width / 2, currentY + 3.2, { align: 'center' });
      currentY += 6;
    }

    // 6.4 Servicios Prestados
    if (fichaData.servicios) {
      drawSectionHeader('Servicios Prestados (ficha_servicios)');
      const s = fichaData.servicios;
      const sItems = [
        { label: 'Farmacia', value: s.farmacia ? 'Sí' : 'No' },
        { label: 'Eval. Nutricional', value: s.evaluacion_nutricional ? 'Sí' : 'No' },
        { label: 'Act. Recreativas', value: s.actividades_recreativas ? 'Sí' : 'No' },
        { label: 'Serv. Emergencia', value: s.servicio_emergencia ? 'Sí' : 'No' },
        { label: 'Serv. Funerario', value: s.servicio_funerario ? 'Sí' : 'No' },
        { label: 'Barbería / Peluq.', value: s.barberia_peluqueria ? 'Sí' : 'No' },
        { label: 'Servicio Médico', value: s.medicos ? ('Sí' + (s.medicos_descripcion ? `: ${s.medicos_descripcion}` : '')) : 'No' },
        { label: 'Lavandería', value: s.lavanderia ? ('Sí' + (s.lavanderia_descripcion ? `: ${s.lavanderia_descripcion}` : '')) : 'No' },
      ];
      if (s.otros) {
        sItems.push({ label: 'Otros Servicios', value: s.otros_descripcion || 'Sí' });
      }
      // Servicios adicionales del catálogo
      if (serviciosExtras.value?.length) {
        serviciosExtras.value.forEach(se => {
          sItems.push({ label: se.label, value: 'Sí' });
        });
      }
      drawKeyValueGrid(sItems, 2);
    }

    // 6.5 Personal / Talento Humano
    if (fichaData.personal) {
      drawSectionHeader('Personal y Talento Humano (ficha_personal)');
      const p = fichaData.personal;
      const pItems = [
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
        { label: 'Expediente Curricular', value: p.posee_expediente_curricular ? 'Sí' : 'No' },
        { label: 'Otros Personal', value: p.otros_personal ? (p.descripcion_otros_personal || 'Sí') : 'No' },
      ];
      drawKeyValueGrid(pItems, 2);
      if (p.descripcion_no_adscrito) {
        drawFullRow('Detalle Personal No Adscrito', p.descripcion_no_adscrito);
      }
    }

    // 6.6 Infraestructura
    if (fichaData.infraestructura) {
      drawSectionHeader('Infraestructura del Inmueble (ficha_infraestructura)');
      const inf = fichaData.infraestructura;
      const infItems = [
        { label: 'Estado Inmueble', value: inf.estado_inmueble_nombre || '—' },
        { label: 'Tipo de Planta', value: inf.planta_electrica_tipo_nombre || inf.tipo_planta_nombre || '—' },
        { label: 'Área Total (m²)', value: inf.area_total_m2 ?? '—' },
        { label: 'Área Constr. (m²)', value: inf.area_construida_m2 ?? '—' },
        { label: 'Tamaño Habitac. (m²)', value: inf.tamano_habitaciones_m2 ?? '—' },
        { label: 'Personas / Habit.', value: inf.personas_por_habitacion ?? '—' },
        { label: 'Camas / Habit.', value: inf.camas_por_habitacion ?? '—' },
        { label: 'Baños / Habit.', value: inf.banos_por_habitacion ?? '—' },
        { label: 'Nro. Dormitorios', value: inf.num_dormitorios ?? '—' },
        { label: 'Dormit. Adecuados', value: inf.dormitorios_adecuados ? 'Sí' : 'No' },
        { label: 'Nro. Sanitarios', value: inf.num_sanitarios ?? '—' },
        { label: 'Sanitar. Adecuados', value: inf.sanitarios_adecuados ? 'Sí' : 'No' },
        { label: 'Baños Completos', value: inf.banos_completos ?? '—' },
        { label: 'Baños sin Ducha', value: inf.banos_sin_ducha ?? '—' },
        { label: 'Cantidad Tinas', value: inf.cant_tinas ?? '—' },
        { label: 'Área de Cocina', value: inf.tiene_area_cocina ? 'Sí' : 'No' },
        { label: 'Cocina Adecuada', value: inf.cocina_adecuada ? 'Sí' : 'No' },
        { label: 'Comedor', value: inf.tiene_comedor ? 'Sí' : 'No' },
        { label: 'Capacidad Comedor', value: inf.capacidad_comedor_pct != null ? `${inf.capacidad_comedor_pct}%` : '—' },
        { label: 'Atención Médica', value: inf.areas_atencion_medica ? 'Sí' : 'No' },
        { label: 'Áreas Verdes', value: inf.areas_verdes ? 'Sí' : 'No' },
        { label: 'Farmacia / Depósito', value: inf.tiene_farmacia_almacen_clinico ? 'Sí' : 'No' },
        { label: 'Aceptan Mascotas', value: inf.acepta_mascotas ? 'Sí' : 'No' },
        { label: 'Gerogranjas', value: inf.gerogranjas ? 'Sí' : 'No' },
        { label: 'Residuos Separados', value: inf.residuos_separados ? 'Sí' : 'No' },
        { label: 'Luz Eléctrica', value: inf.luz_electrica ? 'Sí' : 'No' },
        { label: 'Agua Potable', value: inf.agua_potable ? 'Sí' : 'No' },
        { label: 'Aguas Servidas', value: inf.agua_servidas ? 'Sí' : 'No' },
        { label: 'Depósito Basura', value: inf.deposito_basura ? 'Sí' : 'No' },
        { label: 'Tanque de Agua', value: inf.tanque_agua ? (`Sí${inf.capacidad_tanque ? ` (${inf.capacidad_tanque}L)` : ''}`) : 'No' },
        { label: 'Bomba de Agua', value: inf.bomba_agua ? 'Sí' : 'No' },
        { label: 'Sistema Seguridad', value: inf.sistema_seguridad ? 'Sí' : 'No' },
        { label: 'Cámaras Seguridad', value: inf.tiene_camaras ? 'Sí' : 'No' },
        { label: 'Control Acceso/Sal.', value: `Acceso: ${inf.control_acceso ? 'Sí' : 'No'} | Salida: ${inf.control_salida ? 'Sí' : 'No'}` },
        { label: 'Alarma Emergencia', value: inf.alarma_emergencia ? 'Sí' : 'No' },
        { label: 'Botones Emergencia', value: `Habit: ${inf.boton_emergencia_habitaciones ? 'Sí' : 'No'} | Baño: ${inf.boton_emergencia_banio ? 'Sí' : 'No'} | Pasillo: ${inf.boton_emergencia_pasillos ? 'Sí' : 'No'}` },
        { label: 'Iluminac. Emergencia', value: inf.iluminacion_emergencia ? 'Sí' : 'No' },
        { label: 'Iluminación Adecuada', value: inf.iluminacion_adecuada ? 'Sí' : 'No' },
        { label: 'Ventilación Adecuada', value: inf.ventilacion_adecuada ? 'Sí' : 'No' },
        { label: 'Sistemas Ventilación', value: inf.sistemas_ventilacion ? 'Sí' : 'No' },
        { label: 'Aire Acondicionado', value: inf.aire_acondicionado ? 'Sí' : 'No' },
        { label: 'Prevención Incendios', value: inf.prevencion_incendios ? 'Sí' : 'No' },
        { label: 'Señalización Clara', value: inf.senalizacion_clara ? 'Sí' : 'No' },
        { label: 'Normativa Visible', value: inf.normativa_visible ? 'Sí' : 'No' },
        { label: 'Planta Eléctrica', value: inf.planta_electrica ? 'Sí' : 'No' },
        { label: 'Panel Solar', value: inf.planta_electrica_panel_solar ? 'Sí' : 'No' },
      ];
      drawKeyValueGrid(infItems, 2);
      if (inf.descripcion_otros) {
        drawFullRow('Observaciones Infraestructura', inf.descripcion_otros);
      }
    }

    // 6.7 Accesibilidad
    if (fichaData.accesibilidad) {
      drawSectionHeader('Accesibilidad y Barreras Arquitectónicas (ficha_accesibilidad)');
      const acc = fichaData.accesibilidad;
      const accItems = [
        { label: 'Rampas de Acceso', value: acc.rampas_fijas ? 'Sí' : 'No' },
        { label: 'Marquesinas Acceso', value: acc.marquesinas_acceso ? 'Sí' : 'No' },
        { label: 'Estacionam. Reservados', value: acc.estacionamientos_reservados ? 'Sí' : 'No' },
        { label: 'Pasamanos', value: acc.pasamanos ? 'Sí' : 'No' },
        { label: 'Pasamanos Dobles', value: acc.pasamanos_dobles ? 'Sí' : 'No' },
        { label: 'Piso Antideslizante', value: acc.piso_antirresbalante ? 'Sí' : 'No' },
        { label: 'Pasillos Accesibles', value: acc.pasillos_accesibles_sillas ? 'Sí' : 'No' },
        { label: 'Zonas de Descanso', value: acc.zonas_descanso ? 'Sí' : 'No' },
        { label: 'Escaleras Antirresb.', value: acc.escaleras_antirresbalantes ? 'Sí' : 'No' },
        { label: 'Ascensores', value: acc.ascensores ? (`Sí (${acc.num_ascensores || 1})`) : 'No' },
        { label: 'Alfombras Sueltas', value: acc.alfombras_sueltas ? 'Sí' : 'No' },
        { label: 'Alfombras Aseguradas', value: acc.alfombras_aseguradas ? 'Sí' : 'No' },
        { label: 'Pisos Podotáctiles', value: acc.pisos_podotactiles ? 'Sí' : 'No' },
        { label: 'Baños Geriátricos', value: acc.banos_geriatricos ? 'Sí' : 'No' },
        { label: 'Barras de Apoyo', value: acc.barras_apoyo ? 'Sí' : 'No' },
        { label: 'Inodoros Elevados', value: acc.inodoros_elevados ? 'Sí' : 'No' },
        { label: 'Duchas a Ras de Suelo', value: acc.duchas_ras_suelo ? 'Sí' : 'No' },
        { label: 'Lavamanos Suspendidos', value: acc.lavamanos_suspendidos ? 'Sí' : 'No' },
        { label: 'Grifería de Palanca', value: acc.griferia_palanca ? 'Sí' : 'No' },
        { label: 'Botón Emergenc. Baño', value: acc.boton_emergencia ? 'Sí' : 'No' },
        { label: 'Sillas con Apoyabrazos', value: acc.sillas_apoyabrazos ? 'Sí' : 'No' },
        { label: 'Mesas sin Obstáculos', value: acc.mesas_sin_obstaculos ? 'Sí' : 'No' },
        { label: 'Alto Contraste Visual', value: acc.alto_contraste_visual ? 'Sí' : 'No' },
        { label: 'Pictogramas Univ.', value: acc.pictogramas_universales ? 'Sí' : 'No' },
        { label: 'Iluminación Homogénea', value: acc.iluminacion_homogenea ? 'Sí' : 'No' },
        { label: 'Señales Accesibles', value: acc.senales_accesibles ? 'Sí' : 'No' },
        { label: 'Alarmas Duales', value: acc.alarmas_duales ? 'Sí' : 'No' },
        { label: 'Rutas Evacuac. Anchas', value: acc.rutas_evacuacion_anchas ? 'Sí' : 'No' },
        { label: 'Timbres Emergencia', value: acc.timbres_emergencia ? 'Sí' : 'No' },
      ];
      drawKeyValueGrid(accItems, 2);
    }

    // 6.8 Documentación Consignada
    const docs = fichaData.documentos || [];
    if (docs.length || centroData?.rif_archivo) {
      drawSectionHeader('Documentación Consignada (ficha_documentos)');
      const docItems = [];
      if (centroData?.rif_archivo) {
        docItems.push({ label: 'RIF (Cargado en registro)', value: 'Archivo Digital' });
      }
      docs.forEach(d => {
        const estatus = [
          d.tiene_original ? 'Original' : null,
          d.tiene_copia ? 'Copia' : null,
          d.tiene_archivo || d.archivo_nombre ? 'Digital' : null,
        ].filter(Boolean).join(' / ') || 'Registrado';
        const desc = d.descripcion ? ` - ${d.descripcion}` : '';
        docItems.push({ label: labelTipoDoc(d.tipo_documento), value: `${estatus}${desc}` });
      });
      drawKeyValueGrid(docItems, 2);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // APLICAR ENCABEZADO Y PIE A TODAS LAS PÁGINAS GENERADAS
  // ══════════════════════════════════════════════════════════════════════════
  const totalPagesActual = doc.getNumberOfPages();
  const fechaHoraTexto = `${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;

  for (let i = 1; i <= totalPagesActual; i++) {
    doc.setPage(i);
    dibujarEncabezado(i, totalPagesActual);
    dibujarPiePagina(i, totalPagesActual, fechaHoraTexto);
  }

  // Guardar documento
  const filename = `RENACER_${centroData?.rif || 'centro'}_${Date.now()}.pdf`;
  doc.save(filename);
};

// ────────────────────────────────────────────────────────────────────────────
// Método expuesto al template / outside
// ──────────────────────────────────────────────────────────────────────────

// ── PDF Viewer y Gestión de Archivos ──
const pdfViewerOpen = ref(false);
const pdfViewerUrl = ref('');
const pdfViewerTitle = ref('');
const currentPdfBlob = ref(null);
const currentPdfFilename = ref('');

function labelTipoDoc(tipo) {
    if (!tipo) return '—';
    const found = catalogosStore.opcionesDocumentos.find(d => d.tipo_documento === tipo);
    if (found && found.tipo_documento_label) return found.tipo_documento_label;
    return tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Solo documentos cuyo tipo esté activo en el catálogo (los inactivos no se muestran)
// Comparación insensible a mayúsculas: los códigos del catálogo pueden haber cambiado
// de capitalización respecto a lo guardado (ej: 'BOMBEROS' vs 'bomberos')
const documentosActivos = computed(() => {
    const docs = ficha.value?.documentos;
    if (!docs?.length) return [];
    const activos = new Set(catalogosStore.opcionesDocumentos.map(d => String(d.tipo_documento || '').trim().toLowerCase()));
    return docs.filter(d => activos.has(String(d.tipo_documento || '').trim().toLowerCase()));
});

const esRifRow = (d) => String(d.tipo_documento || '').trim().toLowerCase() === 'rif';

// Documentos a mostrar: si el RIF está precargado (centros.rif_archivo), la fila RIF de
// ficha_documentos (sin archivo) se sustituye por una fila sintética con ver/descargar
const documentosVisibles = computed(() => {
    const docs = documentosActivos.value;
    if (!centro.value?.rif_archivo) return docs;
    return [
        { id: '__rif_precargado__', tipo_documento: 'rif', es_rif_precargado: true, tiene_archivo: true },
        ...docs.filter(d => !esRifRow(d)),
    ];
});

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(1) + ' MB';
}

async function verDocumentoPdf(d) {
    if (!ficha.value?.id) return;
    // Abrir ventana de inmediato para evitar que el navegador bloquee el popup
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.title = d.archivo_nombre || labelTipoDoc(d.tipo_documento);
        newWindow.document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#555;">
                <p>Cargando documento PDF...</p>
            </div>
        `;
    }
    try {
        const identifier = d.id || d.tipo_documento;
        const res = await fichasService.getDocumentoArchivo(ficha.value.id, identifier);
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (newWindow) {
            newWindow.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    } catch (err) {
        if (newWindow) newWindow.close();
        console.error(err);
        Notify.create({
            type: 'negative',
            message: 'Error al abrir el documento PDF.'
        });
    }
}

async function descargarDocumentoPdf(d) {
    if (!ficha.value?.id) return;
    try {
        const identifier = d.id || d.tipo_documento;
        const res = await fichasService.getDocumentoArchivo(ficha.value.id, identifier, true);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.archivo_nombre || `${d.tipo_documento}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error(err);
        $q.notify({
            type: 'negative',
            message: 'Error al descargar el documento PDF.'
        });
    }
}

// ── RIF precargado (centros.rif_archivo) ──
async function verRifPrecargado() {
    // Abrir ventana de inmediato para evitar que el navegador bloquee el popup
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.title = 'RIF';
        newWindow.document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#555;">
                <p>Cargando documento...</p>
            </div>
        `;
    }
    try {
        const res = await centrosService.getRifArchivo(centroId.value);
        const url = URL.createObjectURL(res.data);
        if (newWindow) {
            newWindow.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    } catch (err) {
        if (newWindow) newWindow.close();
        console.error(err);
        Notify.create({ type: 'negative', message: 'Error al abrir el RIF.' });
    }
}

async function descargarRifPrecargado() {
    try {
        const res = await centrosService.getRifArchivo(centroId.value, true);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        // Nombre desde Content-Disposition; el backend lo define como RIF.<ext>
        const cd = res.headers?.['content-disposition'] || '';
        const m = cd.match(/filename="?([^";]+)"?/);
        a.download = m ? decodeURIComponent(m[1]) : 'RIF.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error(err);
        $q.notify({ type: 'negative', message: 'Error al descargar el RIF.' });
    }
}

function openPdfInNewTab() {
    if (pdfViewerUrl.value) {
        window.open(pdfViewerUrl.value, '_blank');
    }
}

function downloadCurrentPdf() {
    if (currentPdfBlob.value) {
        const url = URL.createObjectURL(currentPdfBlob.value);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentPdfFilename.value || 'documento.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

// Servicios con al menos uno activo
const tieneServicios = computed(() => {
    const s = ficha.value?.servicios;
    if (!s) return false;
    const fijos = ['farmacia', 'evaluacion_nutricional', 'actividades_recreativas',
        'servicio_emergencia', 'servicio_funerario', 'medicos',
        'lavanderia', 'barberia_peluqueria', 'otros'].some(k => s[k]);
    return fijos || serviciosExtras.value.length > 0;
});

// Servicios adicionales del catálogo guardados en ficha_servicios.extras (jsonb,
// { codigo: boolean }). Se rotulan con el nombre del catálogo; si el código ya no
// existe en el catálogo, se muestra el código "humanizado" en title case.
const serviciosExtras = computed(() => {
    const extras = ficha.value?.servicios?.extras;
    if (!extras || typeof extras !== 'object') return [];
    const cat = catalogosStore.serviciosCatalogo || [];
    return Object.entries(extras)
        .filter(([, v]) => v)
        .map(([codigo]) => {
            const found = cat.find(c => String(c.codigo) === String(codigo));
            const label = toTitleCase(found?.nombre
                || String(codigo).replace(/_/g, ' '));
            return { codigo, label };
        });
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
// El rol "Usuario" se maneja por ID (roles.id = 2), no por nombre
const isUsuario = Number(LocalStorage.getItem('roleId')) === 2;
function hasPerm(p) { return adminUser || permisos.some(x => x.name === p); }

const canEdit = computed(() => {
    if (adminUser) return true;
    if (!centro.value) return false;
    return ['write', 'admin'].includes(centro.value.access_level);
});

const canDelete = computed(() => {
    if (isUsuario) return false;
    if (adminUser) return true;
    if (!centro.value) return false;
    return centro.value.access_level === 'admin';
});

const canManageAccess = computed(() => {
    if (adminUser) return true;
    if (!centro.value) return false;
    // Solo si el nivel es admin (delegado o propietario)
    return centro.value.access_level === 'admin';
});



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

const showAddDialog = ref(false);
const selectedUser = ref(null);
const selectedAccessLevel = ref('read');
const accessLevelOptions = [
    { label: 'Lectura (Usuario)', value: 'read' },
    { label: 'Escritura (Operador)', value: 'write' },
    { label: 'Administrador (Delegado)', value: 'admin' },
];

const userOptions = ref([]);
const $q = useQuasar();

const colsAcceso = [
    { name: 'name', label: 'Usuario', align: 'left', field: row => `${row.first_name} ${row.last_name}` },
    { name: 'email', label: 'Correo', align: 'left', field: 'email' },
    { name: 'access_level', label: 'Nivel', align: 'center', field: 'access_level' },
    { name: 'actions', label: 'Acciones', align: 'right' }
];

async function filterUsers(val, update) {
    if (val.length < 2) {
        update(() => { userOptions.value = [] });
        return;
    }
    const users = await centrosStore.searchUsers(val);
    update(() => {
        userOptions.value = users.map(u => ({
            label: `${u.first_name} ${u.last_name} (${u.email})`,
            value: u.id
        }));
    });
}

async function handleGrantAccess() {
    if (!selectedUser.value) return;
    const rawLvl = selectedAccessLevel.value;
    const lvlVal = typeof rawLvl === 'object' && rawLvl !== null ? rawLvl.value : rawLvl;
    const ok = await centrosStore.grantAccess(centroId.value, selectedUser.value.value, lvlVal || 'read');
    if (ok) {
        showAddDialog.value = false;
        selectedUser.value = null;
        selectedAccessLevel.value = 'read';
    }
}

function confirmRevoke(user) {
    $q.dialog({
        title: 'Revocar Acceso',
        message: `¿Estás seguro de revocar el acceso a ${user.first_name} ${user.last_name}?`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        await centrosStore.revokeAccess(centroId.value, user.id);
    });
}

function confirmarEliminar() {
    $q.dialog({
        title: 'Eliminar Centro',
        message: `¿Estás seguro de eliminar el centro "${centro.value?.nombre_establecimiento}"? Esto es un borrado lógico.`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        await centrosStore.deleteCentro(centroId.value);
        $router.push('/admin/centros');
    });
}


function labelAccess(lvl) {
    return {
        read: 'Lectura', lectura: 'Lectura', user: 'Lectura (Usuario)', usuario: 'Lectura (Usuario)',
        write: 'Escritura', escritura: 'Escritura', operador: 'Escritura',
        admin: 'Administrador', administrador: 'Administrador'
    }[lvl] || lvl;
}

watch(tab, (newTab) => {
    if (newTab === 'acceso') {
        centrosStore.fetchCentroUsers(centroId.value);
    }
});

onMounted(async () => {
    catalogosStore.fetchAll(true);
    await centrosStore.fetchCentro(centroId.value);
    await centrosStore.fetchFichaActual(centroId.value);
    if (tab.value === 'acceso') {
        centrosStore.fetchCentroUsers(centroId.value);
    }
});

</script>

<style scoped>
.foto-container {
    width: 100%;
    min-height: 220px;
    max-height: 400px;
    overflow: hidden;
    border-radius: 8px;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
}

.foto-centro {
    width: 100%;
    min-height: 220px;
    max-height: 400px;
    object-fit: contain;
    border-radius: 8px;
    display: block;
}
</style>
