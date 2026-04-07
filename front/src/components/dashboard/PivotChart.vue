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

Chart.register(
  BarController, LineController, PieController, DoughnutController,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
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
      // Pie: use first value column, sum per row
      return {
        labels,
        datasets: [{
          data: td.bodyRows.map(row => {
            return valueHeaders.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0);
          }),
          backgroundColor: COLORS.slice(0, labels.length),
        }],
      };
    }

    // Group datasets by column value
    const colValuesSet = [...new Set(valueHeaders.map(h => h.label))];
    const datasets = colValuesSet.map((cv, i) => {
      const colHeaders = valueHeaders.filter(h => h.label === cv);
      return {
        label: cv,
        data: td.bodyRows.map(row => colHeaders.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0)),
        backgroundColor: COLORS[i % COLORS.length] + (type === 'bar' ? 'CC' : 'FF'),
        borderColor: COLORS[i % COLORS.length],
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
    const firstValKey = valueHeaderKeys[0]?.key;
    return {
      labels,
      datasets: [{
        data: td.bodyRows.map(row => Number(row[firstValKey]) || 0),
        backgroundColor: COLORS.slice(0, labels.length),
      }],
    };
  }

  const datasets = valueHeaderKeys.map((h, i) => ({
    label: h.label,
    data: td.bodyRows.map(row => Number(row[h.key]) || 0),
    backgroundColor: COLORS[i % COLORS.length] + (type === 'bar' ? 'CC' : '33'),
    borderColor: COLORS[i % COLORS.length],
    borderWidth: type === 'line' ? 2 : 1,
    fill: type === 'line' ? false : undefined,
    tension: 0.3,
  }));

  return { labels, datasets };
});

function renderChart() {
  if (!chartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();
  if (!chartData.value) return;

  const type = store.chartType;
  const isPie = type === 'pie' || type === 'doughnut';

  chartInstance = new Chart(chartCanvas.value, {
    type,
    data: chartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: isPie ? 'right' : 'top', labels: { font: { size: 12 } } },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed?.y ?? ctx.parsed ?? ctx.raw;
              return `${ctx.dataset.label || ctx.label}: ${Number(val).toLocaleString('es-VE')}`;
            },
          },
        },
      },
      scales: isPie ? {} : {
        x: { stacked: store.chartStacked, grid: { display: false } },
        y: {
          stacked: store.chartStacked, beginAtZero: true,
          ticks: { callback: val => Number(val).toLocaleString('es-VE') },
        },
      },
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

watch([chartData, () => store.chartType, () => store.chartStacked], () => {
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
