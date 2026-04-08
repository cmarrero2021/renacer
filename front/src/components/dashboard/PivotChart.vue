<template>
  <div class="pivot-chart-container">
    <canvas ref="chartCanvas" :height="chartHeight"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useDashboardStore } from 'src/stores/dashboard.store';
import {
  Chart, BarController, LineController, PieController, DoughnutController,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(
  BarController, LineController, PieController, DoughnutController,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
  ChartDataLabels
);

const store = useDashboardStore();
const chartCanvas = ref(null);
let chartInstance = null;
const chartHeight = ref(400);

// Color palette inspired by Excel
const COLORS = [
  '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
  '#70AD47', '#264478', '#9B57A2', '#636363', '#BDD7EE',
  '#F4B183', '#C9C9C9', '#FFE599', '#9DC3E6', '#A9D18E',
];

const chartData = computed(() => {
  const td = store.pivotTableData;
  if (!td.bodyRows?.length) return null;

  const type = store.chartType;
  const isPie = type === 'pie' || type === 'doughnut';

  if (td.hasPivotColumns) {
    // Cross-tab: labels = row values, datasets = column groups
    const rowKeys = td.headers.filter(h => h.isRowHeader).map(h => h.key);
    const labels = td.bodyRows.map(row => rowKeys.map(k => row[k] || '').join(' | '));
    const valueHeaders = td.headers.filter(h => h.isValue);

    if (isPie) {
      if (store.pivotRows.length === 0) {
        // No rows: each value (column+field combo) is a slice
        return {
          labels: valueHeaders.map(h => `${h.label} - ${h.subLabel}`),
          datasets: [{
            data: valueHeaders.map(h => td.bodyRows.reduce((sum, row) => sum + (Number(row[h.key]) || 0), 0)),
            backgroundColor: valueHeaders.map((h, i) => store.chartCustomColors[`${h.label} - ${h.subLabel}`] || COLORS[i % COLORS.length]),
          }],
        };
      }
      // Pie: use first value column, sum per row (standard behavior)
      return {
        labels,
        datasets: [{
          data: td.bodyRows.map(row => {
            return valueHeaders.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0);
          }),
          backgroundColor: labels.map((label, i) => store.chartCustomColors[label] || COLORS[i % COLORS.length]),
        }],
      };
    }

    // Group datasets by column value
    const colValuesSet = [...new Set(valueHeaders.map(h => h.label))];
    const datasets = colValuesSet.map((cv, i) => {
      const colHeaders = valueHeaders.filter(h => h.label === cv);
      const baseColor = store.chartCustomColors[cv] || COLORS[i % COLORS.length];
      return {
        label: cv,
        data: td.bodyRows.map(row => colHeaders.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0)),
        backgroundColor: baseColor + (['bar', 'hbar'].includes(type) ? 'CC' : 'FF'),
        borderColor: baseColor,
        borderWidth: 1,
      };
    });
    return { labels, datasets };
  }

  // Simple table: labels from row fields, values from value fields
  const rowHeaderKeys = td.headers.filter((_, i) => i < store.pivotRows.length).map(h => h.key);
  const valueHeaderKeys = td.headers.filter((_, i) => i >= store.pivotRows.length);
  const labels = td.bodyRows.map(row => rowHeaderKeys.map(k => row[k] || '').join(' | '));

  if (isPie) {
    if (store.pivotRows.length === 0) {
      // No rows: each value field is a slice
      return {
        labels: valueHeaderKeys.map(h => h.label),
        datasets: [{
          data: valueHeaderKeys.map(h => td.bodyRows.reduce((sum, row) => sum + (Number(row[h.key]) || 0), 0)),
          backgroundColor: valueHeaderKeys.map((h, i) => store.chartCustomColors[h.label] || COLORS[i % COLORS.length]),
        }],
      };
    }
    // With rows: each slice represents a row (category), value is the SUM of all measurement fields
    return {
      labels,
      datasets: [{
        data: td.bodyRows.map(row => {
          return valueHeaderKeys.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0);
        }),
        backgroundColor: labels.map((label, i) => store.chartCustomColors[label] || COLORS[i % COLORS.length]),
      }],
    };
  }

  const datasets = valueHeaderKeys.map((h, i) => {
    const baseColor = store.chartCustomColors[h.label] || COLORS[i % COLORS.length];
    return {
      label: h.label,
      data: td.bodyRows.map(row => Number(row[h.key]) || 0),
      backgroundColor: baseColor + (['bar', 'hbar'].includes(type) ? 'CC' : '33'),
      borderColor: baseColor,
      borderWidth: type === 'line' ? 2 : 1,
      fill: type === 'line' ? false : undefined,
      tension: 0.3,
    };
  });

  return { labels, datasets };
});

function renderChart() {
  if (!chartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();
  if (!chartData.value) return;

  const type = store.chartType;
  const isPie = type === 'pie' || type === 'doughnut';
  const chartJsType = type === 'hbar' ? 'bar' : type;
  const isHorizontal = type === 'hbar';

  // Configure scales dynamically based on orientation
  const scales = isPie ? {} : {
    x: {
      stacked: store.chartStacked,
      beginAtZero: isHorizontal,
      grid: { display: !isHorizontal },
      ticks: isHorizontal ? { callback: val => Number(val).toLocaleString('es-VE') } : {}
    },
    y: {
      stacked: store.chartStacked,
      beginAtZero: !isHorizontal,
      grid: { display: isHorizontal },
      ticks: !isHorizontal ? { callback: val => Number(val).toLocaleString('es-VE') } : {}
    }
  };

  chartInstance = new Chart(chartCanvas.value, {
    type: chartJsType,
    data: chartData.value,
    options: {
      indexAxis: isHorizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: isPie ? 'right' : 'top', labels: { font: { size: 12 } } },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = isHorizontal ? ctx.parsed?.x : (ctx.parsed?.y ?? ctx.parsed ?? ctx.raw);
              return `${ctx.dataset.label || ctx.label}: ${Number(val).toLocaleString('es-VE')}`;
            },
          },
        },
        datalabels: {
          display: store.chartShowLabels,
          anchor: isHorizontal ? 'end' : (isPie ? 'center' : 'end'),
          align: isHorizontal ? 'right' : (isPie ? 'center' : 'top'),
          formatter: (val) => {
            const num = Number(val);
            if (isNaN(num) || num === 0) return '';
            return num.toLocaleString('es-VE', { maximumFractionDigits: 1 });
          },
          font: { weight: 'bold', size: 10 },
          color: isPie ? '#fff' : '#666',
          offset: 4
        }
      },
      scales
    },
  });
}

// Export functions
function exportPNG() {
  if (!chartCanvas.value) return;
  const url = chartCanvas.value.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = 'grafico-dashboard.png'; a.click();
}

async function exportPDF() {
  if (!chartCanvas.value) return;
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const imgData = chartCanvas.value.toDataURL('image/png');
  const w = pdf.internal.pageSize.getWidth() - 20;
  const h = (chartCanvas.value.height / chartCanvas.value.width) * w;
  pdf.addImage(imgData, 'PNG', 10, 10, w, h);
  pdf.save('grafico-dashboard.pdf');
}

defineExpose({ exportPNG, exportPDF });

watch([chartData, () => store.chartType, () => store.chartStacked, () => store.chartShowLabels], () => {
  nextTick(renderChart);
}, { deep: true });

onMounted(() => { if (chartData.value) nextTick(renderChart); });
onUnmounted(() => { if (chartInstance) chartInstance.destroy(); });
</script>

<style scoped>
.pivot-chart-container {
  width: 100%; min-height: 350px; max-height: 500px;
  display: flex; align-items: center; justify-content: center;
}
canvas { width: 100% !important; }
</style>
