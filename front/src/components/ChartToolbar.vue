<template>
  <div id="chartToolbar" :style="{
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '5px',
    marginBottom: '15px',
    backgroundColor: showButtons ? '#bdbebe' : 'transparent',
    transition: 'background-color 0.3s'
  }">
    <!-- Contenedor condicional para los demás botones -->

    <!-- <div v-if="showButtons" style="display: flex; gap: 0px;"> -->
    <!-- Botones de tipo de gráfico -->
    <q-btn icon="bar_chart" round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'column')">
      <q-tooltip>Gráfico de columnas verticales</q-tooltip>
    </q-btn>

    <q-btn round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'bar')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
        <rect x="2" y="5" width="18" height="3" fill="currentColor" />
        <rect x="2" y="10" width="14" height="3" fill="currentColor" />
        <rect x="2" y="15" width="10" height="3" fill="currentColor" />
      </svg>
      <q-tooltip>Gráfico de barras horizontales</q-tooltip>
    </q-btn>

    <q-btn icon="pie_chart" round color="primary" class="boton" size="sm" @click="emit('change-chart-type', 'pie')">
      <q-tooltip>Gráfico de torta</q-tooltip>
    </q-btn>

    <q-btn icon="donut_large" round color="primary" class="boton" size="sm"
      @click="emit('change-chart-type', 'doughnut')">
      <q-tooltip>Gráfico de anillo</q-tooltip>
    </q-btn>

    <!-- Botón de tabla -->
    <q-btn icon="table_view" round color="primary" class="boton" size="sm" @click="emit('toggle-table')">
      <q-tooltip>Mostrar tabla de datos</q-tooltip>
    </q-btn>

    <!-- Botones de exportación -->
    <q-btn icon="file_download" round color="primary" class="boton" size="sm" @click="emit('export-excel')">
      <q-tooltip>Exportar a Excel</q-tooltip>
    </q-btn>

    <q-btn icon="photo" round color="primary" class="boton" size="sm" @click="emit('export-png')">
      <q-tooltip>Exportar a PNG</q-tooltip>
    </q-btn>

    <!-- <q-btn icon="picture_as_pdf" flat size="sm" class="btn-content" @click="emit('export-pdf')">
        <q-tooltip>Exportar a PDF</q-tooltip>
      </q-btn> -->
    <q-btn icon="picture_as_pdf" round color="primary" class="boton" size="sm" @click="emit('export-pdf')">
      <q-tooltip>Exportar a PDF</q-tooltip>
    </q-btn>
  </div>

  <!-- Botón principal para alternar visibilidad -->
  <!-- <q-btn :icon="showButtons ? 'visibility_off' : 'visibility'" flat size="sm" @click="toggleButtonsVisibility">
    <q-tooltip>{{ showButtons ? 'Ocultar opciones de gráficos' : 'Mostrar opciones de gráficos' }}</q-tooltip>
  </q-btn> -->
  <!-- </div> -->
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

// Estado para controlar la visibilidad de los botones
const showButtons = ref(false);

// Función para alternar la visibilidad de los botones
const toggleButtonsVisibility = () => {
  showButtons.value = !showButtons.value;
};

// Emits para comunicarse con el padre
const emit = defineEmits([
  'change-chart-type',
  'toggle-table',
  'export-excel',
  'export-png',
  'export-pdf',
]);
const applyPadding = () => {
  const qBtns = document.querySelectorAll('.q-btn');
  const isSmallScreen = window.innerWidth < 767;

  qBtns.forEach(btn => {
    if (isSmallScreen) {
      btn.style.setProperty('padding', '4px 4px', 'important');
    } else {
      btn.style.setProperty('padding', '8px 10px', 'important');
    }
  });
};

onMounted(() => {
  // Aplica el estilo inicialmente
  applyPadding();

  // Configura un MutationObserver para detectar cambios en el DOM
  const observer = new MutationObserver(applyPadding);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Configura un evento de redimensionamiento de la ventana
  const handleResize = () => {
    applyPadding();
  };

  window.addEventListener('resize', handleResize);

  // Limpia el evento de redimensionamiento al desmontar el componente
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    observer.disconnect();
  });
});

</script>
