<template>
    <q-page padding>
        <!-- Encabezado -->
        <div class="row items-center q-mb-md">
            <div class="col">
                <div class="text-h5">
                    <q-icon name="business" class="q-mr-sm text-primary" />
                    Centros de Atención al Adulto Mayor
                </div>
                <div class="text-caption text-grey">
                    {{ centrosStore.centroCount }} centro(s) registrado(s)
                </div>
            </div>
            <div class="col-auto">
                <q-btn v-if="canCreate" icon="add" label="Nuevo Centro" color="primary" unelevated
                    @click="$router.push('/admin/centros/nuevo')" />
            </div>
        </div>

        <!-- Búsqueda y filtros -->
        <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-6 col-md-4">
                <q-input v-model="search" outlined dense clearable placeholder="Buscar por nombre, RIF o municipio..."
                    prepend-icon="search">
                    <template #prepend><q-icon name="search" /></template>
                </q-input>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
                <q-select v-model="filtroEstado" :options="opcionesEstado" option-value="value" option-label="label"
                    emit-value map-options outlined dense clearable label="Estado del centro" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
                <q-select v-model="filtroTipo" :options="opcionesTipo" option-value="value" option-label="label"
                    emit-value map-options outlined dense clearable label="Tipo de establecimiento" />
            </div>
        </div>

        <!-- Tabla de centros -->
        <q-table :rows="centrosFiltrados" :columns="columns" :loading="centrosStore.loading" row-key="id" flat bordered
            :rows-per-page-options="[10, 20, 50]" no-data-label="No hay centros registrados">
            <!-- Estado del centro -->
            <template #body-cell-estado_centro="{ value }">
                <q-td>
                    <q-badge :color="colorEstado(value)" :label="value" style="text-transform: capitalize" />
                </q-td>
            </template>

            <!-- Tipo -->
            <template #body-cell-tipo_establecimiento="{ value }">
                <q-td>{{ labelTipo(value) }}</q-td>
            </template>

            <!-- Acciones -->
            <template #body-cell-acciones="{ row }">
                <q-td class="q-gutter-xs">
                    <q-btn icon="visibility" color="primary" flat round dense title="Ver ficha"
                        @click="$router.push(`/admin/centros/${row.id}`)" />
                    <q-btn v-if="canEditRow(row)" icon="edit" color="secondary" flat round dense title="Editar"
                        @click="$router.push(`/admin/centros/${row.id}/editar`)" />
                    <q-btn v-if="canDeleteRow(row)" icon="delete" color="negative" flat round dense title="Eliminar"
                        @click="confirmarEliminar(row)" />
                </q-td>
            </template>

        </q-table>

        <!-- Confirmar eliminación -->
        <q-dialog v-model="showDeleteDialog" persistent>
            <q-card style="min-width: 350px">
                <q-card-section class="row items-center q-pb-none">
                    <div class="text-h6">Eliminar Centro</div>
                    <q-space />
                    <q-btn icon="close" flat round dense v-close-popup />
                </q-card-section>
                <q-card-section>
                    ¿Confirmas que deseas eliminar <strong>{{ centroAEliminar?.nombre_establecimiento }}</strong>?
                    Esta acción es un borrado lógico y puede revertirse.
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cancelar" v-close-popup />
                    <q-btn color="negative" label="Eliminar" @click="eliminarCentro" :loading="centrosStore.loading" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { LocalStorage } from 'quasar';
import { useCentrosStore } from 'src/stores/centros.store';
import { useCatalogosStore } from 'src/stores/catalogos.store';

const centrosStore = useCentrosStore();
const catalogosStore = useCatalogosStore();

// Búsqueda y filtros
const search = ref('');
const filtroEstado = ref(null);
const filtroTipo = ref(null);
const showDeleteDialog = ref(false);
const centroAEliminar = ref(null);

// Permisos — LocalStorage guarda [{name: 'permiso'}, ...]
const permisos = LocalStorage.getItem('permissions') || [];
const role = (LocalStorage.getItem('role') || '').toLowerCase();
const isAdmin = computed(() => ['admin', 'administrador', 'administrator'].includes(role));

function hasPerm(p) { return isAdmin.value || permisos.some(x => x.name === p); }

const canCreate = computed(() => hasPerm('create_centro'));

// Estos ahora se verifican por nivel de acceso al registro específico
function canEditRow(row) {
    if (isAdmin.value) return true;
    return ['write', 'admin'].includes(row.access_level);
}
function canDeleteRow(row) {
    if (isAdmin.value) return true;
    return row.access_level === 'admin';
}

// Opciones de filtro
const opcionesEstado = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'suspendido', label: 'Suspendido' },
];

const opcionesTipo = computed(() => catalogosStore.opcionesTipoEstab);

// Columnas
const columns = [
    { name: 'nombre_establecimiento', label: 'Nombre', field: 'nombre_establecimiento', align: 'left', sortable: true },
    { name: 'nro_registro_nacional', label: 'Nro. Registro', field: 'nro_registro_nacional', align: 'center' },
    { name: 'tipo_establecimiento', label: 'Tipo', field: 'tipo_establecimiento', align: 'center', sortable: true },
    { name: 'municipio', label: 'Municipio', field: 'municipio', align: 'left', sortable: true },
    { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
    { name: 'estado_centro', label: 'Estatus', field: 'estado_centro', align: 'center' },
    { name: 'acciones', label: 'Acciones', field: 'acciones', align: 'center' },
];

// Centros filtrados
const centrosFiltrados = computed(() => {
    let rows = centrosStore.centros;

    if (search.value) {
        const q = search.value.toLowerCase();
        rows = rows.filter(c =>
            c.nombre_establecimiento?.toLowerCase().includes(q) ||
            c.nro_registro_nacional?.toLowerCase().includes(q) ||
            c.municipio?.toLowerCase().includes(q) ||
            c.rif?.toLowerCase().includes(q)
        );
    }

    if (filtroEstado.value) rows = rows.filter(c => c.estado_centro === filtroEstado.value);
    if (filtroTipo.value) rows = rows.filter(c => c.tipo_establecimiento === filtroTipo.value);

    return rows;
});

// Helpers
function colorEstado(estado) {
    return { activo: 'positive', inactivo: 'grey', suspendido: 'negative' }[estado] || 'grey';
}

function labelTipo(tipo) {
    return (opcionesTipo.value || []).find(o => o.value === tipo)?.label || tipo || '—';
}

function confirmarEliminar(row) {
    centroAEliminar.value = row;
    showDeleteDialog.value = true;
}

async function eliminarCentro() {
    await centrosStore.deleteCentro(centroAEliminar.value.id);
    showDeleteDialog.value = false;
}

onMounted(() => {
    centrosStore.fetchCentros();
    catalogosStore.fetchAll();
});
</script>
