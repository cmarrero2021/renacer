<template>
    <div class="q-pa-md">
        <h4 class="q-mb-md">{{ titulo }}</h4>

        <q-table :title="titulo" :rows="registros" :columns="columnas" :rows-per-page-options="[10, 20, 50]"
            row-key="id" :loading="loading" class="responsive-table">
            <!-- Barra superior con búsqueda y botones -->
            <template v-slot:top>
                <div class="full-width row wrap items-center q-mb-md">
                    <!-- Búsqueda -->
                    <div class="col-xs-12 col-sm-6 q-pr-xs">
                        <q-input v-model="busqueda" outlined dense placeholder="Buscar..." class="full-width">
                            <template v-slot:append>
                                <q-icon name="search" />
                            </template>
                        </q-input>
                    </div>

                    <!-- Botones de acción -->
                    <div class="col-xs-12 col-sm-6 row justify-end no-wrap q-mt-sm-none q-mt-xs-sm">
                        <q-btn v-if="puedeCrear" icon="add" color="primary" label="Nuevo" @click="abrirModalCrear"
                            class="action-btn q-mr-sm" />
                        <q-btn-dropdown v-if="puedeExportar" color="secondary" label="Exportar" icon="file_download"
                            class="action-btn">
                            <q-list>
                                <q-item clickable v-close-popup @click="exportExcel">
                                    <q-item-section avatar><q-icon name="mdi-file-excel"
                                            color="green" /></q-item-section>
                                    <q-item-section>Excel</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportCSV">
                                    <q-item-section avatar><q-icon name="mdi-file-delimited"
                                            color="blue" /></q-item-section>
                                    <q-item-section>CSV</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportJSON">
                                    <q-item-section avatar><q-icon name="mdi-code-json"
                                            color="orange" /></q-item-section>
                                    <q-item-section>JSON</q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
                    </div>
                </div>
            </template>

            <!-- Columna de acciones -->
            <template v-slot:body-cell-actions="props">
                <q-td>
                    <div class="row items-center q-gutter-xs">
                        <q-btn v-if="puedeEditar" icon="edit" color="primary" size="sm" flat round
                            @click="abrirModalEditar(props.row)">
                            <q-tooltip>Editar</q-tooltip>
                        </q-btn>
                        <q-btn v-if="puedeEliminar" icon="delete" color="negative" size="sm" flat round
                            @click="confirmarEliminar(props.row)">
                            <q-tooltip>Eliminar</q-tooltip>
                        </q-btn>
                    </div>
                </q-td>
            </template>

            <!-- Estado de carga -->
            <template v-slot:loading>
                <q-inner-loading showing color="primary" />
            </template>
        </q-table>

        <!-- Modal Crear/Editar -->
        <q-dialog v-model="modalAbierto" persistent>
            <q-card style="min-width: 400px; max-width: 90vw">
                <q-card-section class="bg-primary text-white">
                    <div class="text-h6">
                        <q-icon :name="modoEdicion ? 'edit' : 'add'" class="q-mr-sm" />
                        {{ modoEdicion ? 'Editar' : 'Nuevo' }} {{ tituloSingular }}
                    </div>
                </q-card-section>

                <q-card-section class="q-pt-lg">
                    <q-form @submit.prevent="guardar">
                        <div v-for="campo in camposEditables" :key="campo.name" class="q-mb-md">
                            <q-input v-model="formData[campo.name]" :label="campo.label" :type="campo.type || 'text'"
                                filled dense :class="campo.uppercase ? 'uppercase-input' : ''"
                                @keyup="campo.uppercase ? forceUpperCase($event, campo.name) : null">
                                <template v-if="campo.required" v-slot:label>
                                    {{ campo.label }} <span class="text-negative">*</span>
                                </template>
                            </q-input>
                        </div>
                    </q-form>
                </q-card-section>

                <q-card-actions align="right" class="bg-grey-1">
                    <q-btn label="Cancelar" color="negative" outline @click="cerrarModal" />
                    <q-btn label="Guardar" color="primary" @click="guardar" :loading="guardando" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { LocalStorage, Notify } from 'quasar';
import Swal from 'sweetalert2';
import axios from 'axios';
import { exportToExcel, exportToCSV, exportToJSON } from 'src/helpers/exportHelpers';

const props = defineProps({
    // Nombre de la tabla en el backend
    tabla: {
        type: String,
        required: true
    },
    // Título para mostrar (plural)
    titulo: {
        type: String,
        required: true
    },
    // Título singular
    tituloSingular: {
        type: String,
        required: true
    },
    // Configuración de columnas para la tabla
    columnas: {
        type: Array,
        required: true
    },
    // Campos editables en el formulario
    camposEditables: {
        type: Array,
        required: true
    },
    // Nombre del permiso base (ej: 'areas_conocimiento')
    permisoBase: {
        type: String,
        required: true
    }
});

// Usar auth service para mantenedores (requieren autenticación)
const authApiUrl = import.meta.env.VITE_AUTH_API_URL?.replace(/\/$/, '') || '';
const registros = ref([]);
const busqueda = ref('');
const loading = ref(false);
const modalAbierto = ref(false);
const modoEdicion = ref(false);
const guardando = ref(false);
const formData = ref({});

// Funciones de permisos
const hasPermission = (permissionName) => {
    const permissions = LocalStorage.getItem('permissions') || [];
    return permissions.some(p => p.name === permissionName);
};

const isAdmin = () => {
    const role = LocalStorage.getItem('role');
    return role && ['admin', 'administrador', 'administrator'].includes(role.toLowerCase());
};

// Permisos calculados
const puedeCrear = computed(() => isAdmin() || hasPermission(`create_${props.permisoBase}`));
const puedeEditar = computed(() => isAdmin() || hasPermission(`update_${props.permisoBase}`));
const puedeEliminar = computed(() => isAdmin() || hasPermission(`delete_${props.permisoBase}`));
const puedeExportar = computed(() => isAdmin() || hasPermission(`export_${props.permisoBase}`));

// Registros filtrados por búsqueda
const registrosFiltrados = computed(() => {
    if (!busqueda.value) return registros.value;
    const needle = busqueda.value.toLowerCase();
    return registros.value.filter(r => {
        return props.camposEditables.some(campo => {
            const valor = r[campo.name];
            return valor && valor.toString().toLowerCase().includes(needle);
        });
    });
});

// Cargar registros
const cargarRegistros = async () => {
    loading.value = true;
    try {
        const response = await axios.get(`${authApiUrl}/mantenedor/${props.tabla}`);
        registros.value = response.data;
    } catch (error) {
        console.error('Error al cargar registros:', error);
        Notify.create({
            type: 'negative',
            message: 'Error al cargar los datos',
            position: 'top'
        });
    } finally {
        loading.value = false;
    }
};

// Modal crear
const abrirModalCrear = () => {
    modoEdicion.value = false;
    formData.value = {};
    props.camposEditables.forEach(campo => {
        formData.value[campo.name] = '';
    });
    modalAbierto.value = true;
};

// Modal editar
const abrirModalEditar = (registro) => {
    modoEdicion.value = true;
    formData.value = { ...registro };
    modalAbierto.value = true;
};

// Cerrar modal
const cerrarModal = () => {
    modalAbierto.value = false;
    formData.value = {};
};

// Guardar (crear o editar)
const guardar = async () => {
    // Validar campos requeridos
    const errores = [];
    props.camposEditables.forEach(campo => {
        if (campo.required && !formData.value[campo.name]?.trim()) {
            errores.push(`${campo.label} es obligatorio`);
        }
    });

    if (errores.length > 0) {
        Notify.create({
            type: 'negative',
            message: errores.join('\n'),
            position: 'top',
            multiLine: true
        });
        return;
    }

    guardando.value = true;
    try {
        if (modoEdicion.value) {
            await axios.put(`${authApiUrl}/mantenedor/${props.tabla}/${formData.value.id}`, formData.value);
            Notify.create({
                type: 'positive',
                message: `${props.tituloSingular} actualizado correctamente`,
                position: 'top'
            });
        } else {
            await axios.post(`${authApiUrl}/mantenedor/${props.tabla}`, formData.value);
            Notify.create({
                type: 'positive',
                message: `${props.tituloSingular} creado correctamente`,
                position: 'top'
            });
        }
        cerrarModal();
        await cargarRegistros();
    } catch (error) {
        console.error('Error al guardar:', error);
        const mensaje = error.response?.data?.error || 'Error al guardar';
        Notify.create({
            type: 'negative',
            message: mensaje,
            position: 'top'
        });
    } finally {
        guardando.value = false;
    }
};

// Confirmar eliminar
const confirmarEliminar = async (registro) => {
    const campoNombre = props.camposEditables[0]?.name || 'id';
    const nombreRegistro = registro[campoNombre] || registro.id;

    const result = await Swal.fire({
        title: '¿Eliminar registro?',
        text: `¿Está seguro de eliminar "${nombreRegistro}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await axios.delete(`${authApiUrl}/mantenedor/${props.tabla}/${registro.id}`);
            Notify.create({
                type: 'positive',
                message: 'Registro eliminado correctamente',
                position: 'top'
            });
            await cargarRegistros();
        } catch (error) {
            console.error('Error al eliminar:', error);
            const mensaje = error.response?.data?.error || 'Error al eliminar';
            Notify.create({
                type: 'negative',
                message: mensaje,
                position: 'top'
            });
        }
    }
};

// Forzar mayúsculas
const forceUpperCase = (event, fieldName) => {
    const el = event.target;
    if (el) {
        el.value = el.value.toUpperCase();
        formData.value[fieldName] = el.value;
    }
};

// Exportar
const getTimestamp = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

const getExportFilename = (ext) => `${props.tabla}_${getTimestamp()}.${ext}`;

const getExportData = () => {
    return registrosFiltrados.value.map(r => {
        const obj = { id: r.id };
        props.camposEditables.forEach(campo => {
            obj[campo.label] = r[campo.name];
        });
        return obj;
    });
};

const exportExcel = () => exportToExcel(getExportData(), getExportFilename('xlsx'));
const exportCSV = () => exportToCSV(getExportData(), getExportFilename('csv'));
const exportJSON = () => exportToJSON(getExportData(), getExportFilename('json'));

onMounted(() => {
    cargarRegistros();
});
</script>

<style scoped>
.uppercase-input input {
    text-transform: uppercase;
}

.responsive-table {
    max-width: 100%;
}

/* Botones de acción con ancho igual */
.action-btn {
    min-width: 140px;
}
</style>
