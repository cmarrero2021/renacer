<template>
    <q-page padding>
        <div class="text-h4 q-mb-md">
            <q-icon name="assignment" class="q-mr-sm" />
            Ficha de Establecimiento de Atención al Adulto Mayor
        </div>

        <q-form class="ficha-form">
            <!-- ============================================================ -->
            <!-- 1. DATOS GENERALES -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="info" class="q-mr-sm" />1. Datos Generales
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.fechaDia" label="Día" outlined dense mask="##" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.fechaMes" label="Mes" outlined dense mask="##" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.fechaAno" label="Año" outlined dense mask="####" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.nroRegistroNacional" label="1.2. Nro de Registro Nacional" outlined
                                dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-caption q-mb-xs text-weight-bold">1.3. Tipo de Solicitud</div>
                            <div class="row q-gutter-sm">
                                <q-toggle v-for="opt in opcionesTipoSolicitud" :key="opt.value"
                                    :model-value="form.tipoSolicitud === opt.value" :label="opt.label" dense
                                    @update:model-value="setToggle('tipoSolicitud', opt.value, $event)" />
                            </div>
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 2. IDENTIFICACIÓN DEL ESTABLECIMIENTO -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="business" class="q-mr-sm" />2. Identificación del Establecimiento
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12">
                            <q-input v-model="form.nombreEstablecimiento" label="a) Nombre del Establecimiento" outlined
                                dense />
                        </div>
                        <div class="col-12">
                            <q-input v-model="form.direccion" label="b) Dirección (Av, Calle, Urbanización)" outlined
                                dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.parroquia" label="c) Parroquia" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.municipio" label="d) Municipio" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.estado" label="e) Estado" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.registroMercantil" label="f) N° Registro Mercantil" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.fechaFundacion" label="g) Fecha de Fundación (D/M/A)" outlined dense
                                mask="##/##/####" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.telefono" label="h) Teléfono(s)" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.correo" label="i) Correo(s) Electrónico(s)" outlined dense />
                        </div>

                        <!-- Tipo de Establecimiento -->
                        <div class="col-12 col-sm-6">
                            <div class="text-subtitle2 q-mb-sm text-weight-bold">j) Tipo de Establecimiento</div>
                            <div class="row q-gutter-sm">
                                <q-toggle v-for="opt in opcionesTipoEstablecimiento" :key="opt.value"
                                    :model-value="form.tipoEstablecimiento === opt.value" :label="opt.label" dense
                                    @update:model-value="setToggle('tipoEstablecimiento', opt.value, $event)" />
                            </div>
                            <q-input v-if="form.tipoEstablecimiento === 'otra'" v-model="form.tipoEstablecimientoOtra"
                                label="Explique" outlined dense class="q-mt-sm" />
                            <q-input v-model="form.costoMensual" label="Costo Mensual" outlined dense class="q-mt-sm"
                                prefix="Bs." />
                        </div>

                        <!-- Tipo de Clasificación -->
                        <div class="col-12 col-sm-6">
                            <div class="text-subtitle2 q-mb-sm text-weight-bold">k) Tipo de Clasificación</div>
                            <div class="row q-gutter-sm">
                                <q-toggle v-for="opt in opcionesTipoClasificacion" :key="opt.value"
                                    :model-value="form.tipoClasificacion === opt.value" :label="opt.label" dense
                                    @update:model-value="setToggle('tipoClasificacion', opt.value, $event)" />
                            </div>
                            <q-input v-if="form.tipoClasificacion === 'otras'" v-model="form.tipoClasificacionOtra"
                                label="Especifique" outlined dense class="q-mt-sm" />
                        </div>

                        <!-- Propietario(s) y Encargado -->
                        <div class="col-12">
                            <q-separator class="q-my-sm" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-3">
                            <q-input v-model="form.nombrePropietario" label="l) Nombre de Propietario(s)" outlined
                                dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-3">
                            <q-input v-model="form.cedulaPropietario" label="m) N° Céd. Identidad" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-3">
                            <q-input v-model="form.nombreEncargado" label="n) Nombre Encargado" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-3">
                            <q-input v-model="form.cedulaEncargado" label="ñ) N° Céd. Identidad" outlined dense />
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 3. CAPACIDAD INSTALADA Y REAL DE RESIDENTES/AMBULATORIOS -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="groups" class="q-mr-sm" />3. Capacidad Instalada y Real de Residentes /
                        Ambulatorios
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.capacidadTotalResidente" label="3.1 Capacidad Total Residente"
                                outlined dense type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-toggle v-model="form.atencionAmbulatoria" label="3.2 Atención Ambulatoria" dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.capacidadAtencionAmbulatoria"
                                label="3.3 Capacidad Atención Ambulatoria" outlined dense type="number" />
                        </div>
                    </div>

                    <!-- Tabla 3.5 Población Residente -->
                    <div class="text-subtitle2 q-mt-lg q-mb-sm text-weight-bold">
                        3.5 Adultos y Adultas Mayores y Otras Categorías de Personas Residentes y Ambulatorios
                    </div>
                    <q-markup-table flat bordered separator="cell" class="ficha-table">
                        <thead>
                            <tr>
                                <th rowspan="2">Población Residente</th>
                                <th colspan="3" class="text-center">Residentes</th>
                                <th colspan="3" class="text-center">Ambulatorios</th>
                            </tr>
                            <tr>
                                <th class="text-center">Femenino</th>
                                <th class="text-center">Masculino</th>
                                <th class="text-center">Total</th>
                                <th class="text-center">Femenino</th>
                                <th class="text-center">Masculino</th>
                                <th class="text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(fila, idx) in form.poblacionResidente" :key="idx">
                                <td>{{ fila.label }}</td>
                                <td><q-input v-model="fila.resFemenino" dense borderless type="number"
                                        input-class="text-center" /></td>
                                <td><q-input v-model="fila.resMasculino" dense borderless type="number"
                                        input-class="text-center" /></td>
                                <td><q-input v-model="fila.resTotal" dense borderless type="number"
                                        input-class="text-center" /></td>
                                <td><q-input v-model="fila.ambFemenino" dense borderless type="number"
                                        input-class="text-center" /></td>
                                <td><q-input v-model="fila.ambMasculino" dense borderless type="number"
                                        input-class="text-center" /></td>
                                <td><q-input v-model="fila.ambTotal" dense borderless type="number"
                                        input-class="text-center" /></td>
                            </tr>
                        </tbody>
                    </q-markup-table>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 4. DOCUMENTOS CONSIGNADOS (ORIGINAL Y COPIA) -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="folder_open" class="q-mr-sm" />4. Documentos Consignados (Original y Copia)
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4" v-for="(doc, idx) in opcionesDocumentos" :key="idx">
                            <q-toggle v-model="form.documentos" :val="doc.value" :label="doc.label" dense />
                        </div>
                    </div>
                    <q-input v-model="form.documentosOtros" label="4.1 (*) Mencione otros documentos adicionales"
                        outlined dense class="q-mt-md" />
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 5. IDENTIFICACIÓN DE LOS SERVICIOS PRESTADOS -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="medical_services" class="q-mr-sm" />5. Identificación de los Servicios Prestados
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4" v-for="(srv, idx) in opcionesServicios" :key="idx">
                            <q-toggle v-model="form.servicios[srv.value]" :label="srv.label" dense />
                            <q-input v-if="srv.hasCuales && form.servicios[srv.value]"
                                v-model="form.serviciosCuales[srv.value]" label="¿Cuáles?" outlined dense
                                class="q-mt-xs" />
                        </div>
                        <!-- Especifique para 'Otros' -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.serviciosEspecifique" label="Especifique (Otros)" outlined dense />
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 6. PERSONAL ASISTENCIAL -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="badge" class="q-mr-sm" />6. Personal Asistencial
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.medicoGeriatra" label="N° Médicos Geriatra/Internista" outlined dense
                                type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.medicoPsiquiatra" label="N° Médicos Psiquiatra" outlined dense
                                type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.enfermeros" label="N° Enfermeros" outlined dense type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.cuidadores" label="N° Cuidadores" outlined dense type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.camareros" label="N° Camareros" outlined dense type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.auxEnfermeria" label="N° Auxiliares Enfermería" outlined dense
                                type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.serviciosGenerales" label="N° Servicios Generales" outlined dense
                                type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.personalCocina" label="N° Personal de Cocina" outlined dense
                                type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.personalNoAdscrito"
                                label="N° Personal no Adscrito al Establecimiento" outlined dense type="number" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-model="form.personalNoAdscritoExplique" label="Explique" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-toggle v-model="form.poseeExpediente" label="Poseen Expediente Curricular" dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <q-input v-if="!form.poseeExpediente" v-model="form.expedienteExplique" label="Explique"
                                outlined dense />
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 7. DESCRIPCIÓN DEL INMUEBLE / CONDICIONES DE INFRAESTRUCTURA -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="apartment" class="q-mr-sm" />7. Descripción del Inmueble / Condiciones de
                        Infraestructura
                    </div>
                </q-card-section>
                <q-card-section>
                    <!-- 7.1 Estado del Inmueble -->
                    <div class="text-subtitle2 q-mb-sm text-weight-bold">7.1 Estado del Inmueble</div>
                    <div class="row q-gutter-sm q-mb-md">
                        <q-toggle v-for="opt in opcionesEstadoInmueble" :key="opt.value"
                            :model-value="form.estadoInmueble === opt.value" :label="opt.label" dense
                            @update:model-value="setToggle('estadoInmueble', opt.value, $event)" />
                    </div>

                    <q-separator class="q-my-md" />

                    <!-- 7.2 Distribución Física Refinada -->
                    <div class="text-subtitle2 q-mb-md text-weight-bold">7.2 Distribución Física</div>
                    <div class="row q-col-gutter-lg">
                        <!-- Dormitorios -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Dormitorios</div>
                            <div class="row items-center q-col-gutter-sm">
                                <div class="col">
                                    <q-input v-model="form.nDormitorios" label="N° Dormitorios" outlined dense
                                        type="number" />
                                </div>
                                <div class="col-auto flex flex-center">
                                    <q-toggle v-model="form.dormitoriosAdecuados" label="Adecuados" dense
                                        color="green" />
                                </div>
                            </div>
                        </div>

                        <!-- Sanitarios -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Sanitarios</div>
                            <div class="row items-center q-col-gutter-sm">
                                <div class="col">
                                    <q-input v-model="form.nSanitarios" label="N° Sanitarios" outlined dense
                                        type="number" />
                                </div>
                                <div class="col-auto flex flex-center">
                                    <q-toggle v-model="form.sanitariosAdecuados" label="Adecuados" dense
                                        color="green" />
                                </div>
                            </div>
                        </div>

                        <!-- Cocina -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Área de Cocina</div>
                            <div class="row items-center q-col-gutter-sm">
                                <div class="col">
                                    <q-input v-model="form.areaCocina" label="Descripción" outlined dense />
                                </div>
                                <div class="col-auto flex flex-center">
                                    <q-toggle v-model="form.cocinaAdecuada" label="Adecuada" dense color="green" />
                                </div>
                            </div>
                        </div>

                        <!-- Comedor -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Capacidad Comedor</div>
                            <q-input v-model="form.capacidadComedor" label="Porcentaje de Atención (%)" outlined
                                dense />
                        </div>

                        <!-- Áreas de Atención Médica o Enfermería -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Atención Médica o Enfermería</div>
                            <div class="row items-center q-col-gutter-sm" style="height: 40px;">
                                <q-toggle v-model="form.areasAtencionMedica" label="Tiene área" dense color="primary" />
                            </div>
                        </div>

                        <!-- Áreas Verdes -->
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-weight-medium q-mb-xs">Áreas Verdes</div>
                            <div class="row items-center q-col-gutter-sm" style="height: 40px;">
                                <q-toggle v-model="form.areasVerdes" label="Tiene área" dense color="positive" />
                            </div>
                        </div>

                        <!-- Otros Aspectos (Sin etiqueta, alineado con inputs) -->
                        <div class="col-12 col-sm-6 col-md-8">
                            <div class="q-mb-xs" style="height: 19px;"></div>
                            <!-- Spacer para alinear con las etiquetas de otras columnas -->
                            <div class="row items-center q-gutter-xl" style="height: 40px;">
                                <q-toggle v-model="form.ventilacionAdecuada" label="Ventilación Adecuada" dense
                                    color="blue" />
                                <q-toggle v-model="form.iluminacionAdecuada" label="Iluminación Adecuada" dense
                                    color="orange" />
                            </div>
                        </div>
                    </div>

                    <q-separator class="q-my-md" />

                    <!-- 7.3 Servicios -->
                    <div class="text-subtitle2 q-mb-sm text-weight-bold">7.3 Servicios</div>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3" v-for="(s, idx) in opcionesServiciosInmueble"
                            :key="idx">
                            <q-toggle v-model="form.serviciosInmueble" :val="s.value" :label="s.label" dense />
                        </div>
                    </div>

                    <q-separator class="q-my-md" />

                    <!-- 7.4 Otros elementos -->
                    <div class="text-subtitle2 q-mb-sm text-weight-bold">7.4 Describa Otros Elementos de las Condiciones
                        del Inmueble y su Distribución</div>
                    <q-input v-model="form.otrosElementosInmueble" type="textarea" outlined dense rows="3" />
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 8. INSTITUTO NACIONAL DE SERVICIOS SOCIALES (REGIONAL) -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="account_balance" class="q-mr-sm" />8. Instituto Nacional de Servicios Sociales
                        (Regional) / Gerencia de Servicios de Salud
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12">
                            <div class="text-subtitle2 q-mb-sm text-weight-bold">8.1 Verificado Por:</div>
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.verificadoNombre" label="8.1.1 Nombre y Apellido" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="row q-col-gutter-sm items-center">
                                <div class="col-auto">
                                    <div class="row q-gutter-sm">
                                        <q-toggle
                                            v-for="opt in [{ label: 'V', value: 'V' }, { label: 'E', value: 'E' }]"
                                            :key="opt.value" :model-value="form.verificadoTipoCedula === opt.value"
                                            :label="opt.label" dense
                                            @update:model-value="setToggle('verificadoTipoCedula', opt.value, $event)" />
                                    </div>
                                </div>
                                <div class="col">
                                    <q-input v-model="form.verificadoCedula" label="8.1.2 N° Cédula" outlined dense />
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.verificadoCargo" label="8.1.3 Cargo" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.verificadoFecha" label="8.1.4 Fecha" outlined dense
                                mask="##/##/####" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.nombreCentroServicioSocial"
                                label="8.2 Nombre de Centro de Servicio Social" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.observaciones8" label="8.3 Observaciones" outlined dense
                                type="textarea" rows="2" />
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 9. VERIFICACIÓN DE LAS AUTORIDADES INASS (SEDE CENTRAL) -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="verified" class="q-mr-sm" />9. Verificación de las Autoridades INASS (Sede
                        Central)
                    </div>
                </q-card-section>
                <q-card-section>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4">
                            <div class="text-subtitle2 q-mb-sm text-weight-bold">9.1 Estatus de Autorización</div>
                            <div class="row q-gutter-sm">
                                <q-toggle
                                    v-for="opt in [{ label: 'Aprobado', value: 'aprobado' }, { label: 'Negado', value: 'negado' }]"
                                    :key="opt.value" :model-value="form.estatusAutorizacion === opt.value"
                                    :label="opt.label" dense
                                    @update:model-value="setToggle('estatusAutorizacion', opt.value, $event)" />
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.nFechaProvidencia"
                                label="9.2 N° y Fecha de Providencia (Directorio INASS)" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.nombreGerenteSalud"
                                label="9.3 Nombre y Apellido del Gerente de Servicios de Salud" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-6">
                            <q-input v-model="form.nombreCoordinador"
                                label="9.4 Nombre y Apellido del Coordinador/Jefe Área de Superv. y Reg. de Establec. Público y Priv."
                                outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-6">
                            <q-input v-model="form.firmasSellos" label="9.5 Firmas y Sellos de los Funcionarios"
                                outlined dense type="textarea" rows="2" />
                        </div>
                    </div>
                </q-card-section>
            </q-card>

            <!-- ============================================================ -->
            <!-- 10. DECLARACIÓN DE LA INFORMACIÓN SUMINISTRADA -->
            <!-- ============================================================ -->
            <q-card class="q-mb-md">
                <q-card-section class="bg-primary text-white">
                    <div class="text-subtitle1 text-weight-bold">
                        <q-icon name="fact_check" class="q-mr-sm" />10. Declaración de la Información Suministrada
                    </div>
                </q-card-section>
                <q-card-section>
                    <q-banner class="bg-grey-2 q-mb-md" rounded>
                        <p class="text-body2" style="text-align: justify;">
                            DECLARO QUE LA INFORMACIÓN Y LOS DATOS SUMINISTRADOS EN ESTA SOLICITUD SON VERDADEROS Y
                            EXACTOS,
                            AUTORIZO AL INSTITUTO NACIONAL DE SERVICIOS SOCIALES (INASS) PARA LA INVESTIGACIÓN DE ESTA
                            DECLARACIÓN,
                            ASÍ COMO TENGO CONOCIMIENTO QUE SI LLEGASE A SER COMPROBADO QUE HE INCURRIDO EN
                            FALSEDAD O FRAUDE, LLEVA CONSIGO LA REVOCACIÓN DE LA SOLICITUD DE FUNCIONAMIENTO.
                        </p>
                    </q-banner>
                    <div class="row q-col-gutter-md">
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.declaracionLugar" label="Lugar" outlined dense />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.declaracionFecha" label="Fecha" outlined dense mask="##/##/####" />
                        </div>
                        <div class="col-12 col-sm-6 col-md-4">
                            <q-input v-model="form.declaracionFirmaSello" label="Firma y Sello" outlined dense />
                        </div>
                    </div>
                </q-card-section>
            </q-card>
        </q-form>
    </q-page>
</template>

<script setup>
import { ref, reactive } from 'vue'

// Opciones para grupos de toggles exclusivos (multi-opción)
const opcionesTipoSolicitud = [
    { label: 'Registro y Autorización', value: 'registro_autorizacion' },
    { label: 'Renovación de Autorización', value: 'renovacion' }
]

const opcionesTipoEstablecimiento = [
    { label: 'Público', value: 'publico' },
    { label: 'Afiliada al IVSS', value: 'ivss' },
    { label: 'Privado', value: 'privado' },
    { label: 'Religiosa', value: 'religiosa' },
    { label: 'Otra', value: 'otra' }
]

const opcionesTipoClasificacion = [
    { label: 'Geriátrico', value: 'geriatrico' },
    { label: 'Geronto-Psiquiátrico', value: 'geronto_psiquiatrico' },
    { label: 'Casa Hogar', value: 'casa_hogar' },
    { label: 'Unidades Gerontológicas', value: 'unidades_gerontologicas' },
    { label: 'Fundación', value: 'fundacion' },
    { label: 'Otras', value: 'otras' }
]

const opcionesDocumentos = [
    { label: 'Carta de Solicitud de Autorización', value: 'carta_solicitud' },
    { label: 'Copia de Cédula del Solicitante y Propietarios', value: 'cedula_solicitante' },
    { label: 'Registro Mercantil', value: 'registro_mercantil' },
    { label: 'Registro de Información Fiscal (RIF)', value: 'rif' },
    { label: 'Documento que Acredite el Inmueble', value: 'doc_inmueble' },
    { label: 'Conformidad de Uso del Inmueble', value: 'conformidad_uso' },
    { label: 'Permiso Sanitario Local', value: 'permiso_sanitario' },
    { label: 'Permiso Sanitario de Funcionamiento de Alimentos', value: 'permiso_alimentos' },
    { label: 'Plano del Inmueble', value: 'plano_inmueble' },
    { label: 'Otros (*)', value: 'otros' }
]

const opcionesServicios = [
    { label: 'Farmacia', value: 'farmacia', hasCuales: false },
    { label: 'Evaluación Nutricional', value: 'evaluacion_nutricional', hasCuales: false },
    { label: 'Act. Recreativas, Culturales, Religiosas y Deportivas', value: 'act_recreativas', hasCuales: false },
    { label: 'Servicio de Emergencia', value: 'emergencia', hasCuales: false },
    { label: 'Servicio Funerario', value: 'funerario', hasCuales: false },
    { label: 'Médicos', value: 'medicos', hasCuales: true },
    { label: 'Lavandería', value: 'lavanderia', hasCuales: false },
    { label: 'Barbería y Peluquería', value: 'barberia', hasCuales: false },
    { label: 'Otros', value: 'otros', hasCuales: false }
]

const opcionesEstadoInmueble = [
    { label: 'Excelente', value: 'excelente' },
    { label: 'Bueno', value: 'bueno' },
    { label: 'Deficiente', value: 'deficiente' }
]

const opcionesServiciosInmueble = [
    { label: 'Luz Eléctrica', value: 'luz' },
    { label: 'Agua Potable', value: 'agua' },
    { label: 'Aguas Servidas', value: 'aguas_servidas' },
    { label: 'Depósito de Basura', value: 'basura' },
    { label: 'Sistema de Seguridad', value: 'seguridad' }
]

// Formulario reactivo
const form = reactive({
    // 1. Datos Generales
    fechaDia: '',
    fechaMes: '',
    fechaAno: '',
    nroRegistroNacional: '',
    tipoSolicitud: '',

    // 2. Identificación del Establecimiento
    nombreEstablecimiento: '',
    direccion: '',
    parroquia: '',
    municipio: '',
    estado: '',
    registroMercantil: '',
    fechaFundacion: '',
    telefono: '',
    correo: '',
    tipoEstablecimiento: '',
    tipoEstablecimientoOtra: '',
    costoMensual: '',
    tipoClasificacion: '',
    tipoClasificacionOtra: '',
    nombrePropietario: '',
    cedulaPropietario: '',
    nombreEncargado: '',
    cedulaEncargado: '',

    // 3. Capacidad Instalada
    capacidadTotalResidente: '',
    atencionAmbulatoria: false,
    capacidadAtencionAmbulatoria: '',
    poblacionResidente: [
        { label: 'Autoválidos', resFemenino: '', resMasculino: '', resTotal: '', ambFemenino: '', ambMasculino: '', ambTotal: '' },
        { label: 'Con Discapacidad', resFemenino: '', resMasculino: '', resTotal: '', ambFemenino: '', ambMasculino: '', ambTotal: '' },
        { label: 'Otras categorías de Personas', resFemenino: '', resMasculino: '', resTotal: '', ambFemenino: '', ambMasculino: '', ambTotal: '' }
    ],

    // 4. Documentos
    documentos: [],
    documentosOtros: '',

    // 5. Servicios Prestados (booleanos: toggle on = Sí, toggle off = No)
    servicios: {
        farmacia: false,
        evaluacion_nutricional: false,
        act_recreativas: false,
        emergencia: false,
        funerario: false,
        medicos: false,
        lavanderia: false,
        barberia: false,
        otros: false
    },
    serviciosCuales: {
        medicos: ''
    },
    serviciosEspecifique: '',

    // 6. Personal Asistencial
    medicoGeriatra: '',
    medicoPsiquiatra: '',
    enfermeros: '',
    cuidadores: '',
    camareros: '',
    auxEnfermeria: '',
    serviciosGenerales: '',
    personalCocina: '',
    personalNoAdscrito: '',
    personalNoAdscritoExplique: '',
    poseeExpediente: false,
    expedienteExplique: '',

    // 7. Descripción del Inmueble
    estadoInmueble: '',
    nDormitorios: '',
    dormitoriosAdecuados: false,
    nSanitarios: '',
    sanitariosAdecuados: false,
    areaCocina: '',
    cocinaAdecuada: false,
    areasAtencionMedica: false,
    areasVerdes: false,
    ventilacionAdecuada: false,
    iluminacionAdecuada: false,
    capacidadComedor: '',
    serviciosInmueble: [],
    otrosElementosInmueble: '',

    // 8. INASS Regional
    verificadoNombre: '',
    verificadoTipoCedula: 'V',
    verificadoCedula: '',
    verificadoCargo: '',
    verificadoFecha: '',
    nombreCentroServicioSocial: '',
    observaciones8: '',

    // 9. Verificación INASS Central
    estatusAutorizacion: '',
    nFechaProvidencia: '',
    nombreGerenteSalud: '',
    nombreCoordinador: '',
    firmasSellos: '',

    // 10. Declaración
    declaracionLugar: '',
    declaracionFecha: '',
    declaracionFirmaSello: ''
})

/**
 * Toggle exclusivo para grupos multi-opción (ej: Tipo Establecimiento, Estado Inmueble).
 * Activar uno desactiva el anterior; desactivar limpia la selección.
 */
const setToggle = (field, value, isOn) => {
    form[field] = isOn ? value : ''
}
</script>

<style lang="scss" scoped>
.ficha-form {
    max-width: 1400px;
    margin: 0 auto;
}

.ficha-table {
    width: 100%;
    overflow-x: auto;

    th {
        background-color: $primary;
        color: white;
        font-size: 0.8rem;
        padding: 6px 8px;
    }

    td {
        padding: 2px 4px;
        vertical-align: middle;
    }
}
</style>
