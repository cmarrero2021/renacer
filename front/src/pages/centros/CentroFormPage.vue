<template>
    <q-page padding>
        <!-- ───── Encabezado ───────────────────────────────────────────────── -->
        <div class="row items-center q-mb-md">
            <q-btn flat round icon="arrow_back" @click="$router.back()" />
            <div class="col q-ml-sm">
                <div class="text-h5">
                    {{ isEdit ? 'Editar Ficha del Centro' : 'Registrar Centro de Atención' }}
                </div>
                <div class="text-caption text-grey" v-if="centroId">
                    ID Centro: {{ centroId }}
                    <span v-if="fichaId"> · Ficha: {{ fichaId }}</span>
                </div>
            </div>
        </div>

        <!-- ───── Barra de progreso global ────────────────────────────────── -->
        <q-card flat bordered class="q-mb-md bg-grey-1">
            <q-card-section class="q-py-sm">
                <div class="row items-center justify-between q-mb-xs">
                    <span class="text-subtitle2 text-weight-bold">
                        <q-icon name="assignment_turned_in" class="q-mr-xs text-primary" />
                        Progreso General
                    </span>
                    <span class="text-caption text-grey">
                        {{ savedCount }}/{{ steps.length }} secciones completadas
                    </span>
                </div>
                <q-linear-progress :value="savedCount / steps.length" color="primary" size="10px" rounded
                    class="q-mb-sm" />
                <div class="row q-gutter-xs">
                    <q-chip v-for="s in steps" :key="s.name" dense size="sm"
                        :color="savedTabs[s.name] ? 'positive' : (activeTab === s.name ? 'primary' : 'grey-4')"
                        :text-color="savedTabs[s.name] || activeTab === s.name ? 'white' : 'grey-7'" clickable
                        @click="goToTab(s.name)">
                        <q-avatar :color="savedTabs[s.name] ? 'positive' : (activeTab === s.name ? 'blue-7' : 'grey-5')"
                            text-color="white" size="xs">
                            <q-icon :name="savedTabs[s.name] ? 'check' : s.icon" size="xs" />
                        </q-avatar>
                        {{ s.label }}
                    </q-chip>
                </div>
            </q-card-section>
        </q-card>

        <!-- ───── Tabs ─────────────────────────────────────────────────────── -->
        <q-card>
            <q-tabs v-model="activeTab" align="left" dense active-color="primary" indicator-color="primary"
                class="bg-grey-2">
                <q-tab v-for="s in steps" :key="s.name" :name="s.name" :icon="s.icon" :label="s.label"
                    :disable="!s.alwaysEnabled && !tabEnabled(s.name)">
                    <q-badge v-if="savedTabs[s.name]" color="positive" floating rounded style="top:4px;right:4px"
                        icon="check" />
                </q-tab>
            </q-tabs>
            <q-separator />

            <q-tab-panels v-model="activeTab" animated keep-alive>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 1 ▸ DATOS DEL CENTRO                                     -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="datos">
                    <inner-progress :value="tabProgress('datos')" :count="tabFieldCount('datos')" />

                    <q-form ref="formDatosRef" @submit.prevent="saveDatos">
                        <!-- Datos de la solicitud -->
                        <section-header icon="event_note" label="Datos de la Solicitud" />
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-4">
                                <q-input v-model="datos.fecha_solicitud" label="Fecha de Solicitud *" outlined dense
                                    readonly :rules="[v => !!v || 'Requerido']">
                                    <template #prepend>
                                        <q-icon name="event" class="cursor-pointer">
                                            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                                <q-date v-model="datos.fecha_solicitud" mask="DD/MM/YYYY" minimal
                                                    today-btn>
                                                    <div class="row items-center justify-end">
                                                        <q-btn v-close-popup label="Cerrar" color="primary" flat />
                                                    </div>
                                                </q-date>
                                            </q-popup-proxy>
                                        </q-icon>
                                    </template>
                                </q-input>
                            </div>
                            <div class="col-12 col-md-4">
                                <q-input v-model="datos.nro_registro_nacional" label="Nro. de Registro Nacional"
                                    outlined dense />
                            </div>
                            <div class="col-12 col-md-4">
                                <div class="text-caption text-weight-bold q-mb-xs">Tipo de Solicitud *</div>
                                <div class="row q-gutter-sm">
                                    <q-radio v-model="datos.tipo_solicitud" val="registro_autorizacion"
                                        label="Registro / Autorización" dense />
                                    <q-radio v-model="datos.tipo_solicitud" val="renovacion_autorizacion"
                                        label="Renovación" dense />
                                </div>
                            </div>
                        </div>

                        <!-- Identificación del centro -->
                        <section-header icon="business" label="Identificación del Establecimiento" />
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-8">
                                <q-input v-model="datos.nombre_establecimiento" label="a) Nombre del Establecimiento *"
                                    outlined dense :rules="[v => !!v || 'Requerido']" />
                            </div>
                            <!-- RIF con selector de tipo -->
                            <div class="col-12 col-md-4">
                                <div class="text-caption text-weight-bold q-mb-xs">RIF</div>
                                <div class="row no-wrap items-start q-gutter-xs">
                                    <q-select v-model="datos.rif_tipo" :options="opcionesRifTipo" option-value="value"
                                        option-label="label" emit-value map-options outlined dense
                                        style="width:150px" />
                                    <q-input v-model="datos.rif_numero" placeholder="00000000-0" outlined dense
                                        class="col" mask="########-#" unmasked-value />
                                </div>
                            </div>
                            <div class="col-12 col-md-4">
                                <q-input v-model="datos.nro_registro_mercantil" label="Nro. Registro Mercantil" outlined
                                    dense />
                            </div>
                            <div class="col-12 col-md-4">
                                <q-input v-model="datos.fecha_fundacion" label="Fecha de Fundación" outlined dense
                                    readonly>
                                    <template #prepend>
                                        <q-icon name="event" class="cursor-pointer">
                                            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                                <q-date v-model="datos.fecha_fundacion" mask="DD/MM/YYYY" minimal
                                                    today-btn>
                                                    <div class="row items-center justify-end">
                                                        <q-btn v-close-popup label="Cerrar" color="primary" flat />
                                                    </div>
                                                </q-date>
                                            </q-popup-proxy>
                                        </q-icon>
                                    </template>
                                </q-input>
                            </div>
                            <div class="col-12 col-md-4">
                                <q-input v-model="datos.costo_mensual" label="Costo Mensual (Bs.)" outlined dense
                                    type="number" min="0" />
                            </div>
                            <div class="col-12 col-md-6">
                                <q-select v-model="datos.tipo_establecimiento" :options="opcionesTipoEstab"
                                    option-value="value" option-label="label" emit-value map-options
                                    label="j) Tipo de Establecimiento *" outlined dense
                                    :rules="[v => !!v || 'Requerido']" />
                            </div>
                            <div class="col-12 col-md-6" v-if="datos.tipo_establecimiento === 'otra'">
                                <q-input v-model="datos.tipo_establecimiento_descripcion" label="Explique el tipo"
                                    outlined dense />
                            </div>
                            <div class="col-12 col-md-6">
                                <q-select v-model="datos.tipo_clasificacion" :options="opcionesTipoClasif"
                                    option-value="value" option-label="label" emit-value map-options
                                    label="k) Tipo de Clasificación *" outlined dense
                                    :rules="[v => !!v || 'Requerido']" />
                            </div>
                        </div>

                        <!-- Ubicación -->
                        <section-header icon="location_on" label="Ubicación Geográfica" />
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-4">
                                <q-select v-model="estadoSel" :options="centrosStore.estados" option-value="id"
                                    option-label="nombre" emit-value map-options label="e) Estado *" outlined dense
                                    :rules="[v => !!v || 'Requerido']" @update:model-value="onEstadoCambio" />
                            </div>
                            <div class="col-12 col-md-4">
                                <q-select v-model="municipioSel" :options="centrosStore.municipios" option-value="id"
                                    option-label="nombre" emit-value map-options label="d) Municipio *" outlined dense
                                    :disable="!estadoSel" :rules="[v => !!v || 'Requerido']"
                                    @update:model-value="onMunicipioCambio" />
                            </div>
                            <div class="col-12 col-md-4">
                                <q-select v-model="datos.parroquia_id" :options="centrosStore.parroquias"
                                    option-value="id" option-label="nombre" emit-value map-options
                                    label="c) Parroquia *" outlined dense :disable="!municipioSel"
                                    :rules="[v => !!v || 'Requerido']" />
                            </div>
                            <div class="col-12">
                                <q-input v-model="datos.direccion" label="b) Dirección completa (Av, Calle, Urb, N°) *"
                                    outlined dense :rules="[v => !!v || 'Requerido']" />
                            </div>

                            <!-- Botones de geolocalización -->
                            <div class="col-12">
                                <div class="row q-gutter-sm items-center q-mb-xs">
                                    <q-btn unelevated color="primary" icon="my_location" size="sm"
                                        label="Usar mi ubicación actual" :loading="geoLoading"
                                        @click="obtenerUbicacionActual" />
                                    <q-btn outline color="secondary" icon="search" size="sm"
                                        label="Geocodificar dirección" :loading="geocodeLoading"
                                        :disable="!datos.direccion" @click="geocodificarDireccion" />
                                    <q-chip v-if="datos.latitud && datos.longitud" dense color="positive"
                                        text-color="white" icon="check_circle">
                                        Coordenadas cargadas
                                    </q-chip>
                                </div>
                                <div class="text-caption text-grey-6">
                                    <q-icon name="info" size="xs" />
                                    "Ubicación actual" usa el GPS/WiFi del dispositivo · "Geocodificar" convierte la
                                    dirección en coordenadas
                                    (OpenStreetMap, sin costo)
                                </div>
                            </div>

                            <div class="col-12 col-md-4">
                                <q-input v-model.number="datos.latitud" label="Latitud (decimal) *" outlined dense
                                    type="number" step="0.0000001" hint="Ej: 10.4880000" :rules="[
                                        v => v !== null && v !== '' && v !== undefined || 'Requerido',
                                        v => (v >= -90 && v <= 90) || 'Debe estar entre -90 y 90'
                                    ]">
                                    <template #prepend>
                                        <q-icon name="my_location" color="primary" />
                                    </template>
                                </q-input>
                            </div>
                            <div class="col-12 col-md-4">
                                <q-input v-model.number="datos.longitud" label="Longitud (decimal) *" outlined dense
                                    type="number" step="0.0000001" hint="Ej: -66.9030000" :rules="[
                                        v => v !== null && v !== '' && v !== undefined || 'Requerido',
                                        v => (v >= -180 && v <= 180) || 'Debe estar entre -180 y 180'
                                    ]">
                                    <template #prepend>
                                        <q-icon name="explore" color="primary" />
                                    </template>
                                </q-input>
                            </div>
                        </div>


                        <!-- Propietarios -->
                        <section-header icon="person" label="Propietario(s)">
                            <q-btn flat dense round icon="add_circle" @click="addProp" title="Agregar" />
                        </section-header>
                        <div v-for="(p, i) in datos.propietarios" :key="i"
                            class="row q-col-gutter-sm q-mb-sm items-center">
                            <div class="col-5">
                                <q-input v-model="p.nombre" :label="`Nombre y Apellido ${i + 1}`" outlined dense
                                    :rules="[v => !!v || 'Requerido']" />
                            </div>
                            <div class="col-2">
                                <q-select v-model="p.cedula_tipo" :options="['V', 'E', 'J', 'G']" outlined dense
                                    label="Tipo" />
                            </div>
                            <div class="col-3">
                                <q-input v-model="p.cedula_nro" label="Cédula / RIF" outlined dense />
                            </div>
                            <div class="col-auto">
                                <q-btn flat round dense icon="delete" color="negative"
                                    @click="datos.propietarios.splice(i, 1)" />
                            </div>
                        </div>
                        <q-btn v-if="datos.propietarios.length === 0" flat dense label="+ Agregar propietario"
                            @click="addProp" class="q-mb-md" />

                        <!-- Representantes -->
                        <section-header icon="badge" label="Representante(s) Legal(es)">
                            <q-btn flat dense round icon="add_circle" @click="addRep" title="Agregar" />
                        </section-header>
                        <div v-for="(r, i) in datos.representantes" :key="i"
                            class="row q-col-gutter-sm q-mb-sm items-center">
                            <div class="col-4">
                                <q-input v-model="r.nombre" :label="`Nombre ${i + 1}`" outlined dense
                                    :rules="[v => !!v || 'Requerido']" />
                            </div>
                            <div class="col-2">
                                <q-select v-model="r.cedula_tipo" :options="['V', 'E']" outlined dense label="Tipo" />
                            </div>
                            <div class="col-2">
                                <q-input v-model="r.cedula_nro" label="Cédula" outlined dense />
                            </div>
                            <div class="col-3">
                                <q-input v-model="r.cargo" label="Cargo" outlined dense />
                            </div>
                            <div class="col-auto">
                                <q-btn flat round dense icon="delete" color="negative"
                                    @click="datos.representantes.splice(i, 1)" />
                            </div>
                        </div>
                        <q-btn v-if="datos.representantes.length === 0" flat dense label="+ Agregar representante"
                            @click="addRep" class="q-mb-md" />

                        <!-- Teléfonos y correos -->
                        <section-header icon="contact_phone" label="Contacto" />
                        <div class="row q-col-gutter-md q-mb-md">
                            <div class="col-12 col-md-6">
                                <div class="text-caption text-weight-bold q-mb-xs">
                                    Teléfonos <q-btn flat dense icon="add" size="sm" @click="addTel" />
                                </div>
                                <div v-for="(t, i) in datos.telefonos" :key="i"
                                    class="row q-gutter-sm items-center q-mb-xs">
                                    <div class="col">
                                        <q-input v-model="t.telefono" outlined dense :label="`Teléfono ${i + 1}`"
                                            mask="(####) ###-####" />
                                    </div>
                                    <div class="col-auto">
                                        <q-select v-model="t.tipo" :options="['general', 'fijo', 'celular', 'fax']"
                                            outlined dense style="width:90px" />
                                    </div>
                                    <div class="col-auto">
                                        <q-btn flat round dense icon="close" size="sm"
                                            @click="datos.telefonos.splice(i, 1)" />
                                    </div>
                                </div>
                                <q-btn v-if="datos.telefonos.length === 0" flat dense label="+ Teléfono"
                                    @click="addTel" />
                            </div>
                            <div class="col-12 col-md-6">
                                <div class="text-caption text-weight-bold q-mb-xs">
                                    Correos <q-btn flat dense icon="add" size="sm" @click="addCorreo" />
                                </div>
                                <div v-for="(c, i) in datos.correos" :key="i"
                                    class="row q-gutter-sm items-center q-mb-xs">
                                    <div class="col">
                                        <q-input v-model="c.correo" outlined dense :label="`Correo ${i + 1}`"
                                            type="email" />
                                    </div>
                                    <div class="col-auto">
                                        <q-select v-model="c.tipo" :options="['general', 'institucional', 'personal']"
                                            outlined dense style="width:120px" />
                                    </div>
                                    <div class="col-auto">
                                        <q-btn flat round dense icon="close" size="sm"
                                            @click="datos.correos.splice(i, 1)" />
                                    </div>
                                </div>
                                <q-btn v-if="datos.correos.length === 0" flat dense label="+ Correo"
                                    @click="addCorreo" />
                            </div>
                        </div>

                        <!-- Aviso/botón guardar -->
                        <q-banner v-if="!savedTabs.datos" rounded inline-actions
                            class="bg-amber-1 text-amber-9 q-mt-md">
                            <template #avatar>
                                <q-icon name="info" color="amber-9" />
                            </template>
                            Complete y <strong>guarde esta sección</strong> para habilitar las demás.
                            <template #action>
                                <q-btn unelevated color="primary" icon="save" label="Guardar Datos del Centro"
                                    type="button" :loading="saving" @click.prevent="saveDatos" />
                            </template>
                        </q-banner>
                        <div v-else class="row justify-end q-mt-md q-gutter-sm">
                            <q-btn outline color="primary" icon="edit" label="Actualizar datos" type="button"
                                :loading="saving" @click.prevent="saveDatos" />
                            <q-btn unelevated color="positive" icon="arrow_forward" label="Siguiente sección"
                                type="button" @click.prevent="nextTab" />
                        </div>
                    </q-form>
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 2 ▸ CAPACIDAD                                            -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="capacidad">
                    <inner-progress :value="tabProgress('capacidad')" :count="tabFieldCount('capacidad')" />
                    <section-header icon="people" label="Capacidad Instalada y Uso" />
                    <div class="row q-col-gutter-md q-mb-lg">
                        <div class="col-12 col-md-3">
                            <q-input v-model.number="cap.capacidad_total_residente"
                                label="Capacidad total de residentes *" outlined dense type="number" min="0"
                                hint="Cupos totales disponibles" />
                        </div>
                        <div class="col-12 col-md-3">
                            <q-input v-model.number="cap.capacidad_actual_residente" label="Residentes actuales"
                                outlined dense type="number" min="0" />
                        </div>
                        <div class="col-12 col-md-3">
                            <div class="text-caption text-weight-bold q-mb-xs">Atención ambulatoria</div>
                            <q-toggle v-model="cap.atencion_ambulatoria" label="Presta este servicio" />
                        </div>
                        <div class="col-12 col-md-3" v-if="cap.atencion_ambulatoria">
                            <q-input v-model.number="cap.num_atencion_ambulatoria" label="Cupos ambulatorios" outlined
                                dense type="number" min="0" />
                        </div>
                    </div>
                    <tab-actions :loading="saving" label="Guardar Capacidad" @save="saveCapacidad" @next="nextTab"
                        :can-next="true" />
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 3 ▸ POBLACIÓN                                            -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="poblacion">
                    <inner-progress :value="tabProgress('poblacion')" :count="tabFieldCount('poblacion')" />
                    <section-header icon="bar_chart" label="Registro de Población" />

                    <div class="row q-col-gutter-md q-mb-md">
                        <div class="col-12 col-md-4">
                            <q-input v-model="pob.fecha_corte" label="Fecha de corte *" outlined dense readonly>
                                <template #prepend>
                                    <q-icon name="event" class="cursor-pointer">
                                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                                            <q-date v-model="pob.fecha_corte" mask="DD/MM/YYYY" minimal today-btn>
                                                <div class="row items-center justify-end">
                                                    <q-btn v-close-popup label="Cerrar" color="primary" flat />
                                                </div>
                                            </q-date>
                                        </q-popup-proxy>
                                    </q-icon>
                                </template>
                            </q-input>
                        </div>
                    </div>

                    <!-- Tabla de carga de población -->
                    <q-table :rows="pob.registros" :columns="colsPob" flat bordered dense
                        no-data-label="Agregue filas con el botón +" hide-bottom>
                        <template #top>
                            <span class="text-caption text-grey">Residentes y ambulatorios por categoría</span>
                            <q-space />
                            <q-btn flat dense icon="add" label="Agregar fila" @click="addPobRow" size="sm" />
                        </template>
                        <template #body="{ row, rowIndex }">
                            <tr>
                                <td>
                                    <q-select v-model="row.modalidad" :options="[
                                        { value: 'residente', label: 'Residente' },
                                        { value: 'ambulatoria', label: 'Ambulatoria' }
                                    ]" option-value="value" option-label="label" emit-value map-options outlined dense
                                        style="min-width:140px" />
                                </td>
                                <td>
                                    <q-select v-model="row.categoria" :options="[
                                        { value: 'adultos', label: 'Adultos' },
                                        { value: 'con_discapacidad', label: 'Con Discapacidad' },
                                        { value: 'otras_categorias', label: 'Otras categorías' }
                                    ]" option-value="value" option-label="label" emit-value map-options outlined dense
                                        style="min-width:180px" />
                                </td>
                                <td>
                                    <q-input v-model.number="row.femenino" outlined dense type="number" min="0"
                                        style="width:80px" />
                                </td>
                                <td>
                                    <q-input v-model.number="row.masculino" outlined dense type="number" min="0"
                                        style="width:80px" />
                                </td>
                                <td>{{ (row.femenino || 0) + (row.masculino || 0) }}</td>
                                <td>
                                    <q-btn flat round dense icon="delete" size="sm" color="negative"
                                        @click="pob.registros.splice(rowIndex, 1)" />
                                </td>
                            </tr>
                        </template>
                    </q-table>

                    <tab-actions :loading="saving" label="Guardar Población" @save="savePoblacion" @next="nextTab"
                        :can-next="true" />
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 4 ▸ INFRAESTRUCTURA                                      -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="infraestructura">
                    <inner-progress :value="tabProgress('infraestructura')" :count="tabFieldCount('infraestructura')" />
                    <section-header icon="home" label="Infraestructura del Inmueble" />

                    <div class="row q-col-gutter-md q-mb-md">
                        <div class="col-12 col-md-4">
                            <q-select v-model="infra.estado_inmueble" :options="[
                                { value: 'excelente', label: 'Excelente' },
                                { value: 'bueno', label: 'Bueno' },
                                { value: 'deficiente', label: 'Deficiente' }
                            ]" option-value="value" option-label="label" emit-value map-options outlined dense
                                label="Estado del inmueble" />
                        </div>
                        <div class="col-12 col-md-4">
                            <q-input v-model.number="infra.num_dormitorios" label="Nro. de dormitorios" outlined dense
                                type="number" min="0" />
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="text-caption q-mb-xs">Dormitorios adecuados</div>
                            <q-toggle v-model="infra.dormitorios_adecuados" label="Sí" />
                        </div>
                        <div class="col-12 col-md-4">
                            <q-input v-model.number="infra.num_sanitarios" label="Nro. de sanitarios" outlined dense
                                type="number" min="0" />
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="text-caption q-mb-xs">Sanitarios adecuados</div>
                            <q-toggle v-model="infra.sanitarios_adecuados" label="Sí" />
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="text-caption q-mb-xs">Área de cocina</div>
                            <q-toggle v-model="infra.tiene_area_cocina" label="Tiene" />
                        </div>
                        <div class="col-12 col-md-4" v-if="infra.tiene_area_cocina">
                            <div class="text-caption q-mb-xs">Cocina adecuada</div>
                            <q-toggle v-model="infra.cocina_adecuada" label="Sí" />
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="text-caption q-mb-xs">Ventilación adecuada</div>
                            <q-toggle v-model="infra.ventilacion_adecuada" label="Sí" />
                        </div>
                        <div class="col-12 col-md-4">
                            <div class="text-caption q-mb-xs">Iluminación adecuada</div>
                            <q-toggle v-model="infra.iluminacion_adecuada" label="Sí" />
                        </div>
                        <div class="col-12 col-md-4">
                            <q-input v-model.number="infra.capacidad_comedor_pct" label="% Capacidad comedor" outlined
                                dense type="number" min="0" max="100" suffix="%" />
                        </div>
                    </div>

                    <div class="text-subtitle2 q-mb-sm">Servicios Básicos</div>
                    <div class="row q-col-gutter-md q-mb-md">
                        <div class="col-6 col-md-3" v-for="s in serviciosBasicos" :key="s.field">
                            <div class="text-caption q-mb-xs">{{ s.label }}</div>
                            <q-toggle v-model="infra[s.field]" label="Disponible" />
                        </div>
                    </div>

                    <q-input v-model="infra.descripcion_otros" label="Observaciones adicionales" outlined dense
                        type="textarea" rows="2" class="q-mb-md" />

                    <tab-actions :loading="saving" label="Guardar Infraestructura" @save="saveInfraestructura"
                        @next="nextTab" :can-next="true" />
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 5 ▸ PERSONAL                                             -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="personal">
                    <inner-progress :value="tabProgress('personal')" :count="tabFieldCount('personal')" />
                    <section-header icon="group" label="Recurso Humano / Personal" />

                    <div class="row q-col-gutter-md q-mb-md">
                        <div v-for="f in camposPersonal" :key="f.field" class="col-12 col-md-4 col-sm-6">
                            <q-input v-model.number="pers[f.field]" :label="f.label" outlined dense type="number"
                                min="0" />
                        </div>
                    </div>

                    <div class="row q-col-gutter-md q-mb-md">
                        <div class="col-12 col-md-6">
                            <q-input v-model="pers.descripcion_no_adscrito" label="Descripción personal no adscrito"
                                outlined dense />
                        </div>
                        <div class="col-12 col-md-3">
                            <div class="text-caption q-mb-xs">Posee expediente curricular</div>
                            <q-toggle v-model="pers.posee_expediente_curricular" label="Sí" />
                        </div>
                        <div class="col-12 col-md-3">
                            <div class="text-caption q-mb-xs">Otros tipos de personal</div>
                            <q-toggle v-model="pers.otros_personal" label="Sí" />
                        </div>
                        <div class="col-12" v-if="pers.otros_personal">
                            <q-input v-model="pers.descripcion_otros_personal" label="Descripción otros personal"
                                outlined dense />
                        </div>
                    </div>

                    <tab-actions :loading="saving" label="Guardar Personal" @save="savePersonal" @next="nextTab"
                        :can-next="true" />
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 6 ▸ SERVICIOS                                            -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="servicios">
                    <inner-progress :value="tabProgress('servicios')" :count="tabFieldCount('servicios')" />
                    <section-header icon="medical_services" label="Servicios Prestados" />

                    <div class="row q-col-gutter-md q-mb-md">
                        <div v-for="s in listaServicios" :key="s.field" class="col-12 col-md-4 col-sm-6">
                            <q-card flat bordered class="q-pa-sm">
                                <div class="text-caption text-weight-bold q-mb-xs">{{ s.label }}</div>
                                <q-toggle v-model="serv[s.field]"
                                    :label="serv[s.field] ? 'Disponible' : 'No disponible'" />
                                <q-input v-if="s.desc && serv[s.field]" v-model="serv[s.desc]" label="Especifique"
                                    outlined dense class="q-mt-xs" />
                            </q-card>
                        </div>
                    </div>

                    <tab-actions :loading="saving" label="Guardar Servicios" @save="saveServicios" @next="nextTab"
                        :can-next="true" />
                </q-tab-panel>

                <!-- ══════════════════════════════════════════════════════════════ -->
                <!-- TAB 7 ▸ DOCUMENTOS                                           -->
                <!-- ══════════════════════════════════════════════════════════════ -->
                <q-tab-panel name="documentos">
                    <inner-progress :value="tabProgress('documentos')" :count="tabFieldCount('documentos')" />
                    <section-header icon="folder" label="Documentación Presentada" />

                    <q-table :rows="docs" :columns="colsDocs" flat bordered dense hide-bottom>
                        <template #body="{ row }">
                            <tr>
                                <td>{{ row.tipo_documento_label }}</td>
                                <td class="text-center">
                                    <q-toggle v-model="row.tiene_original" dense color="positive" />
                                </td>
                                <td class="text-center">
                                    <q-toggle v-model="row.tiene_copia" dense color="info" />
                                </td>
                                <td>
                                    <q-input v-model="row.descripcion" outlined dense placeholder="Nota" />
                                </td>
                            </tr>
                        </template>
                    </q-table>

                    <div class="row justify-end q-mt-md q-gutter-sm">
                        <q-btn unelevated color="positive" icon="check_circle" label="Guardar y Finalizar"
                            :loading="saving" @click="saveDocumentos" />
                    </div>
                </q-tab-panel>

            </q-tab-panels>
        </q-card>
    </q-page>
</template>

<script setup>
import { ref, computed, onMounted, defineComponent, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Notify } from 'quasar';
import { useCentrosStore } from 'src/stores/centros.store';
import { miCentroService, fichasService, geoService } from 'src/services/centros.service';

// ── Sub-componentes inline ────────────────────────────────────────────────────
const InnerProgress = defineComponent({
    props: ['value', 'count'],
    setup(props) {
        return () => h('div', { class: 'q-mb-md' }, [
            h('div', { class: 'row items-center justify-between text-caption text-grey q-mb-xs' }, [
                h('span', 'Campos diligenciados en esta sección'),
                h('span', `${props.count?.filled ?? 0} / ${props.count?.total ?? 0}`)
            ]),
            h('q-linear-progress', {
                value: props.value ?? 0, color: 'teal', size: '5px', rounded: true
            })
        ]);
    }
});

const SectionHeader = defineComponent({
    props: ['icon', 'label'],
    setup(props, { slots }) {
        return () => h('div', {
            class: 'row items-center q-mb-sm q-mt-md text-primary'
        }, [
            h('q-icon', { name: props.icon, class: 'q-mr-xs' }),
            h('span', { class: 'text-subtitle2 text-weight-bold' }, props.label),
            h('q-space'),
            ...(slots.default ? slots.default() : [])
        ]);
    }
});

const TabActions = defineComponent({
    props: ['loading', 'label', 'canNext'],
    emits: ['save', 'next'],
    setup(props, { emit }) {
        return () => h('div', { class: 'row justify-end q-mt-md q-gutter-sm' }, [
            h('q-btn', {
                unelevated: true, color: 'primary', icon: 'save',
                label: props.label, loading: props.loading,
                onClick: () => emit('save')
            }),
            props.canNext ? h('q-btn', {
                outline: true, color: 'primary', icon: 'arrow_forward',
                label: 'Siguiente', onClick: () => emit('next')
            }) : null
        ]);
    }
});

// ── Router / Store ────────────────────────────────────────────────────────────
const router = useRouter();
const route = useRoute();
const centrosStore = useCentrosStore();
const isEdit = computed(() => !!route.params.id);

// ── IDs persistentes ──────────────────────────────────────────────────────────
const centroId = ref(route.params.id || null);
const fichaId = ref(null);
const saving = ref(false);

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref('datos');
const steps = [
    { name: 'datos', label: '1. Datos del Centro', icon: 'business', alwaysEnabled: true },
    { name: 'capacidad', label: '2. Capacidad', icon: 'people' },
    { name: 'poblacion', label: '3. Población', icon: 'bar_chart' },
    { name: 'infraestructura', label: '4. Infraestructura', icon: 'home' },
    { name: 'personal', label: '5. Personal', icon: 'group' },
    { name: 'servicios', label: '6. Servicios', icon: 'medical_services' },
    { name: 'documentos', label: '7. Documentos', icon: 'folder' },
];

const savedTabs = ref({
    datos: false, capacidad: false, poblacion: false,
    infraestructura: false, personal: false, servicios: false, documentos: false
});
const savedCount = computed(() => Object.values(savedTabs.value).filter(Boolean).length);
function tabEnabled(name) { return savedTabs.value.datos; }
function goToTab(name) { if (tabEnabled(name) || name === 'datos') activeTab.value = name; }
function nextTab() {
    const idx = steps.findIndex(s => s.name === activeTab.value);
    if (idx < steps.length - 1) activeTab.value = steps[idx + 1].name;
}

// ── Opciones ──────────────────────────────────────────────────────────────────
const opcionesTipoEstab = [
    { value: 'publico', label: 'Público' },
    { value: 'afiliada_ivss', label: 'Afiliada IVSS' },
    { value: 'privado', label: 'Privado' },
    { value: 'religiosa', label: 'Religioso' },
    { value: 'otra', label: 'Otra' },
];
const opcionesTipoClasif = [
    { value: 'geriatrico', label: 'Geriátrico' },
    { value: 'gronto_psiquiatrico', label: 'Gronto-Psiquiátrico' },
    { value: 'casa_hogar', label: 'Casa Hogar' },
    { value: 'unidades_gerontologicas', label: 'Unidades Gerontológicas' },
    { value: 'fundacion', label: 'Fundación' },
    { value: 'otras', label: 'Otras' },
];
const opcionesRifTipo = [
    { value: 'J', label: 'J – Jurídico' },
    { value: 'G', label: 'G – Gobierno' },
    { value: 'C', label: 'C – Comuna' },
    { value: 'V', label: 'V – Venezolano' },
    { value: 'E', label: 'E – Extranjero' },
    { value: 'P', label: 'P – Pasaporte' },
];
const serviciosBasicos = [
    { field: 'luz_electrica', label: 'Luz eléctrica' },
    { field: 'agua_potable', label: 'Agua potable' },
    { field: 'agua_servidas', label: 'Aguas servidas' },
    { field: 'deposito_basura', label: 'Depósito de basura' },
    { field: 'sistema_seguridad', label: 'Sistema de seguridad' },
];
const camposPersonal = [
    { field: 'num_medicos_geriatra', label: 'Médicos Geriatras' },
    { field: 'num_medicos_psiquiatra', label: 'Médicos Psiquiatras' },
    { field: 'num_enfermeros', label: 'Enfermeros/as' },
    { field: 'num_cuidadores', label: 'Cuidadores' },
    { field: 'num_camareros', label: 'Camareros' },
    { field: 'num_auxiliares_enfermeria', label: 'Aux. Enfermería' },
    { field: 'num_servicios_generales', label: 'Serv. Generales' },
    { field: 'num_personal_cocina', label: 'Personal Cocina' },
    { field: 'num_personal_no_adscrito', label: 'Personal No Adscrito' },
];
const listaServicios = [
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
const DOCUMENTOS_LISTA = [
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

// ── Helpers de fecha dd/mm/aaaa ↔ yyyy-mm-dd ────────────────────────────────
function toDisplay(iso) {
    if (!iso) return '';
    if (iso.includes('/')) return iso;
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
}
function toISO(disp) {
    if (!disp || disp.length < 10) return null;
    const [d, m, y] = disp.split('/');
    if (!d || !m || !y || y.length < 4) return null;
    return `${y}-${m}-${d}`;
}

// ── Datos de cada tab ─────────────────────────────────────────────────────────
const estadoSel = ref(null);
const municipioSel = ref(null);

const datos = ref({
    nombre_establecimiento: '', rif_tipo: 'J', rif_numero: '', nro_registro_mercantil: '',
    fecha_solicitud: '', nro_registro_nacional: '', tipo_solicitud: null,
    fecha_fundacion: '', costo_mensual: null, direccion: '',
    parroquia_id: null, tipo_establecimiento: null,
    tipo_establecimiento_descripcion: '', tipo_clasificacion: null,
    latitud: null, longitud: null,
    propietarios: [], representantes: [], telefonos: [], correos: [],
});
const cap = ref({
    capacidad_total_residente: null, atencion_ambulatoria: false,
    capacidad_actual_residente: null, num_atencion_ambulatoria: null
});
const pob = ref({ fecha_corte: '', registros: [] });
const infra = ref({
    estado_inmueble: null, num_dormitorios: null, dormitorios_adecuados: null,
    num_sanitarios: null, sanitarios_adecuados: null, tiene_area_cocina: null,
    cocina_adecuada: null, ventilacion_adecuada: null, iluminacion_adecuada: null,
    capacidad_comedor_pct: null, luz_electrica: null, agua_potable: null,
    agua_servidas: null, deposito_basura: null, sistema_seguridad: null,
    descripcion_otros: ''
});
const pers = ref({
    num_medicos_geriatra: null, num_medicos_psiquiatra: null,
    num_enfermeros: null, num_cuidadores: null, num_camareros: null,
    num_auxiliares_enfermeria: null, num_servicios_generales: null,
    num_personal_cocina: null, num_personal_no_adscrito: null,
    descripcion_no_adscrito: '', posee_expediente_curricular: null,
    otros_personal: false, descripcion_otros_personal: ''
});
const serv = ref({
    farmacia: false, evaluacion_nutricional: false, actividades_recreativas: false,
    servicio_emergencia: false, servicio_funerario: false, medicos: false,
    medicos_descripcion: '', lavanderia: false, lavanderia_descripcion: '',
    barberia_peluqueria: false, otros: false, otros_descripcion: ''
});
const docs = ref(DOCUMENTOS_LISTA.map(d => ({ ...d, tiene_original: false, tiene_copia: false, descripcion: '' })));

// ── Columnas de tablas ────────────────────────────────────────────────────────
const colsPob = [
    { name: 'modalidad', label: 'Modalidad', field: 'modalidad', align: 'left' },
    { name: 'categoria', label: 'Categoría', field: 'categoria', align: 'left' },
    { name: 'femenino', label: 'Femenino', field: 'femenino', align: 'center' },
    { name: 'masculino', label: 'Masculino', field: 'masculino', align: 'center' },
    { name: 'total', label: 'Total', field: 'total', align: 'center' },
    { name: 'accion', label: '', field: '', align: 'center' },
];
const colsDocs = [
    { name: 'doc', label: 'Documento', field: 'tipo_documento_label', align: 'left' },
    { name: 'original', label: 'Tiene Original', field: 'tiene_original', align: 'center' },
    { name: 'copia', label: 'Tiene Copia', field: 'tiene_copia', align: 'center' },
    { name: 'nota', label: 'Nota', field: 'descripcion', align: 'left' },
];

// ── Progreso por tab ──────────────────────────────────────────────────────────
function countFields(obj, fields) {
    const filled = fields.filter(f => {
        const v = obj[f];
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'boolean') return v !== null && v !== undefined;
        return v !== null && v !== undefined && v !== '';
    }).length;
    return { filled, total: fields.length };
}

const tabFieldDefs = {
    datos: ['nombre_establecimiento', 'parroquia_id', 'tipo_establecimiento',
        'tipo_clasificacion', 'fecha_solicitud', 'tipo_solicitud', 'direccion',
        'rif', 'propietarios', 'telefonos', 'latitud', 'longitud'],
    capacidad: ['capacidad_total_residente', 'capacidad_actual_residente', 'atencion_ambulatoria'],
    poblacion: ['fecha_corte', 'registros'],
    infraestructura: ['estado_inmueble', 'num_dormitorios', 'num_sanitarios',
        'luz_electrica', 'agua_potable', 'agua_servidas'],
    personal: ['num_medicos_geriatra', 'num_enfermeros', 'num_cuidadores',
        'num_servicios_generales', 'num_personal_cocina'],
    servicios: ['farmacia', 'evaluacion_nutricional', 'medicos', 'lavanderia', 'barberia_peluqueria'],
    documentos: ['tiene_original'],
};

const tabSources = {
    datos, capacidad: cap, poblacion: pob, infraestructura: infra, personal: pers, servicios: serv
};

function tabFieldCount(name) {
    if (name === 'documentos') {
        const filled = docs.value.filter(d => d.tiene_original || d.tiene_copia).length;
        return { filled, total: docs.value.length };
    }
    const src = tabSources[name];
    return src ? countFields(src.value, tabFieldDefs[name] || []) : { filled: 0, total: 0 };
}
function tabProgress(name) {
    const c = tabFieldCount(name);
    return c.total ? c.filled / c.total : 0;
}

// ── Helpers de listas dinámicas ───────────────────────────────────────────────
function addProp() { datos.value.propietarios.push({ nombre: '', cedula_tipo: 'V', cedula_nro: '' }); }
function addRep() { datos.value.representantes.push({ nombre: '', cedula_tipo: 'V', cedula_nro: '', cargo: '' }); }
function addTel() { datos.value.telefonos.push({ telefono: '', tipo: 'general' }); }
function addCorreo() { datos.value.correos.push({ correo: '', tipo: 'general' }); }
function addPobRow() { pob.value.registros.push({ modalidad: 'residente', categoria: 'adultos', femenino: 0, masculino: 0 }); }

// ── Geolocalización ──────────────────────────────────────────────────────────
const geoLoading = ref(false);
const geocodeLoading = ref(false);

/**
 * Intenta resolver nombres de estado/municipio/parroquia recibidos de la API 
 * y seleccionarlos en los combos locales.
 */
async function autoSelectGeo(addressObj, fullName) {
    try {
        // Enviar nombres al backend para resolver IDs
        const { data } = await geoService.resolveGeo({
            estadoNombre: addressObj.state,
            // En Vzla, county suele ser el municipio. city a veces trae la parroquia.
            municipioNombre: addressObj.county || (addressObj.city?.toLowerCase().includes('municipio') ? addressObj.city : null) || addressObj.city,
            // Preferimos city si contiene la palabra "Parroquia", sino suburb/neighbourhood
            parroquiaNombre: (addressObj.city?.toLowerCase().includes('parroquia') ? addressObj.city : null) || 
                             addressObj.suburb || addressObj.neighbourhood || addressObj.district
        });

        if (data.estado) {
            estadoSel.value = data.estado.id;
            await onEstadoCambio(data.estado.id);
            
            if (data.municipio) {
                municipioSel.value = data.municipio.id;
                await onMunicipioCambio(data.municipio.id);
                
                if (data.parroquia) {
                    datos.value.parroquia_id = data.parroquia.id;
                    Notify.create({
                        type: 'info',
                        message: `Geolocalización: Detectada Parroquia ${data.parroquia.nombre}`,
                        timeout: 3000
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error auto-selecting geo-entities:', err);
    }
}

// Opción 1: GPS/WiFi del dispositivo (API nativa del navegador, sin costo ni API key)
async function obtenerUbicacionActual() {
    if (!navigator.geolocation) {
        return Notify.create({ type: 'negative', message: 'Tu navegador no soporta geolocalización.' });
    }
    geoLoading.value = true;
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = parseFloat(pos.coords.latitude.toFixed(7));
            const lng = parseFloat(pos.coords.longitude.toFixed(7));
            datos.value.latitud = lat;
            datos.value.longitud = lng;

            // Geocodificación inversa vía PROXY del backend (evita CORS)
            try {
                const { data } = await geoService.proxyReverse(lat, lng);

                if (data && data.address) {
                    // Construir una dirección legible con los componentes disponibles
                    const a = data.address;
                    const partes = [
                        a.road || a.pedestrian || a.footway || '',
                        a.house_number ? `N° ${a.house_number}` : '',
                        a.neighbourhood || a.suburb || a.quarter || '',
                        a.city_district || a.county || '',
                    ].filter(Boolean);
                    const direccionObtenida = partes.join(', ');
                    if (direccionObtenida) {
                        datos.value.direccion = direccionObtenida;
                    }

                    Notify.create({
                        type: 'positive',
                        icon: 'my_location',
                        message: 'Ubicación y dirección obtenidas (vía proxy)',
                        caption: data.display_name,
                        timeout: 5000
                    });

                    // Auto-selección de combos (Estado, Municipio, Parroquia)
                    await autoSelectGeo(data.address, data.display_name);
                } else {
                    Notify.create({
                        type: 'positive',
                        icon: 'my_location',
                        message: `Coordenadas obtenidas: ${lat}, ${lng}`,
                        caption: 'No se pudo obtener la dirección textual.',
                        timeout: 4000
                    });
                }
            } catch {
                // Si falla el reverse geocoding, ya tenemos las coordenadas
                Notify.create({
                    type: 'positive',
                    icon: 'my_location',
                    message: `Coordenadas obtenidas: ${lat}, ${lng}`,
                    caption: 'No se pudo obtener la dirección textual.',
                    timeout: 4000
                });
            } finally {
                geoLoading.value = false;
            }
        },
        (err) => {
            geoLoading.value = false;
            const msgs = {
                1: 'Permiso de ubicación denegado. Revisa la configuración del navegador.',
                2: 'No se pudo obtener la posición. Inténtalo nuevamente.',
                3: 'Tiempo de espera agotado para obtener la ubicación.',
            };
            Notify.create({ type: 'warning', message: msgs[err.code] || 'Error de geolocalización.' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// Opción 2: Geocoding por dirección vía Nominatim/OpenStreetMap (gratuito, sin API key)
async function geocodificarDireccion() {
    if (!datos.value.direccion) return;
    geocodeLoading.value = true;
    try {
        // Construir query combinando dirección + estado/municipio/parroquia si están cargados
        const parroquiaLabel = centrosStore.parroquias?.find(p => p.id === datos.value.parroquia_id)?.nombre || '';
        const municipioLabel = centrosStore.municipios?.find(m => m.id === municipioSel.value)?.nombre || '';
        const estadoLabel = centrosStore.estados?.find(e => e.id === estadoSel.value)?.nombre || '';
        const query = [datos.value.direccion, parroquiaLabel, municipioLabel, estadoLabel, 'Venezuela']
            .filter(Boolean).join(', ');

        const { data } = await geoService.proxySearch(query);

        if (data.length === 0) {
            Notify.create({ type: 'warning', message: 'No se encontraron coordenadas para esa dirección. Intenta con más detalle.' });
            return;
        }
        datos.value.latitud = parseFloat(parseFloat(data[0].lat).toFixed(7));
        datos.value.longitud = parseFloat(parseFloat(data[0].lon).toFixed(7));
        Notify.create({
            type: 'positive',
            icon: 'search',
            message: `Coordenadas obtenidas (vía proxy): ${datos.value.latitud}, ${datos.value.longitud}`,
            caption: data[0].display_name,
            timeout: 5000
        });

        // Intentar auto-seleccionar combos si tenemos acceso a los detalles de la dirección
        // En proxySearch, data[0] es un objeto que ya contiene un mapeo básico de dirección
        if (data[0]) {
            // Nota: En búsqueda directa (search), la respuesta puede variar. 
            // Podríamos intentar una búsqueda inversa sobre las coordenadas obtenidas para mayor precisión en los combos
            try {
                const revResp = await geoService.proxyReverse(datos.value.latitud, datos.value.longitud);
                if (revResp.data && revResp.data.address) {
                    await autoSelectGeo(revResp.data.address, revResp.data.display_name);
                }
            } catch (e) { console.error('Error resolving geo after search:', e); }
        }
    } catch {
        Notify.create({ type: 'negative', message: 'Error al conectar con el servicio de geocodificación.' });
    } finally {
        geocodeLoading.value = false;
    }
}



// ── Cascada geo ───────────────────────────────────────────────────────────────
const formDatosRef = ref(null);
async function onEstadoCambio(id) {
    municipioSel.value = null; datos.value.parroquia_id = null;
    await centrosStore.fetchMunicipios(id);
}
async function onMunicipioCambio(id) {
    datos.value.parroquia_id = null;
    await centrosStore.fetchParroquias(id);
}

// ── Guardado de cada sección ──────────────────────────────────────────────────
async function saveDatos() {
    if (formDatosRef.value) {
        const valid = await formDatosRef.value.validate();
        if (!valid) return Notify.create({ type: 'warning', message: 'Complete los campos obligatorios.' });
    }
    saving.value = true;
    try {
        const rifCompleto = datos.value.rif_numero
            ? `${datos.value.rif_tipo}-${datos.value.rif_numero}`
            : null;

        if (!centroId.value) {
            // Crear centro
            const cRes = await (await import('src/services/centros.service')).centrosService.create({
                nombre_establecimiento: datos.value.nombre_establecimiento,
                parroquia_id: datos.value.parroquia_id,
                rif: rifCompleto,
                nro_registro_mercantil: datos.value.nro_registro_mercantil,
                tipo_establecimiento: datos.value.tipo_establecimiento,
                tipo_establecimiento_descripcion: datos.value.tipo_establecimiento_descripcion,
                tipo_clasificacion: datos.value.tipo_clasificacion,
                latitud: datos.value.latitud,
                longitud: datos.value.longitud,
                propietarios: datos.value.propietarios,
                representantes: datos.value.representantes,
                telefonos: datos.value.telefonos,
                correos: datos.value.correos,
            });
            centroId.value = cRes.data.centro.id;
        } else {
            // Actualizar centro
            await (await import('src/services/centros.service')).centrosService.update(centroId.value, {
                nombre_establecimiento: datos.value.nombre_establecimiento,
                parroquia_id: datos.value.parroquia_id,
                rif: rifCompleto,
                nro_registro_mercantil: datos.value.nro_registro_mercantil,
                tipo_establecimiento: datos.value.tipo_establecimiento,
                tipo_establecimiento_descripcion: datos.value.tipo_establecimiento_descripcion,
                tipo_clasificacion: datos.value.tipo_clasificacion,
                latitud: datos.value.latitud,
                longitud: datos.value.longitud,
            });
        }

        // Crear o actualizar ficha base (fechas a ISO)
        const fichaPayload = {
            fecha_solicitud: toISO(datos.value.fecha_solicitud),
            nro_registro_nacional: datos.value.nro_registro_nacional,
            tipo_solicitud: datos.value.tipo_solicitud,
            fecha_fundacion: toISO(datos.value.fecha_fundacion),
            costo_mensual: datos.value.costo_mensual,
            direccion: datos.value.direccion,
        };

        if (!fichaId.value) {
            const fRes = await fichasService.create(centroId.value, fichaPayload);
            fichaId.value = fRes.data.ficha.id;
        } else {
            await fichasService.update(fichaId.value, fichaPayload);
        }

        savedTabs.value.datos = true;
        Notify.create({ type: 'positive', message: 'Datos del centro guardados correctamente.' });
        nextTab();
    } catch (err) {
        const msg = err?.response?.data?.error || 'Error al guardar.';
        if (err?.response?.status === 409) {
            Notify.create({ type: 'warning', message: msg + ' Redirigiendo...' });
            const centroExist = err.response.data.centro_id;
            if (centroExist) router.push(`/admin/centros/${centroExist}`);
        } else {
            Notify.create({ type: 'negative', message: msg });
        }
    } finally {
        saving.value = false;
    }
}

async function saveCapacidad() {
    if (!fichaId.value) return warn();
    saving.value = true;
    try {
        await fichasService.saveCapacidad(fichaId.value, cap.value);
        savedTabs.value.capacidad = true;
        Notify.create({ type: 'positive', message: 'Capacidad guardada.' });
        nextTab();
    } catch { Notify.create({ type: 'negative', message: 'Error al guardar capacidad.' }); }
    finally { saving.value = false; }
}

async function savePoblacion() {
    if (!fichaId.value) return warn();
    if (!pob.value.fecha_corte) return Notify.create({ type: 'warning', message: 'Indique la fecha de corte.' });
    saving.value = true;
    try {
        await fichasService.addPoblacion(fichaId.value, pob.value);
        savedTabs.value.poblacion = true;
        Notify.create({ type: 'positive', message: 'Población guardada.' });
        nextTab();
    } catch { Notify.create({ type: 'negative', message: 'Error al guardar población.' }); }
    finally { saving.value = false; }
}

async function saveInfraestructura() {
    if (!fichaId.value) return warn();
    saving.value = true;
    try {
        await fichasService.saveInfraestructura(fichaId.value, infra.value);
        savedTabs.value.infraestructura = true;
        Notify.create({ type: 'positive', message: 'Infraestructura guardada.' });
        nextTab();
    } catch { Notify.create({ type: 'negative', message: 'Error al guardar infraestructura.' }); }
    finally { saving.value = false; }
}

async function savePersonal() {
    if (!fichaId.value) return warn();
    saving.value = true;
    try {
        await fichasService.savePersonal(fichaId.value, pers.value);
        savedTabs.value.personal = true;
        Notify.create({ type: 'positive', message: 'Personal guardado.' });
        nextTab();
    } catch { Notify.create({ type: 'negative', message: 'Error al guardar personal.' }); }
    finally { saving.value = false; }
}

async function saveServicios() {
    if (!fichaId.value) return warn();
    saving.value = true;
    try {
        await fichasService.saveServicios(fichaId.value, serv.value);
        savedTabs.value.servicios = true;
        Notify.create({ type: 'positive', message: 'Servicios guardados.' });
        nextTab();
    } catch { Notify.create({ type: 'negative', message: 'Error al guardar servicios.' }); }
    finally { saving.value = false; }
}

async function saveDocumentos() {
    if (!fichaId.value) return warn();
    saving.value = true;
    try {
        // ── Guardar SOLO secciones con datos reales y no guardadas aún ──
        const pendientes = [];

        const hasCapacidad = cap.value.capacidad_total_residente != null
            || cap.value.capacidad_actual_residente != null
            || cap.value.atencion_ambulatoria;

        const hasInfraestructura = infra.value.estado_inmueble != null
            || infra.value.num_dormitorios != null
            || infra.value.num_sanitarios != null
            || infra.value.luz_electrica || infra.value.agua_potable;

        const hasPersonal = Object.values(pers.value)
            .some(v => typeof v === 'number' && v > 0);

        const hasServicios = Object.entries(serv.value)
            .some(([k, v]) => v === true && !k.endsWith('_descripcion'));

        if (!savedTabs.value.capacidad && hasCapacidad) {
            pendientes.push(
                fichasService.saveCapacidad(fichaId.value, cap.value)
                    .then(() => { savedTabs.value.capacidad = true; })
            );
        }
        if (!savedTabs.value.infraestructura && hasInfraestructura) {
            pendientes.push(
                fichasService.saveInfraestructura(fichaId.value, infra.value)
                    .then(() => { savedTabs.value.infraestructura = true; })
            );
        }
        if (!savedTabs.value.personal && hasPersonal) {
            pendientes.push(
                fichasService.savePersonal(fichaId.value, pers.value)
                    .then(() => { savedTabs.value.personal = true; })
            );
        }
        if (!savedTabs.value.servicios && hasServicios) {
            pendientes.push(
                fichasService.saveServicios(fichaId.value, serv.value)
                    .then(() => { savedTabs.value.servicios = true; })
            );
        }
        if (!savedTabs.value.poblacion && pob.value.fecha_corte && pob.value.registros.length > 0) {
            pendientes.push(
                fichasService.addPoblacion(fichaId.value, pob.value)
                    .then(() => { savedTabs.value.poblacion = true; })
            );
        }

        if (pendientes.length) {
            await Promise.all(pendientes);
        }

        // ── Guardar documentos ──
        await fichasService.saveDocumentos(fichaId.value, { documentos: docs.value });
        savedTabs.value.documentos = true;
        Notify.create({ type: 'positive', message: '\u00a1Ficha completada exitosamente!' });
        router.push(`/admin/centros/${centroId.value}`);
    } catch (err) {
        console.error(err);
        Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al guardar la ficha.' });
    } finally {
        saving.value = false;
    }
}

function warn() { Notify.create({ type: 'warning', message: 'Primero guarda los datos del centro.' }); }

// ── Inicialización ────────────────────────────────────────────────────────────
onMounted(async () => {
    await centrosStore.fetchEstados();

    // Verificar si el usuario ya tiene un centro (modo crear)
    if (!isEdit.value) {
        try {
            const { data } = await miCentroService.get();
            if (data && data.id) {
                Notify.create({
                    type: 'info',
                    message: 'Ya tienes un centro registrado. Redirigiendo a tu ficha...',
                    timeout: 3000
                });
                router.replace(`/admin/centros/${data.id}`);
                return;
            }
        } catch {/* usuario sin centro, OK */ }
    }

    // Modo edición: cargar datos existentes
    if (isEdit.value && route.params.id) {
        centroId.value = route.params.id;
        const centro = await centrosStore.fetchCentro(centroId.value);
        if (centro) {
            Object.assign(datos.value, {
                nombre_establecimiento: centro.nombre_establecimiento,
                rif: centro.rif,
                nro_registro_mercantil: centro.nro_registro_mercantil,
                parroquia_id: centro.parroquia_id,
                tipo_establecimiento: centro.tipo_establecimiento,
                tipo_establecimiento_descripcion: centro.tipo_establecimiento_descripcion,
                tipo_clasificacion: centro.tipo_clasificacion,
                latitud: centro.latitud !== undefined ? Number(centro.latitud) : null,
                longitud: centro.longitud !== undefined ? Number(centro.longitud) : null,
                propietarios: centro.propietarios || [],
                representantes: centro.representantes || [],
                telefonos: centro.telefonos || [],
                correos: centro.correos || [],
            });
            savedTabs.value.datos = true;
        }
        // Cargar ficha actual
        const ficha = await centrosStore.fetchFichaActual(centroId.value);
        if (ficha) {
            fichaId.value = ficha.id;
            Object.assign(datos.value, {
                fecha_solicitud: ficha.fecha_solicitud?.slice(0, 10),
                nro_registro_nacional: ficha.nro_registro_nacional,
                tipo_solicitud: ficha.tipo_solicitud,
                fecha_fundacion: ficha.fecha_fundacion?.slice(0, 10),
                costo_mensual: ficha.costo_mensual,
                direccion: ficha.direccion,
            });
            if (ficha.capacidad) { Object.assign(cap.value, ficha.capacidad); savedTabs.value.capacidad = true; }
            if (ficha.servicios) { Object.assign(serv.value, ficha.servicios); savedTabs.value.servicios = true; }
            if (ficha.personal) { Object.assign(pers.value, ficha.personal); savedTabs.value.personal = true; }
            if (ficha.infraestructura) { Object.assign(infra.value, ficha.infraestructura); savedTabs.value.infraestructura = true; }
            if (ficha.poblacion?.length) { savedTabs.value.poblacion = true; }
            if (ficha.documentos?.length) {
                ficha.documentos.forEach(d => {
                    const row = docs.value.find(r => r.tipo_documento === d.tipo_documento);
                    if (row) Object.assign(row, d);
                });
                savedTabs.value.documentos = true;
            }
        }
    }
});
</script>
