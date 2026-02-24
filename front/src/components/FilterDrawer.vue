<template>
  <div class="column">
    <!-- Botón para abrir/cerrar el drawer -->
    <q-btn flat dense round icon="filter_alt" v-if="!drawerVisible" @click="toggleDrawer(true)" class="drawer-toggle-btn" title="Abrir filtros" />

    <q-drawer v-model="drawerVisible" side="left" bordered :width="300" :breakpoint="700" behavior="mobile">
      <div class="column">
        <!-- Drawer Header -->
        <div class="drawer-header row items-center justify-between">
          <div class="drawer-title">Filtros</div>
          <!--  -->
          <div>
            <q-btn flat dense round icon="delete_sweep" color="negative" @click="clearAllFilters"
              title="Limpiar todos los filtros" class="q-mr-sm" />
            <q-btn flat dense round icon="close" @click="toggleDrawer(false)" title="Cerrar filtros" />
          </div>
          <!--  -->
        </div>

        <!-- Filtros -->
        <div class="filters-container">
          <q-input v-model="localFilters.revista" label="Revista" dense outlined clearable
            @clear="clearFilter('revista')" class="filter-item" />

          <q-select v-model="localFilters.area_conocimiento" label="Área de Conocimiento" :options="filteredAreas" dense
            outlined clearable emit-value map-options use-input multiple @filter="filterAreas"
            @clear="clearFilter('area_conocimiento')" class="filter-item" />

          <q-select v-model="localFilters.indice" label="Índice" :options="filteredIndices" dense outlined clearable
            emit-value map-options use-input multiple @filter="filterIndices" @clear="clearFilter('indice')"
            class="filter-item" />

          <q-select v-model="localFilters.idioma" label="Idiomas" :options="filteredIdiomas" dense outlined clearable
            emit-value map-options use-input multiple @filter="filterIdiomas" @clear="clearFilter('idioma')"
            class="filter-item" />

          <q-select v-model="localFilters.editorial" label="Editoriales" :options="filteredEditoriales" dense outlined
            clearable emit-value map-options use-input multiple @filter="filterEditoriales"
            @clear="clearFilter('editorial')" class="filter-item" />

          <q-select v-model="localFilters.periodicidad" label="Periodicidad" :options="filteredPeriodicidades" dense
            outlined clearable emit-value map-options use-input multiple @filter="filterPeriodicidades"
            @clear="clearFilter('periodicidad')" class="filter-item" />

          <q-select v-model="localFilters.formato" label="Formato" :options="filteredFormatos" dense outlined clearable
            emit-value map-options use-input multiple @filter="filterFormatos" @clear="clearFilter('formato')"
            class="filter-item" />

          <q-select v-model="localFilters.estado" label="Estado" :options="filteredEstados" dense outlined clearable
            emit-value map-options use-input multiple @filter="filterEstados" @clear="clearFilter('estado')"
            class="filter-item" />

          <q-input v-model="localFilters.issn_digital" label="ISSN Digital" dense outlined clearable
            @clear="clearFilter('issn_digital')" class="filter-item" />

          <q-input v-model="localFilters.issn_impreso" label="ISSN Impreso" dense outlined clearable
            @clear="clearFilter('issn_impreso')" class="filter-item" />

          <q-input v-model="localFilters.deposito_legal_digital" label="Depósito Legal Digital" dense outlined clearable
            @clear="clearFilter('deposito_legal_digital')" class="filter-item" />

          <q-input v-model="localFilters.deposito_legal_impreso" label="Depósito Legal Impreso" dense outlined clearable
            @clear="clearFilter('deposito_legal_impreso')" class="filter-item" />
        </div>
      </div>
    </q-drawer>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  filters: {
    type: Object,
    required: true
  },
  areasConocimiento: {
    type: Array,
    default: () => []
  },
  revistasIndices: {
    type: Array,
    default: () => []
  },
  revistasIdiomas: {
    type: Array,
    default: () => []
  },
  revistasEditorial: {
    type: Array,
    default: () => []
  },
  revistasPeriodicidad: {
    type: Array,
    default: () => []
  },
  revistasFormato: {
    type: Array,
    default: () => []
  },
  revistasEstado: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'filter-changed']);

// Estado local del drawer
const drawerVisible = ref(props.modelValue);

// Copia local de los filtros
const localFilters = ref({ ...props.filters });

let shouldEmit = true;

watch(() => JSON.parse(JSON.stringify(localFilters.value)), (newVal, oldVal) => {
  if (shouldEmit && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    shouldEmit = false;
    nextTick(() => {
      emit('filter-changed', newVal);
      shouldEmit = true;
    });
  }
}, { deep: true, flush: 'post' });

// Controlador para actualizaciones recursivas
const updatingFromParent = ref(false);

// Opciones filtradas locales para cada select
const filteredAreas = ref([...props.areasConocimiento]);
const filteredIndices = ref([...props.revistasIndices]);
const filteredIdiomas = ref([...props.revistasIdiomas]);
const filteredEditoriales = ref([...props.revistasEditorial]);
const filteredPeriodicidades = ref([...props.revistasPeriodicidad]);
const filteredFormatos = ref([...props.revistasFormato]);
const filteredEstados = ref([...props.revistasEstado]);

// Watchers para sincronizar cambios de props
watch(() => props.modelValue, (newVal) => {
  drawerVisible.value = newVal;
});

watch(() => props.filters, (newVal) => {
  updatingFromParent.value = true;
  localFilters.value = { ...newVal };
  updatingFromParent.value = false;
}, { deep: true });

watch(() => props.areasConocimiento, (newVal) => {
  filteredAreas.value = [...newVal];
});

watch(() => props.revistasIndices, (newVal) => {
  filteredIndices.value = [...newVal];
});

watch(() => props.revistasIdiomas, (newVal) => {
  filteredIdiomas.value = [...newVal];
});

watch(() => props.revistasEditorial, (newVal) => {
  filteredEditoriales.value = [...newVal];
});

watch(() => props.revistasPeriodicidad, (newVal) => {
  filteredPeriodicidades.value = [...newVal];
});

watch(() => props.revistasFormato, (newVal) => {
  filteredFormatos.value = [...newVal];
});

watch(() => props.revistasEstado, (newVal) => {
  filteredEstados.value = [...newVal];
});

// Watcher para emitir cambios solo cuando son iniciados por el usuario
watch(localFilters, (newVal) => {
  if (!updatingFromParent.value) {
    emit('filter-changed', newVal);
  }
}, { deep: true });

// Métodos de filtrado para cada select
const filterAreas = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredAreas.value = props.areasConocimiento.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterIndices = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredIndices.value = props.revistasIndices.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterIdiomas = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredIdiomas.value = props.revistasIdiomas.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterEditoriales = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredEditoriales.value = props.revistasEditorial.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterPeriodicidades = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredPeriodicidades.value = props.revistasPeriodicidad.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterFormatos = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredFormatos.value = props.revistasFormato.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const filterEstados = (val, update) => {
  update(() => {
    const needle = val.toLowerCase();
    filteredEstados.value = props.revistasEstado.filter(v =>
      v.label.toLowerCase().includes(needle)
    );
  });
};

const toggleDrawer = (value) => {
  drawerVisible.value = value;
  emit('update:modelValue', value);
};

const clearFilter = (field) => {
  if (Array.isArray(localFilters.value[field])) {
    localFilters.value[field] = [];
  } else {
    localFilters.value[field] = '';
  }
};
const clearAllFilters = () => {
  localFilters.value = {
    revista: '',
    issn_digital: '',
    issn_impreso: '',
    deposito_legal_digital: '',
    deposito_legal_impreso: '',
    area_conocimiento: [],
    indice: [],
    idioma: [],
    editorial: [],
    periodicidad: [],
    formato: [],
    estado: []
  };

  // Limpiar también las opciones filtradas
  filteredAreas.value = [...props.areasConocimiento];
  filteredIndices.value = [...props.revistasIndices];
  filteredIdiomas.value = [...props.revistasIdiomas];
  filteredEditoriales.value = [...props.revistasEditorial];
  filteredPeriodicidades.value = [...props.revistasPeriodicidad];
  filteredFormatos.value = [...props.revistasFormato];
  filteredEstados.value = [...props.revistasEstado];
};
</script>

<style scoped>
.drawer-header {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.drawer-title {
  font-size: 18px;
  font-weight: 500;
}

.filters-container {
  padding: 15px;
}

.filter-item {
  margin-bottom: 15px;
  width: 100%;
}

.drawer-toggle-btn {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 100;
}

.responsive-image {

  width: 20px;
  height: auto;
  display: block;
}
</style>
