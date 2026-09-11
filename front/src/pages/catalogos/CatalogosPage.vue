<template>
  <q-page padding class="q-pa-md q-pa-lg-xl">
    <!-- Encabezado de página -->
    <div class="row items-center justify-between q-mb-md">
      <div class="row items-center q-gutter-sm">
        <q-icon :name="currentCatalogMeta?.icon || 'category'" size="36px" color="primary" />
        <div>
          <div class="text-h5 text-weight-bold text-primary">
            {{ currentCatalogMeta?.label || 'Catálogos del Sistema' }}
          </div>
          <div class="text-caption text-grey-7">
            {{ currentCatalogMeta?.description || 'Administración de catálogos y tablas maestras' }}
          </div>
        </div>
      </div>

      <!-- Acciones de cabecera -->
      <div class="row q-gutter-sm">
        <q-btn
          flat
          round
          dense
          icon="refresh"
          color="primary"
          :loading="loading"
          @click="fetchData"
        >
          <q-tooltip>Actualizar listado</q-tooltip>
        </q-btn>

        <q-btn
          v-if="canCreate"
          unelevated
          color="primary"
          icon="add"
          label="Nuevo Registro"
          @click="openCreateModal"
        />
      </div>
    </div>

    <!-- Pestañas rápidas de selección de catálogo -->
    <q-card flat bordered class="q-mb-md bg-grey-1">
      <q-tabs
        v-model="activeCatalog"
        dense
        class="text-grey-8"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
        inline-label
        outside-arrows
        mobile-arrows
        @update:model-value="onCatalogChange"
      >
        <q-tab
          v-for="cat in availableCatalogs"
          :key="cat.key"
          :name="cat.key"
          :icon="cat.icon"
          :label="cat.label"
        />
      </q-tabs>
    </q-card>

    <!-- Tabla principal -->
    <q-card flat bordered>
      <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        :rows="rows"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :filter="searchFilter"
        binary-state-sort
        @request="onRequest"
      >
        <!-- Barra de herramientas superior -->
        <template v-slot:top>
          <div class="row full-width items-center justify-between q-col-gutter-sm">
            <q-space />

            <!-- Búsqueda rápida -->
            <div class="col-12 col-sm-5 col-md-4">
              <q-input
                v-model="searchFilter"
                dense
                outlined
                debounce="300"
                placeholder="Buscar registros..."
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
          </div>
        </template>

        <!-- Celda de Estado (Activo / Inactivo) -->
        <template v-slot:body-cell-activo="props">
          <q-td :props="props" class="text-center">
            <q-badge
              :color="props.row.activo ? 'positive' : 'grey-6'"
              :label="props.row.activo ? 'Activo' : 'Inactivo'"
              class="q-px-sm q-py-xs text-weight-medium"
            />
          </q-td>
        </template>

        <!-- Celda de Acciones -->
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" class="text-center">
            <div class="row items-center justify-center no-wrap q-gutter-xs">
              <q-btn
                v-if="canEdit"
                flat
                round
                dense
                color="primary"
                icon="edit"
                size="sm"
                @click="openEditModal(props.row)"
              >
                <q-tooltip>Editar registro</q-tooltip>
              </q-btn>

              <q-btn
                v-if="canDelete"
                flat
                round
                dense
                color="negative"
                icon="delete"
                size="sm"
                @click="confirmDelete(props.row)"
              >
                <q-tooltip>Eliminar registro</q-tooltip>
              </q-btn>
            </div>
          </q-td>
        </template>

        <!-- Estado vacío -->
        <template v-slot:no-data>
          <div class="full-width row flex-center text-grey-7 q-py-lg">
            <q-icon name="sentiment_dissatisfied" size="32px" class="q-mr-sm" />
            <span>No se encontraron registros en este catálogo.</span>
          </div>
        </template>
      </q-table>
    </q-card>

    <!-- Modal Formulario (Crear / Editar) -->
    <q-dialog v-model="modalOpen" persistent>
      <q-card style="min-width: 420px; max-width: 600px; width: 100%;">
        <q-toolbar class="bg-primary text-white">
          <q-icon :name="currentCatalogMeta?.icon || 'edit'" size="sm" class="q-mr-sm" />
          <q-toolbar-title class="text-subtitle1 text-weight-bold">
            {{ isEditing ? 'Editar Registro' : 'Nuevo Registro' }} — {{ currentCatalogMeta?.label }}
          </q-toolbar-title>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-toolbar>

        <q-form @submit.prevent="saveRecord">
          <q-card-section class="q-pt-md q-gutter-md">
            <!-- Código -->
            <div v-if="hasField('codigo')">
              <q-input
                v-model="formData.codigo"
                label="Código *"
                outlined
                dense
                :disable="isEditing"
                :rules="[val => !!val && val.trim().length > 0 || 'El código es obligatorio']"
              />
            </div>

            <!-- Nombre -->
            <div v-if="hasField('nombre')">
              <q-input
                v-model="formData.nombre"
                label="Nombre *"
                outlined
                dense
                :rules="[val => !!val && val.trim().length > 0 || 'El nombre es obligatorio']"
              />
            </div>

            <!-- Categoría (para servicios) -->
            <div v-if="hasField('categoria')">
              <q-input
                v-model="formData.categoria"
                label="Categoría"
                outlined
                dense
              />
            </div>

            <!-- Descripción -->
            <div v-if="hasField('descripcion')">
              <q-input
                v-model="formData.descripcion"
                label="Descripción"
                type="textarea"
                rows="3"
                outlined
                dense
              />
            </div>

            <!-- Estado Activo -->
            <div class="row items-center justify-between q-mt-sm">
              <span class="text-body2 text-grey-8">¿Registro activo para su uso en el sistema?</span>
              <q-toggle
                v-model="formData.activo"
                color="positive"
                :label="formData.activo ? 'Activo' : 'Inactivo'"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md bg-grey-1">
            <q-btn flat label="Cancelar" color="grey-7" v-close-popup />
            <q-btn
              unelevated
              type="submit"
              color="primary"
              icon="save"
              label="Guardar"
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Notify, Dialog } from 'quasar';
import { catalogosService } from 'src/services/catalogos.service';
import { usePermissionsSocket } from 'src/composables/usePermissionsSocket';
import { useCatalogosStore } from 'src/stores/catalogos.store';

const route = useRoute();
const router = useRouter();
const { hasPermission, isAdmin } = usePermissionsSocket();
const catalogosStore = useCatalogosStore();

// Metadatos de catálogos
const catalogsMeta = ref([]);
const activeCatalog = ref(route.params.catalogo || 'tipos_establecimiento');
const rows = ref([]);
const loading = ref(false);
const searchFilter = ref('');

// Tabla y Paginación
const pagination = ref({
  page: 1,
  rowsPerPage: 20,
  rowsNumber: 0,
  sortBy: null,
  descending: false
});

// Modal y Formulario
const modalOpen = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const editingId = ref(null);
const formData = ref({});

// Catálogo actual
const currentCatalogMeta = computed(() => {
  return catalogsMeta.value.find(c => c.key === activeCatalog.value) || null;
});

// Catálogos accesibles según permisos del usuario
const availableCatalogs = computed(() => {
  if (isAdmin()) return catalogsMeta.value;
  return catalogsMeta.value.filter(cat => {
    return hasPermission(`view_${cat.key}`) || hasPermission(`view_${cat.resource || cat.key}`);
  });
});

// Permisos para el catálogo actual
const canCreate = computed(() => {
  if (isAdmin()) return true;
  const key = activeCatalog.value;
  return hasPermission(`create_${key}`);
});

const canEdit = computed(() => {
  if (isAdmin()) return true;
  const key = activeCatalog.value;
  return hasPermission(`edit_${key}`) || hasPermission(`update_${key}`);
});

const canDelete = computed(() => {
  if (isAdmin()) return true;
  const key = activeCatalog.value;
  return hasPermission(`delete_${key}`);
});

// Columnas de la tabla
const columns = computed(() => {
  return currentCatalogMeta.value?.columns || [];
});

function hasField(fieldName) {
  return currentCatalogMeta.value?.fields?.includes(fieldName);
}

// Cargar metadatos iniciales
async function loadMeta() {
  try {
    const { data } = await catalogosService.getMeta();
    catalogsMeta.value = data;

    // Si la ruta trae un catálogo y el usuario tiene acceso, seleccionarlo
    const routeCat = route.params.catalogo;
    if (routeCat && catalogsMeta.value.some(c => c.key === routeCat)) {
      activeCatalog.value = routeCat;
    } else if (availableCatalogs.value.length > 0) {
      activeCatalog.value = availableCatalogs.value[0].key;
    }
  } catch (err) {
    console.error('Error al cargar metadatos de catálogos:', err);
    Notify.create({ type: 'negative', message: 'Error al inicializar catálogo.' });
  }
}

// Cargar registros con filtros y paginación
async function fetchData() {
  if (!activeCatalog.value) return;

  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      search: searchFilter.value || '',
      sort_by: pagination.value.sortBy,
      descending: pagination.value.descending
    };

    const { data } = await catalogosService.list(activeCatalog.value, params);

    rows.value = data.data || [];
    pagination.value.rowsNumber = data.total || 0;
  } catch (err) {
    console.error('Error al cargar datos del catálogo:', err);
    if (err.response?.status === 403) {
      Notify.create({ type: 'negative', message: 'No tienes permiso para ver este catálogo.' });
    } else {
      Notify.create({ type: 'negative', message: err.response?.data?.error || 'Error al cargar registros.' });
    }
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function onCatalogChange(newCat) {
  router.push(`/admin/catalogos/${newCat}`);
  pagination.value.page = 1;
  searchFilter.value = '';
  fetchData();
}

function onRequest(props) {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;
  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.descending = descending;
  fetchData();
}

// ── Modales y Operaciones ──────────────────────────────────────────────────
function openCreateModal() {
  isEditing.value = false;
  editingId.value = null;
  formData.value = {
    activo: true
  };
  modalOpen.value = true;
}

function openEditModal(row) {
  isEditing.value = true;
  editingId.value = row.id;
  formData.value = { ...row };
  modalOpen.value = true;
}

async function saveRecord() {
  saving.value = true;
  const currentCat = activeCatalog.value;
  try {
    if (isEditing.value) {
      await catalogosService.update(currentCat, editingId.value, formData.value);
      Notify.create({ type: 'positive', message: 'Registro actualizado exitosamente.' });
    } else {
      await catalogosService.create(currentCat, formData.value);
      Notify.create({ type: 'positive', message: 'Registro creado exitosamente.' });
    }
    modalOpen.value = false;
    fetchData();
    // Actualización local inmediata en stores y evento para vistas activas
    catalogosStore.fetchCatalog(currentCat);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalogs-updated', { detail: { catalog: currentCat } }));
    }
  } catch (err) {
    console.error('Error al guardar registro:', err);
    Notify.create({
      type: 'negative',
      message: err.response?.data?.error || 'Error al procesar la solicitud.'
    });
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row) {
  const currentCat = activeCatalog.value;
  Dialog.create({
    title: 'Confirmar Eliminación',
    message: `¿Estás seguro de que deseas eliminar "${row.nombre || row.codigo}"? Se realizará un borrado lógico en el sistema.`,
    cancel: { label: 'Cancelar', flat: true, color: 'grey-8' },
    ok: { label: 'Eliminar', color: 'negative', unelevated: true },
    persistent: true
  }).onOk(async () => {
    try {
      await catalogosService.delete(currentCat, row.id);
      Notify.create({ type: 'positive', message: 'Registro eliminado exitosamente.' });
      fetchData();
      // Actualización local inmediata en stores y evento para vistas activas
      catalogosStore.fetchCatalog(currentCat);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('catalogs-updated', { detail: { catalog: currentCat } }));
      }
    } catch (err) {
      console.error('Error al eliminar registro:', err);
      Notify.create({
        type: 'negative',
        message: err.response?.data?.error || 'No se pudo eliminar el registro.'
      });
    }
  });
}

// Observar cambio de ruta
watch(
  () => route.params.catalogo,
  (newParam) => {
    if (newParam && newParam !== activeCatalog.value) {
      activeCatalog.value = newParam;
      fetchData();
    }
  }
);

onMounted(async () => {
  await loadMeta();
  await fetchData();
});
</script>

<style scoped>
.q-tab {
  text-transform: none;
  font-weight: 500;
}
</style>
