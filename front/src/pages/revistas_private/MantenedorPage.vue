<template>
  <div class="q-pa-md">
    <h4 class="q-mb-md">MANTENEDOR DE REVISTAS</h4>

    <q-table title="Lista de Revistas" :rows="filteredJournals" :columns="columns" :rows-per-page-options="[10, 20, 50]"
      row-key="id" :pagination="pagination" :loading="loading" virtual-scroll class="responsive-table">
      <!-- Búsqueda general y botón borrar filtros -->
      <template v-slot:top>
        <!-- Primera fila: Búsqueda general y botón borrar filtros -->
        <div class="full-width row wrap items-center q-mb-md">
          <!-- Búsqueda general -->
          <div class="col-xs-10 col-sm-5 q-pr-xs">
            <q-input outlined dense debounce="300" v-model="searchQuery" label="Búsqueda general"
              placeholder="Buscar en todos los campos">
              <template v-slot:append>
                <q-icon v-if="searchQuery" name="clear" @click.stop="clearSearch" class="cursor-pointer" size="sm" />
              </template>
            </q-input>
          </div>

          <!-- Botón "Borrar todos los filtros" -->
          <div class="col-xs-2 col-sm-1">
            <q-btn icon="fas fa-trash" title="Borrar todos los filtros" @click="clearAllFilters" color="negative" flat
              size="sm" class="full-width" />
          </div>
        </div>

        <!-- Segunda fila: Filtros para las columnas + Botones de acción -->
        <div class="full-width row wrap justify-between items-center content-center q-mb-md">
          <div class="col-xs-12 col-sm-6 col-md-3 q-pa-sm" v-for="col in columns" :key="col.name">
            <div v-if="col.filterable">
              <div v-if="col.type === 'select'">
                <q-select :model-value="filters[col.name]" @update:model-value="(val) => updateFilter(col.name, val)"
                  :options="getOptions(col.name)" :label="col.label" multiple outlined dense use-chips clearable>
                  <template v-slot:append>
                    <q-icon v-if="filters[col.name] && filters[col.name].length > 0" name="clear"
                      @click.stop="clearFilter(col.name)" class="cursor-pointer" size="sm" />
                  </template>
                </q-select>
              </div>
              <div v-else>
                <q-input :model-value="filters[col.name]" @update:model-value="(val) => updateFilter(col.name, val)"
                  :label="col.label" placeholder="Filtrar" outlined dense debounce="300">
                  <template v-slot:append>
                    <q-icon v-if="filters[col.name]" name="clear" @click.stop="clearFilter(col.name)"
                      class="cursor-pointer" size="sm" />
                  </template>
                </q-input>
              </div>
            </div>
          </div>
          <!-- Botones de acción alineados a la derecha -->
          <div class="col-xs-12 col-sm-6 col-md-3 q-pa-sm row justify-end no-wrap items-center">
            <q-btn v-if="isAdmin() || hasPermission('create_revista')" icon="add" color="primary" label="Nuevo"
              @click="openNewModal" class="action-btn q-mr-sm" />
            <q-btn-dropdown color="secondary" label="Exportar" icon="file_download" class="action-btn">
              <q-list>
                <q-item clickable v-close-popup @click="exportExcel">
                  <q-item-section avatar><q-icon name="mdi-file-excel" color="green" /></q-item-section>
                  <q-item-section>Excel</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="exportCSV">
                  <q-item-section avatar><q-icon name="mdi-file-delimited" color="blue" /></q-item-section>
                  <q-item-section>CSV</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="exportJSON">
                  <q-item-section avatar><q-icon name="mdi-code-json" color="orange" /></q-item-section>
                  <q-item-section>JSON</q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>
      </template>

      <!-- Botones de acción en cada fila -->
      <template v-slot:body-cell-actions="props">
        <q-td>
          <div class="row items-center no-wrap">
            <!-- Botón Editar -->
            <q-btn v-if="isAdmin() || hasPermission('update_revista')" icon="edit" color="primary" size="sm" flat round
              @click.stop="openEditModal(props.row)">
              <q-tooltip>Editar revista</q-tooltip>
            </q-btn>

            <!-- Botón Ver -->
            <q-btn icon="visibility" color="positive" size="sm" flat round
              @click.stop="() => openViewModalFn(props.row)">
              <q-tooltip>Ver revista</q-tooltip>
            </q-btn>

            <!-- Botón Borrar -->
            <q-btn v-if="isAdmin() || hasPermission('delete_revista')" icon="delete" color="negative" size="sm" flat
              round @click.stop="() => deleteRevista(props.row)">
              <q-tooltip>Eliminar revista</q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>

      <!-- Estado de carga -->
      <template v-slot:loading>
        <q-inner-loading showing color="primary" />
      </template>
    </q-table>
    <!-- Componente Modal -->
    <RevistaModal v-model="editDialog" :editForm="editForm" :isEditing="isEditing" :optionsu="optionsu"
      :imagePreview="imagePreview" :imageFile="imageFile" @save="saveChanges" @close="closeEditModal"
      @update:imageFile="val => imageFile = val" @update:imagePreview="val => imagePreview = val" />
    <RevistaViewModal v-model="viewDialog" :revista="selectedRevista" :imageBaseUrl="imageBaseUrl"
      @close="closeViewModal" />
  </div>
</template>

<script setup>
import { exportToExcel, exportToCSV, exportToJSON } from 'src/helpers/exportHelpers';
import Swal from 'sweetalert2';
// Generar timestamp para nombre de archivo
function getTimestamp() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getExportFilename(ext) {
  return `${getTimestamp()}_directorio_revistas_cientificas_venezolanas.${ext}`;
}

function getExportData() {
  // filteredJournals es un computed, convertir a array plano
  return filteredJournals.value.map(j => ({ ...j }));
}

function exportExcel() {
  exportToExcel(getExportData(), getExportFilename('xlsx').replace('.xlsx', ''));
}
function exportCSV() {
  exportToCSV(getExportData(), getExportFilename('csv').replace('.csv', ''));
}
function exportJSON() {
  exportToJSON(getExportData(), getExportFilename('json').replace('.json', ''));
}
import RevistaModal from 'src/components/RevistaModal.vue';
import RevistaViewModal from 'src/components/RevistaViewModal.vue';
import { ref, onMounted, computed, watch } from "vue";
import { LocalStorage, Notify } from "quasar";
import axios from "axios";
const imageFile = ref(null);
const imagePreview = ref(null);
const uploadingImage = ref(false);
const imageBaseUrl = import.meta.env.VITE_IMAGE_BASE_URL;
// Definición de columnas para la tabla
const columns = [
  { name: "actions", label: "Acciones", align: "left" },
  {
    name: "id",
    label: "ID",
    field: "id",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "revista",
    label: "Revista",
    field: "revista",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "area_conocimiento",
    label: "Área de Conocimiento",
    field: "area_conocimiento",
    sortable: true,
    filterable: true,
    align: "left",
    type: "select",
  },
  {
    name: "idioma",
    label: "Idioma",
    field: "idioma",
    sortable: true,
    filterable: true,
    align: "left",
    type: "select",
  },
  {
    name: "editorial",
    label: "Editorial",
    field: "editorial",
    sortable: true,
    filterable: true,
    align: "left",
    type: "select",
  },
  {
    name: "estado",
    label: "Estado",
    field: "estado",
    sortable: true,
    filterable: true,
    align: "left",
    type: "select",
  },
  {
    name: "indice",
    label: "Índice",
    field: "indice",
    sortable: true,
    filterable: true,
    align: "left",
    type: "select",
  },
  {
    name: "deposito_legal_impreso",
    label: "Depósito Legal Impreso",
    field: "deposito_legal_impreso",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "deposito_legal_digital",
    label: "Depósito Legal Digital",
    field: "deposito_legal_digital",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "issn_impreso",
    label: "ISSN Impreso",
    field: "issn_impreso",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "issn_digital",
    label: "ISSN Digital",
    field: "issn_digital",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
  {
    name: "anio_inicial",
    label: "Año Inicial",
    field: "anio_inicial",
    sortable: true,
    filterable: true,
    align: "left",
    type: "text",
  },
];

// URLs de los endpoints
const apiURL = import.meta.env.VITE_API_URL;
const areasURL = import.meta.env.VITE_AREASR_BASE_URL;
const idiomasURL = import.meta.env.VITE_IDIOMASR_BASE_URL;
const editorialesURL = import.meta.env.VITE_EDITORIALR_BASE_URL;
const estadosURL = import.meta.env.VITE_ESTADOR_BASE_URL;
const indicesURL = import.meta.env.VITE_INDICESR_BASE_URL;
const periodicidadURL = import.meta.env.VITE_PERIODICIDADR_BASE_URL;
const formatosURL = import.meta.env.VITE_FORMATOR_BASE_URL;
const revistaDetailURL = import.meta.env.VITE_REVISTA_URL;
const updateURL = import.meta.env.VITE_RV_UPDATE_URL;
const insertURL = import.meta.env.VITE_RV_INSERT_URL;
const insertWithUploadURL = import.meta.env.VITE_RV_INSERT_WITH_UPLOAD_URL;
const deleteUrl = import.meta.env.VITE_RV_DELETE_URL;

const areasLsURL = import.meta.env.VITE_LS_AREAS_URL;
const idiomasLsURL = import.meta.env.VITE_LS_IDIOMAS_URL;
const editorialesLsURL = import.meta.env.VITE_LS_EDITORIALES_URL;
const estadosLsURL = import.meta.env.VITE_LS_ESTADOS_URL;
const indicesLsURL = import.meta.env.VITE_LS_INDICES_URL;
const periodicidadLsURL = import.meta.env.VITE_LS_PERIODICIDAD_URL;
const formatosLsURL = import.meta.env.VITE_LS_FORMATOS_URL;

// Estado de la aplicación
const journals = ref([]);
const loading = ref(true);
const pagination = ref({
  sortBy: "desc",
  descending: false,
  page: 1,
  rowsPerPage: 10,
});

// Búsqueda general
const searchQuery = ref("");

// Filtros para las columnas
const filters = ref({
  area_conocimiento: null,
  idioma: null,
  editorial: null,
  estado: null,
  indice: null,
});

// Opciones para los select
const options = ref({
  area_conocimiento: [],
  idioma: [],
  editorial: [],
  estado: [],
  indice: [],
});
const optionsu = ref({
  area_conocimiento: [],
  idioma: [],
  editorial: [],
  estado: [],
  indice: [],
  periodicidad: [],
  formato: [],
});

// Opciones adicionales
const periodicidadOptions = ref([]);
const formatoOptions = ref([]);

// Estado del modal de edición
const editDialog = ref(false);
const viewDialog = ref(false);
const selectedRevista = ref(null);
const editForm = ref({});

// Función para obtener los datos de las revistas
const fetchJournals = async () => {
  try {
    const response = await axios.get(apiURL);
    journals.value = response.data;
  } catch (error) {
    console.error("Error al obtener las revistas:", error);
  } finally {
    loading.value = false;
  }
};

// Función para obtener las opciones de los filtros
const fetchOptions = async () => {
  try {
    const areasResponse = await axios.get(areasURL);
    options.value.area_conocimiento = areasResponse.data.map(
      (item) => item.area_conocimiento
    );
    const areasResponseU = await axios.get(areasLsURL);
    optionsu.value.area_conocimiento = areasResponseU.data.map((item) => ({
      label: item.area_conocimiento,
      value: item.id_area_conocimiento,
    }));

    // Obtener idiomas
    const idiomasResponse = await axios.get(idiomasURL);
    options.value.idioma = idiomasResponse.data.map((item) => item.idioma);
    const idiomasResponseU = await axios.get(idiomasLsURL);
    optionsu.value.idioma = idiomasResponseU.data.map((item) => ({
      label: item.idioma,
      value: item.id_idioma,
    }));
    // Obtener editoriales
    const editorialesResponse = await axios.get(editorialesURL);
    options.value.editorial = editorialesResponse.data.map(
      (item) => item.editorial
    );
    const editorialesResponseU = await axios.get(editorialesLsURL);
    optionsu.value.editorial = editorialesResponseU.data.map((item) => ({
      label: item.editorial,
      value: item.id_editorial,
    }));

    // Obtener estados
    const estadosResponse = await axios.get(estadosURL);
    options.value.estado = estadosResponse.data.map((item) => item.estado);
    const estadosResponseU = await axios.get(estadosLsURL);
    optionsu.value.estado = estadosResponseU.data.map((item) => ({
      label: item.estado,
      value: item.id,
    }));

    // Obtener índices
    const indicesResponse = await axios.get(indicesURL);
    options.value.indice = indicesResponse.data.map((item) => item.indice);
    const indicesResponseU = await axios.get(indicesLsURL);
    optionsu.value.indice = indicesResponseU.data.map((item) => ({
      label: item.indice,
      value: item.id_indice,
    }));

    // Obtener periodicidad
    const periodicidadResponse = await axios.get(periodicidadURL);
    periodicidadOptions.value = periodicidadResponse.data.map(
      (item) => item.periodicidad
    );
    const periodicidadResponseU = await axios.get(periodicidadLsURL);
    optionsu.value.periodicidad = periodicidadResponseU.data.map((item) => ({
      label: item.periodicidad,
      value: item.id_periodicidad,
    }));

    // Obtener formatos
    const formatoResponse = await axios.get(formatosURL);
    formatoOptions.value = formatoResponse.data.map((item) => item.formato);
    const formatoResponseU = await axios.get(formatosLsURL);
    optionsu.value.formato = formatoResponseU.data.map((item) => ({
      label: item.formato,
      value: item.id_formato,
    }));
  } catch (error) {
    console.error("Error al obtener las opciones de los filtros:", error);
  }
};

// Actualizar los filtros
const updateFilter = (key, value) => {
  filters.value[key] = value;
};

// Borrar un filtro específico
const clearFilter = (filterName) => {
  filters.value[filterName] = null;
};

// Borrar todos los filtros
const clearAllFilters = () => {
  for (const filter in filters.value) {
    filters.value[filter] = null;
  }
  searchQuery.value = "";
};

// Borrar la búsqueda general
const clearSearch = () => {
  searchQuery.value = "";
};

// Obtener las opciones para un filtro select
const getOptions = (filterName) => {
  return options.value[filterName] || [];
};

// Calcular la lista de revistas filtradas
const filteredJournals = computed(() => {
  // Primero filtrar por búsqueda general
  const searchValue = searchQuery.value.toLowerCase();
  let searchedJournals = journals.value.filter((journal) => {
    // Buscar en todos los campos de las columnas filtrables
    return columns
      .filter((col) => col.filterable)
      .some((col) => {
        const journalValue =
          journal[col.field]?.toString()?.toLowerCase() || "";
        return journalValue.includes(searchValue);
      });
  });

  // Luego aplicar los filtros por columna
  return searchedJournals.filter((journal) => {
    return columns
      .filter((col) => col.filterable)
      .every((col) => {
        // Para filtros de tipo select
        if (
          col.type === "select" &&
          filters.value[col.name] &&
          filters.value[col.name].length > 0
        ) {
          return filters.value[col.name].includes(journal[col.field]);
        }

        // Para otros tipos de filtros
        const filterValue = filters.value[col.name]?.toLowerCase() || "";
        const journalValue =
          journal[col.field]?.toString()?.toLowerCase() || "";
        return journalValue.includes(filterValue);
      });
  });
});
const isEditing = ref(false);
// Función para abrir el modal de creación!
const openNewModal = () => {
  editForm.value = {
    // Inicializa todos los campos necesarios
    id: null,
    revista: "",
    area_conocimiento: null,
    indice: null,
    idioma: null,
    correo_revista: "",
    editorial: null,
    periodicidad: null,
    formato: null,
    estado: null,
    ciudad: "",
    nombres_editor: "",
    apellidos_editor: "",
    correo_editor: "",
    deposito_legal_impreso: "",
    deposito_legal_digital: "",
    issn_impreso: "",
    issn_digital: "",
    url: "",
    anio_inicial: "",
    direccion: "",
    telefono: "",
    resumen: "",
    portada: null,
  };
  imagePreview.value = null;
  imageFile.value = null;
  isEditing.value = false;
  editDialog.value = true;
};
////////////Upload portada/////////////
const handleImageUpload = (file) => {
  if (file) {
    // Verificar que sea JPG o PNG
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      Notify.create({
        type: "negative",
        message: "Solo se permiten archivos JPG o PNG",
      });
      imageFile.value = null;
      imagePreview.value = null;
      return;
    }

    // Validar tamaño de archivo (max 2MB)
    const maxSizeMB = 2;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      Notify.create({
        type: "negative",
        message: `El archivo es demasiado grande. Máximo permitido: ${maxSizeMB}MB (tu archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        position: "top",
        timeout: 5000,
        icon: "warning"
      });
      imageFile.value = null;
      imagePreview.value = null;
      return;
    }

    // Crear previsualización
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    imagePreview.value = null;
  }
};

// Función para abrir el modal de edición
const openEditModal = async (journal) => {
  try {
    const response = await axios.get(`${revistaDetailURL}${journal.id}`);
    // Asignar los valores del backend y mapear los selects
    const data = response.data;
    editForm.value = {
      ...data,
      area_conocimiento: optionsu.value.area_conocimiento.find(opt => opt.value === data.area_conocimiento_id) || null,
      indice: optionsu.value.indice.find(opt => opt.value === data.indice_id) || null,
      idioma: optionsu.value.idioma.find(opt => opt.value === data.idioma_id) || null,
      editorial: optionsu.value.editorial.find(opt => opt.value === data.editorial_id) || null,
      periodicidad: optionsu.value.periodicidad.find(opt => opt.value === data.periodicidad_id) || null,
      formato: optionsu.value.formato.find(opt => opt.value === data.formato_id) || null,
      estado: optionsu.value.estado.find(opt => opt.value === data.estado_id) || null,
    };

    // Mostrar la imagen de portada usando VITE_IMAGE_BASE_URL y el nombre de portada
    if (editForm.value.portada) {
      imagePreview.value = `${import.meta.env.VITE_IMAGE_BASE_URL}${editForm.value.portada}?t=${Date.now()}`;
    } else {
      imagePreview.value = null;
    }

    editDialog.value = true;
    isEditing.value = true;
  } catch (error) {
    console.error("Error al obtener los datos de la revista:", error);
  }
};

// Función para cerrar el modal de edición
const closeEditModal = () => {
  editDialog.value = false;
};

// Función para guardar los cambios (recibe el formulario actualizado desde el modal)
const saveChanges = async (updatedForm, updatedImageFile) => {
  // 1. Validaciones
  if (!updatedForm.revista || !updatedForm.idioma) {
    Notify.create({ type: "negative", message: "Revista e Idioma son requeridos" });
    return;
  }

  // 2. Construir objeto de datos para PATCH (sin portadaFile)
  const patchData = {};
  const setIfDefined = (key, value) => {
    if (value !== null && value !== undefined) {
      patchData[key] = value;
    }
  };
  setIfDefined('area_conocimiento_id', updatedForm.area_conocimiento);
  setIfDefined('indice_id', updatedForm.indice);
  setIfDefined('idioma_id', updatedForm.idioma);
  setIfDefined('revista', updatedForm.revista);
  setIfDefined('correo_revista', updatedForm.correo_revista);
  setIfDefined('editorial_id', updatedForm.editorial);
  setIfDefined('periodicidad_id', updatedForm.periodicidad);
  setIfDefined('formato_id', updatedForm.formato);
  setIfDefined('estado_id', updatedForm.estado);
  setIfDefined('nombres_editor', updatedForm.nombres_editor);
  setIfDefined('apellidos_editor', updatedForm.apellidos_editor);
  setIfDefined('correo_editor', updatedForm.correo_editor);
  setIfDefined('deposito_legal_impreso', updatedForm.deposito_legal_impreso);
  setIfDefined('deposito_legal_digital', updatedForm.deposito_legal_digital);
  setIfDefined('issn_impreso', updatedForm.issn_impreso);
  setIfDefined('issn_digital', updatedForm.issn_digital);
  setIfDefined('url', updatedForm.url);
  setIfDefined('anio_inicial', updatedForm.anio_inicial);
  setIfDefined('direccion', updatedForm.direccion);
  setIfDefined('telefono', updatedForm.telefono);
  setIfDefined('resumen', updatedForm.resumen);

  try {
    if (isEditing.value) {
      await axios.patch(`${updateURL}${updatedForm.id}`, patchData);
      Notify.create({ type: "positive", message: "Cambios guardados correctamente." });

      // Si se seleccionó una nueva imagen durante la edición, subirla por separado
      if (updatedImageFile && updatedForm.id) {
        const imageFormData = new FormData();
        const file = Array.isArray(updatedImageFile) ? updatedImageFile[0] : updatedImageFile;
        imageFormData.append('portadaFile', file);
        await axios.post(`${import.meta.env.VITE_RV_UPLOAD_URL}/upload-portada/${updatedForm.id}`, imageFormData);
        Notify.create({ type: "positive", message: "Portada actualizada." });
      }

    } else {
      // Lógica de Creación (POST)
      // Una sola llamada que envía todo
      const formData = new FormData();
      const appendIfDefined = (key, value) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      };
      if (updatedImageFile) {
        const file = Array.isArray(updatedImageFile) ? updatedImageFile[0] : updatedImageFile;
        appendIfDefined('portadaFile', file);
      }
      // Log para debugging
      console.log('🔍 Datos del formulario antes de enviar:');
      console.log('  - area_conocimiento:', updatedForm.area_conocimiento);
      console.log('  - idioma:', updatedForm.idioma);

      // Campos obligatorios - siempre deben enviarse (ahora son valores directos, no objetos)
      formData.append('area_conocimiento_id', updatedForm.area_conocimiento || '');
      formData.append('idioma_id', updatedForm.idioma || '');

      // Campos opcionales (también son valores directos ahora)
      appendIfDefined('indice_id', updatedForm.indice);
      appendIfDefined('revista', updatedForm.revista);
      appendIfDefined('correo_revista', updatedForm.correo_revista);
      appendIfDefined('editorial_id', updatedForm.editorial);
      appendIfDefined('periodicidad_id', updatedForm.periodicidad);
      appendIfDefined('formato_id', updatedForm.formato);
      appendIfDefined('estado_id', updatedForm.estado);
      appendIfDefined('nombres_editor', updatedForm.nombres_editor);
      appendIfDefined('apellidos_editor', updatedForm.apellidos_editor);
      appendIfDefined('correo_editor', updatedForm.correo_editor);
      appendIfDefined('deposito_legal_impreso', updatedForm.deposito_legal_impreso);
      appendIfDefined('deposito_legal_digital', updatedForm.deposito_legal_digital);
      appendIfDefined('issn_impreso', updatedForm.issn_impreso);
      appendIfDefined('issn_digital', updatedForm.issn_digital);
      appendIfDefined('url', updatedForm.url);
      appendIfDefined('anio_inicial', updatedForm.anio_inicial);
      appendIfDefined('direccion', updatedForm.direccion);
      appendIfDefined('telefono', updatedForm.telefono);
      appendIfDefined('resumen', updatedForm.resumen);
      await axios.post(insertWithUploadURL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      Notify.create({ type: "positive", message: "Revista creada correctamente." });
    }

    await fetchJournals();
    closeEditModal();

  } catch (error) {
    console.error("Error al guardar la revista:", error);
    Notify.create({ type: "negative", message: error.response?.data?.error || "Error al guardar la revista" });
  }
};

// Funciones de permisos
const hasPermission = (permissionName) => {
  const permissions = LocalStorage.getItem('permissions') || []
  return permissions.some(p => p.name === permissionName)
}

const isAdmin = () => {
  const role = LocalStorage.getItem('role')
  return role && ['admin', 'administrador', 'administrator'].includes(role.toLowerCase())
}

// Eliminar revista con confirmación
const deleteRevista = async (row) => {
  const result = await Swal.fire({
    title: '¿Eliminar revista?',
    text: `¿Estás seguro de eliminar la revista "${row.revista}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });
  if (result.isConfirmed) {
    try {
      await axios.delete(`${deleteUrl}${row.id}`);
      await fetchJournals();
      Swal.fire('Eliminada', 'La revista ha sido eliminada.', 'success');
    } catch (error) {
      Swal.fire('Error', 'No se pudo eliminar la revista.', 'error');
    }
  }
};

// Definir función como variable para evitar problemas de contexto en slots
const openViewModalFn = (row) => {
  selectedRevista.value = { ...row };
  viewDialog.value = true;
};

// Observar cambios en la paginación
watch(pagination, () => { }, { deep: true });

// Obtener los datos al montar el componente
onMounted(async () => {
  if (!LocalStorage.getItem("token")) {
    router.push("/login");
  }
  await fetchOptions();
  fetchJournals();
});
</script>

<style scoped>
.responsive-table {
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 600px) {
  .export-btns-group {
    flex-direction: column !important;
    align-items: stretch !important;
  }

  .add-btn-responsive {
    width: 100% !important;
    margin-right: 0 !important;
    margin-bottom: 8px !important;
  }

  .export-btns-responsive {
    width: 100% !important;
    margin: 0 !important;
    flex-wrap: nowrap !important;
    justify-content: stretch !important;
  }

  .export-btns-responsive .export-btn-desktop {
    width: 100% !important;
    min-width: 0 !important;
    margin-right: 0 !important;
    margin-bottom: 0 !important;
  }
}

@media (min-width: 601px) {
  .export-btns-group {
    flex-direction: row !important;
    align-items: center !important;
  }

  .add-btn-responsive {
    width: auto !important;
    margin-bottom: 0 !important;
    margin-right: 12px !important;
  }

  .export-btns-responsive {
    flex-direction: row !important;
    width: auto !important;
    margin-top: 0 !important;
  }

  .export-btns-responsive .export-btn-desktop {
    width: 36px !important;
    min-width: 36px !important;
    margin-right: 8px !important;
    margin-bottom: 0 !important;
  }

  .export-btns-responsive .export-btn-desktop:last-child {
    margin-right: 0 !important;
  }
}

@media (max-width: 768px) {
  .responsive-table {
    overflow-x: scroll;
  }
}

/* Botones de acción con ancho igual */
.action-btn {
  min-width: 140px;
}
</style>
