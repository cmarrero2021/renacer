<template>
  <div class="chart-component-wrapper">
    <div class="oncti-card chart-card">
      <ChartToolbar @change-chart-type="changeChartType" @export-excel="exportToExcel" @export-png="exportToPng"
        @export-pdf="exportToPdf" @toggle-table="toggleTable" />
      <div v-if="!isTableVisible">
        <div ref="chartContainer" class="chart-container">
          <div class="chart-canvas-wrapper">
            <canvas ref="chartCanvas"></canvas>
          </div>
        </div>
      </div>
      <div v-else>
        <q-card flat class="table-card">
          <q-table :title="title" :rows="chartData" :columns="tableColumns" row-key="id"
            :pagination="{ rowsPerPage: 10 }" flat />
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import axios from "axios";
import { Chart, registerables } from "chart.js";
import "chartjs-plugin-datalabels";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { useQuasar } from "quasar";
import ChartToolbar from "src/components/ChartToolbar.vue";
import socket from "src/services/websocket.js";
import { useSelectedStateStore } from "src/stores/selectedState";
import { useFiltersStore } from "src/stores/filters";

// Inicializar Quasar
const $q = useQuasar();

// Registrar todas las funcionalidades necesarias de Chart.js
Chart.register(...registerables);

// Stores
const selectedStateStore = useSelectedStateStore();
const filtersStore = useFiltersStore();

// Props
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  dataKey: {
    type: String,
    required: true,
  },
  valueKey: {
    type: String,
    required: true,
  },
  tableColumns: {
    type: Array,
    required: true,
  },
});

// Variables reactivas
const chartData = ref([]);
const chartCanvas = ref(null);
const chartContainer = ref(null);
let chartInstance = null;
const currentChartType = ref("doughnut");
const isTableVisible = ref(false);

// Función para generar el timestamp en formato YYYYMMDDHHmmss
const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Renderizar la gráfica
const renderChart = (type) => {
  if (!chartCanvas.value) {
    console.log(`[ChartComponent - ${props.title}] ERROR: chartCanvas no disponible`);
    return;
  }

  console.log(`[ChartComponent - ${props.title}] Renderizando gráfica. Datos:`, chartData.value.length, 'registros. Estado actual:', selectedStateStore.selectedState);

  // Destruir instancia anterior
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext("2d");

  // Configuración del gráfico
  const isBarChart = type === "bar" || type === "column";
  const isPieChart = type === "pie" || type === "doughnut";
  const chartType = isBarChart ? "bar" : type; // "bar" para barras, otro tipo para pie/doughnut
  const indexAxis = type === "bar" ? "y" : type === "column" ? "x" : undefined; // "y" para barras horizontales, "x" para columnas
  const labels = chartData.value.map(
    (item) => item[props.dataKey] || "Sin datos"
  );
  const dataValues = chartData.value.map(
    (item) => parseInt(item[props.valueKey], 10) || 0
  );

  console.log(`[ChartComponent - ${props.title}] Labels:`, labels);
  console.log(`[ChartComponent - ${props.title}] Values:`, dataValues);

  // const backgroundColors = chartData.value.map((_, index) => predefinedColors[index % predefinedColors.length]);
  const formattedDate = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const backgroundColors = generateGradientColors(dataValues);
  // Construir el título dinámico
  let dynamicTitle = props.title;
  // Solo agregar el nombre del estado si el endpoint NO es grEstadosUrl
  const estadosEndpoints = [
    import.meta.env.VITE_GR_ESTADOS_URL,
    '/gr_estados',
    'gr_estados',
  ];
  const isEstadosChart = estadosEndpoints.some(e => props.endpoint.includes(e));
  if (selectedStateStore.selectedState && !isEstadosChart) {
    dynamicTitle += ` EDO. ${selectedStateStore.selectedState.toUpperCase()}`;
  }
  dynamicTitle += `\n${formattedDate}`;

  console.log(`[ChartComponent - ${props.title}] Título dinámico:`, dynamicTitle);

  // Ajustar altura del canvas y leyenda según el tipo de gráfico
  if (isPieChart) {
    chartCanvas.value.style.height = '800px';
  } else {
    chartCanvas.value.style.height = '400px';
  }
  chartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: "",
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis, // Configura el eje de las barras (horizontal o vertical)
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: dynamicTitle,
          align: 'start',
          padding: 10,
          color: '#333333',
          font: {
            size: 18,
            weight: 'bold'
          }
        },
        legend: {
          display: chartType === 'pie' || chartType === 'doughnut',
          position: chartType === 'pie' || chartType === 'doughnut' ? 'right' : 'top',
          labels: {
            padding: 10,
            boxWidth: 20,
            color: '#333333',
          }
        },
      },
      scales: isPieChart ? undefined : {
        x: {
          grid: { display: false },
          ticks: {
            display: type !== 'bar', // Ocultar valores del eje X solo para barras horizontales
            color: '#333333',
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            display: type === 'bar', // Mostrar valores del eje Y solo para barras horizontales
            color: '#333333',
          }
        },
      },
    },
  });
};

// Obtener datos para la gráfica
const fetchChartData = async () => {
  try {
    let url = props.endpoint;
    const timestamp = new Date().getTime();

    // Verificar si hay filtros activos
    const hasFilters = filtersStore.hasActiveFilters();

    if (hasFilters) {
      // Determinar si usar endpoint filtrado
      // Extraer el nombre base del endpoint (ej: gr_areas, gr_indices)
      const urlParts = url.split('/');
      const endpointName = urlParts[urlParts.length - 1].split('?')[0];

      // Construir el endpoint filtrado
      const baseUrlParts = url.split('/');
      baseUrlParts[baseUrlParts.length - 1] = endpointName + '_filtrado';
      const filteredEndpoint = baseUrlParts.join('/');

      // Construir query string con filtros
      const queryString = filtersStore.buildQueryString();
      url = `${filteredEndpoint}?${queryString}&_t=${timestamp}`;

      console.log(`[ChartComponent - ${props.title}] Consultando con filtros:`, filtersStore.getActiveFilters(), 'URL:', url);
    } else if (selectedStateStore.selectedState) {
      // Solo filtro de estado (desde el mapa)
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}estado=${encodeURIComponent(selectedStateStore.selectedState)}&_t=${timestamp}`;
      console.log(`[ChartComponent - ${props.title}] Consultando estado:`, selectedStateStore.selectedState, 'URL:', url);
    } else {
      // Sin filtros
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}_t=${timestamp}`;
      console.log(`[ChartComponent - ${props.title}] Consultando data nacional. URL:`, url);
    }

    const response = await axios.get(url);

    // Agregar datos duplicados (consolidar por dataKey)
    const aggregatedData = {};
    response.data.forEach(item => {
      const key = item[props.dataKey];
      const value = parseInt(item[props.valueKey], 10) || 0;

      if (aggregatedData[key]) {
        // Si ya existe, sumar el valor
        aggregatedData[key] += value;
      } else {
        // Si no existe, crear nueva entrada
        aggregatedData[key] = value;
      }
    });

    // Convertir el objeto agregado de vuelta a array
    chartData.value = Object.keys(aggregatedData).map(key => ({
      [props.dataKey]: key,
      [props.valueKey]: aggregatedData[key]
    }));

    console.log(`[ChartComponent - ${props.title}] Datos recibidos:`, response.data.length, 'registros. Después de agregar:', chartData.value.length, 'registros');
    await nextTick(); // Esperar a que Vue actualice el DOM
    renderChart(currentChartType.value);
  } catch (error) {
    console.error(
      `Error al obtener los datos de la gráfica (${props.title}):`,
      error
    );
  }
};

// Cambiar tipo de gráfica
const changeChartType = (type) => {
  currentChartType.value = type;
  isTableVisible.value = false; // Ocultar la tabla si está visible
  nextTick(() => renderChart(type));
};

// Toggle tabla
const toggleTable = () => {
  isTableVisible.value = !isTableVisible.value;
};

// Exportar a Excel
const exportToExcel = () => {
  try {
    const timestamp = generateTimestamp();
    const ws = XLSX.utils.json_to_sheet(chartData.value);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(
      wb,
      `${timestamp}_${props.title.toLowerCase().replace(/ /g, "_")}.xlsx`
    );
    $q.notify({
      type: "positive",
      message: `Exportación a Excel exitosa (${props.title})`,
      position: "top",
    });
  } catch (error) {
    console.error("Error exportando a Excel:", error);
    $q.notify({
      type: "negative",
      message: `Error al exportar a Excel (${props.title})`,
      position: "top",
    });
  }
};

// Exportar a PNG
const exportToPng = () => {
  if (!chartContainer.value || isTableVisible.value) {
    $q.notify({
      type: "negative",
      message: `No se puede exportar la tabla a PNG (${props.title})`,
      position: "top",
    });
    return;
  }

  try {
    html2canvas(chartContainer.value.querySelector("canvas")).then((canvas) => {
      if (!canvas) {
        $q.notify({
          type: "negative",
          message: `No se encontró el gráfico para exportar (${props.title})`,
          position: "top",
        });
        return;
      }

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const timestamp = generateTimestamp();
      link.download = `${timestamp}_${props.title
        .toLowerCase()
        .replace(/ /g, "_")}.png`;
      link.href = imgData;
      link.click();
      $q.notify({
        type: "positive",
        message: `Exportación a PNG exitosa (${props.title})`,
        position: "top",
      });
    });
  } catch (error) {
    console.error("Error generando imagen:", error);
    $q.notify({
      type: "negative",
      message: `Error al exportar a PNG (${props.title})`,
      position: "top",
    });
  }
};

// Exportar a PDF
const exportToPdf = () => {
  if (!chartContainer.value || isTableVisible.value) {
    $q.notify({
      type: "negative",
      message: `No se puede exportar la tabla a PDF (${props.title})`,
      position: "top",
    });
    return;
  }

  try {
    html2canvas(chartContainer.value.querySelector("canvas")).then((canvas) => {
      if (!canvas) {
        $q.notify({
          type: "negative",
          message: `No se encontró el gráfico para exportar (${props.title})`,
          position: "top",
        });
        return;
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const timestamp = generateTimestamp();
      pdf.addImage(imgData, "PNG", 15, 40, 180, 0, null, "FAST");
      pdf.save(
        `${timestamp}_${props.title.toLowerCase().replace(/ /g, "_")}.pdf`
      );
      $q.notify({
        type: "positive",
        message: `Exportación a PDF exitosa (${props.title})`,
        position: "top",
      });
    });
  } catch (error) {
    console.error("Error generando PDF:", error);
    $q.notify({
      type: "negative",
      message: `Error al exportar a PDF (${props.title})`,
      position: "top",
    });
  }
};

// Función para generar colores degradados desde #273984 (más oscuro, valores altos) hasta #a0b1fa (más claro, valores bajos)
const generateGradientColors = (values) => {
  if (!values || values.length === 0) return [];

  // Obtenemos valores únicos ordenados de mayor a menor
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);

  // Si todos los valores son iguales, todos tendrán el color más oscuro
  if (uniqueValues.length === 1) {
    return Array(values.length).fill("rgba(39, 57, 132, 0.7)");
  }

  // Color inicial (#273984 - azul oscuro para valores altos)
  const darkColor = { r: 39, g: 57, b: 132 };

  // Color final (#a0b1fa - azul claro para valores bajos)
  const lightColor = { r: 160, g: 177, b: 250 };

  // Mapeo de cada valor único a su color correspondiente
  const valueColorMap = {};
  uniqueValues.forEach((value, index) => {
    // Calculamos la intensidad basada en la posición en los valores únicos ordenados
    const intensity = index / (uniqueValues.length - 1);

    // Interpolamos entre el color oscuro y claro
    const r = Math.round(
      darkColor.r + (lightColor.r - darkColor.r) * intensity
    );
    const g = Math.round(
      darkColor.g + (lightColor.g - darkColor.g) * intensity
    );
    const b = Math.round(
      darkColor.b + (lightColor.b - darkColor.b) * intensity
    );

    valueColorMap[value] = `rgba(${r}, ${g}, ${b}, 0.7)`;
  });

  // Asignamos a cada valor original su color correspondiente
  return values.map((value) => valueColorMap[value]);
};
///////////////
// Ciclo de vida
onMounted(() => {
  // Configurar la fuente Roboto como predeterminada para Chart.js
  Chart.defaults.font.family = 'Roboto, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#333333'; // Color negro para todos los textos

  fetchChartData(); // Obtener los datos iniciales

  // Escuchar eventos de actualización desde WebSocket
  socket.addEventListener("message", async (event) => {
    // console.log('cambio bd');
    // $q.notify({
    //   message: "Cambio detectado en la base de datos. Actualizando gráfico.",
    //   color: "positive",
    //   position: "top",
    //   timeout: 3000,
    // });
    await fetchChartData(); // Volver a consultar los datos del gráfico
  });
});

onUnmounted(() => {
  // Limpiar el listener del WebSocket
  // socket.removeEventListener("message");
});

// Watch para actualizar el gráfico al cambiar el estado seleccionado
watch(
  () => selectedStateStore.selectedState,
  (newState, oldState) => {
    console.log(`[ChartComponent - ${props.title}] Watch activado. Estado anterior:`, oldState, '-> Nuevo estado:', newState);
    fetchChartData();
  },
  { immediate: false, deep: true }
);

// Watch para actualizar el gráfico al cambiar los filtros
watch(
  [
    () => filtersStore.selectedArea,
    () => filtersStore.selectedIndice,
    () => filtersStore.selectedIdioma,
    () => filtersStore.selectedEditorial,
    () => filtersStore.selectedPeriodicidad,
    () => filtersStore.selectedFormato,
    () => filtersStore.selectedEstado
  ],
  (newValues, oldValues) => {
    console.log(`[ChartComponent - ${props.title}] Filtros cambiados`);
    fetchChartData();
  },
  { immediate: false }
);
</script>

<style scoped>
.chart-component-wrapper {
  width: 100%;
}

.chart-card {
  padding: 20px;
  min-height: 400px;
}

.chart-container {
  width: 100%;
  background-color: var(--oncti-white);
  padding: 20px;
  border-radius: 12px;
  position: relative;
}

.chart-canvas-wrapper {
  width: 100%;
  min-height: 300px;
  position: relative;
}

canvas {
  width: 100% !important;
  height: 400px !important;
}

.table-card {
  background: transparent;
}

/* Responsive */
@media (max-width: 768px) {
  .chart-card {
    padding: 16px;
  }

  .chart-container {
    padding: 16px;
  }

  canvas {
    height: 300px !important;
  }
}

@media (max-width: 480px) {
  .chart-card {
    padding: 12px;
  }

  .chart-container {
    padding: 12px;
  }

  canvas {
    height: 250px !important;
  }
}

/* Large screens (1440px+) */
@media (min-width: 1440px) {
  .chart-card {
    padding: 24px;
    min-height: 450px;
  }

  .chart-container {
    padding: 24px;
  }

  .chart-canvas-wrapper {
    min-height: 350px;
  }

  canvas {
    height: 450px !important;
  }
}

/* Extra large screens (1920px+) */
@media (min-width: 1920px) {
  .chart-card {
    padding: 28px;
    min-height: 500px;
  }

  .chart-container {
    padding: 28px;
  }

  .chart-canvas-wrapper {
    min-height: 400px;
  }

  canvas {
    height: 500px !important;
  }
}
</style>
