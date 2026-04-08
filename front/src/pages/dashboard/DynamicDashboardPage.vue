<template>
  <q-page class="dashboard-page">
    <!-- ═══ Toolbar ═══════════════════════════════════════════════════════ -->
    <div class="dashboard-toolbar">
      <div class="toolbar-left">
        <q-icon name="analytics" size="28px" color="primary" />
        <span class="toolbar-title">Analítica</span>
        <q-badge v-if="store.currentQueryName" color="accent" :label="store.currentQueryName" class="q-ml-sm" />
      </div>
      <div class="toolbar-actions">
        <q-btn-dropdown flat dense icon="save" label="Guardar" color="primary" :disable="!store.hasConfig">
          <q-list>
            <q-item clickable v-close-popup @click="showSaveDialog = true">
              <q-item-section avatar><q-icon name="save" /></q-item-section>
              <q-item-section>Guardar consulta</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="showSaveDialog = true; saveAsNew = true">
              <q-item-section avatar><q-icon name="save_as" /></q-item-section>
              <q-item-section>Guardar como nueva</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn-dropdown flat dense icon="folder_open" label="Cargar" color="secondary">
          <q-list style="min-width: 300px; max-height: 400px; overflow: auto">
            <q-item-label header>Consultas Guardadas</q-item-label>
            <q-item v-for="sq in store.savedQueries" :key="sq.id" clickable v-close-popup
              @click="store.loadSavedQuery(sq)">
              <q-item-section>
                <q-item-label>{{ sq.name }}</q-item-label>
                <q-item-label caption>{{ sq.description || 'Sin descripción' }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="sq.visibility === 'public' ? 'green' : 'orange'"
                  :label="sq.visibility === 'public' ? 'Público' : 'Privado'" />
              </q-item-section>
            </q-item>
            <q-item v-if="!store.savedQueries.length">
              <q-item-section class="text-grey">No hay consultas guardadas</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-separator vertical class="q-mx-sm" />
        <q-btn-dropdown flat dense icon="download" label="Exportar" color="positive" :disable="!store.rawData.length">
          <q-list>
            <q-item clickable v-close-popup @click="exportExcel"><q-item-section avatar><q-icon
                  name="grid_on" /></q-item-section><q-item-section>Excel (.xlsx)</q-item-section></q-item>
            <q-item clickable v-close-popup @click="exportCSV"><q-item-section avatar><q-icon
                  name="description" /></q-item-section><q-item-section>CSV</q-item-section></q-item>
            <q-item clickable v-close-popup @click="exportJSON"><q-item-section avatar><q-icon
                  name="data_object" /></q-item-section><q-item-section>JSON</q-item-section></q-item>
            <q-separator />
            <q-item clickable v-close-popup @click="exportChartPNG"><q-item-section avatar><q-icon
                  name="image" /></q-item-section><q-item-section>Gráfico PNG</q-item-section></q-item>
            <q-item clickable v-close-popup @click="exportChartPDF"><q-item-section avatar><q-icon
                  name="picture_as_pdf" /></q-item-section><q-item-section>Gráfico PDF</q-item-section></q-item>
          </q-list>
        </q-btn-dropdown>
        <q-separator vertical class="q-mx-sm" />
        <q-btn flat dense icon="refresh" color="info" @click="store.fetchData" :loading="store.dataLoading"
          :disable="!store.hasConfig" />
        <q-btn flat dense icon="delete_sweep" color="negative" @click="store.clearConfig" :disable="!store.hasConfig" />
      </div>
    </div>

    <!-- ═══ Main Content ════════════════════════════════════════════════ -->
    <div class="dashboard-content">
      <!-- ─── Left Panel: Fields ─────────────────────────────────────── -->
      <div class="fields-panel">
        <div class="panel-header">
          <q-icon name="list" size="20px" />
          <span>Campos Disponibles</span>
        </div>
        <q-input v-model="fieldSearch" dense outlined placeholder="Buscar campo..." class="q-mx-sm q-mb-sm" clearable>
          <template #prepend><q-icon name="search" size="18px" /></template>
        </q-input>
        <div class="fields-list">
          <div v-for="(fields, category) in filteredFields" :key="category" class="field-category">
            <div class="category-header" @click="toggleCategory(category)">
              <q-icon :name="expandedCategories[category] ? 'expand_more' : 'chevron_right'" size="18px" />
              <span>{{ category }}</span>
              <q-badge :label="fields.length" color="grey-6" class="q-ml-auto" />
            </div>
            <transition name="slide">
              <div v-if="expandedCategories[category]" class="category-fields">
                <div v-for="field in fields" :key="field.key" class="field-chip" draggable="true"
                  @dragstart="onDragStart($event, field)" :title="field.label">
                  <q-icon :name="field.numeric ? 'tag' : field.date ? 'event' : 'text_fields'" size="14px"
                    class="field-icon" />
                  <span class="field-label">{{ field.label }}</span>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- ─── Center Panel: Pivot Config + Table + Chart ─────────────── -->
      <div class="center-panel">
        <!-- Drop Zones -->
        <div class="drop-zones">
          <div class="drop-zone" @dragover.prevent @dragenter.prevent="dragOverZone = 'filters'"
            @dragleave="dragOverZone = null" @drop="onDrop($event, 'filters')"
            :class="{ 'zone-active': dragOverZone === 'filters' }">
            <span class="zone-label"><q-icon name="filter_alt" size="16px" /> Filtros</span>
            <div class="zone-chips">
              <q-chip v-for="f in store.pivotFilters" :key="f.field" removable dense
                @remove="store.removeFieldFromZone(f.field, 'filters')" color="amber-2" text-color="black" clickable>
                <q-icon name="edit" size="14px" class="q-mr-xs" />
                {{ f.label }}: {{ getFilterLabel(f) }}
                <q-menu padding style="min-width: 250px">
                  <div class="q-pa-md">
                    <div class="text-subtitle2 q-mb-sm">Configurar Filtro: {{ f.label }}</div>
                    <q-select v-model="f.operator" dense outlined label="Operador" class="q-mb-sm" :options="[
                      { label: 'Igual a', value: 'eq' },
                      { label: 'Diferente de', value: 'neq' },
                      { label: 'Contiene', value: 'like' },
                      { label: 'Mayor que', value: 'gt' },
                      { label: 'Menor que', value: 'lt' },
                      { label: 'Mayor o igual', value: 'gte' },
                      { label: 'Menor o igual', value: 'lte' },
                      { label: 'Uno de (CSV)', value: 'in' },
                    ]" emit-value map-options />
                    <q-input v-model="f.value" dense outlined label="Valor" :type="f.date ? 'date' : 'text'" autofocus
                      @keyup.enter="store.fetchData" />
                    <div class="row q-mt-md justify-end">
                      <q-btn flat label="Cerrar" v-close-popup size="sm" />
                      <q-btn color="primary" label="Ejecutar" v-close-popup size="sm" @click="store.fetchData" />
                    </div>
                  </div>
                </q-menu>
              </q-chip>
              <span v-if="!store.pivotFilters.length" class="zone-placeholder">Arrastre campos aquí</span>
            </div>
          </div>
          <div class="drop-zones-row">
            <div class="drop-zone zone-rows" @dragover.prevent @dragenter.prevent="dragOverZone = 'rows'"
              @dragleave="dragOverZone = null" @drop="onDrop($event, 'rows')"
              :class="{ 'zone-active': dragOverZone === 'rows' }">
              <span class="zone-label"><q-icon name="table_rows" size="16px" /> Filas</span>
              <div class="zone-chips">
                <q-chip v-for="f in store.pivotRows" :key="f.key" removable dense
                  @remove="store.removeFieldFromZone(f.key, 'rows')" color="blue-2" text-color="black">
                  {{ f.label }}
                </q-chip>
                <span v-if="!store.pivotRows.length" class="zone-placeholder">Arrastre campos aquí</span>
              </div>
            </div>
            <div class="drop-zone zone-columns" @dragover.prevent @dragenter.prevent="dragOverZone = 'columns'"
              @dragleave="dragOverZone = null" @drop="onDrop($event, 'columns')"
              :class="{ 'zone-active': dragOverZone === 'columns' }">
              <span class="zone-label"><q-icon name="view_column" size="16px" /> Columnas</span>
              <div class="zone-chips">
                <q-chip v-for="f in store.pivotColumns" :key="f.key" removable dense
                  @remove="store.removeFieldFromZone(f.key, 'columns')" color="green-2" text-color="black">
                  {{ f.label }}
                </q-chip>
                <span v-if="!store.pivotColumns.length" class="zone-placeholder">Arrastre campos aquí</span>
              </div>
            </div>
            <div class="drop-zone zone-values" @dragover.prevent @dragenter.prevent="dragOverZone = 'values'"
              @dragleave="dragOverZone = null" @drop="onDrop($event, 'values')"
              :class="{ 'zone-active': dragOverZone === 'values' }">
              <span class="zone-label"><q-icon name="functions" size="16px" /> Valores</span>
              <div class="zone-chips">
                <q-chip v-for="f in store.pivotValues" :key="f.key" removable dense
                  @remove="store.removeFieldFromZone(f.key, 'values')" color="purple-2" text-color="black">
                  {{ f.label }} ({{ f.aggregation }})
                  <q-menu>
                    <q-list dense>
                      <q-item v-for="agg in ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']" :key="agg" clickable v-close-popup
                        @click="store.changeAggregation(f.key, agg)">
                        <q-item-section>{{ agg }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-chip>
                <span v-if="!store.pivotValues.length" class="zone-placeholder">Arrastre campos aquí</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Execute button -->
        <div class="execute-bar" v-if="store.hasConfig">
          <q-btn color="primary" icon="play_arrow" label="Ejecutar Consulta" @click="store.fetchData"
            :loading="store.dataLoading" unelevated class="full-width" />
        </div>

        <!-- Results: Tabs for Table and Chart -->
        <div class="results-panel" v-if="store.rawData.length">
          <q-tabs v-model="activeTab" dense align="left" class="results-tabs" active-color="primary"
            indicator-color="primary">
            <q-tab name="table" icon="grid_on" label="Tabla" />
            <q-tab name="chart" icon="bar_chart" label="Gráfico" />
          </q-tabs>
          <q-separator />
          <q-tab-panels v-model="activeTab" animated class="results-content">
            <q-tab-panel name="table" class="q-pa-none">
              <PivotTable ref="pivotTableRef" />
            </q-tab-panel>
            <q-tab-panel name="chart" class="q-pa-sm">
              <div class="chart-toolbar">
                <q-btn-toggle v-model="store.chartType" dense flat toggle-color="primary" :options="[
                  { label: 'Barras', value: 'bar', icon: 'bar_chart' },
                  { label: 'H. Barras', value: 'hbar', icon: 'align_horizontal_left' },
                  { label: 'Línea', value: 'line', icon: 'show_chart' },
                  { label: 'Torta', value: 'pie', icon: 'pie_chart' },
                  { label: 'Dona', value: 'doughnut', icon: 'donut_large' },
                ]" />
                <q-toggle v-model="store.chartStacked" label="Apilado" dense
                  v-if="['bar', 'hbar', 'line'].includes(store.chartType)" />
                <q-toggle v-model="store.chartShowLabels" label="Mostrar Etiquetas" dense />
                <q-btn flat round dense icon="palette" color="primary" @click="showColorDialog = true"
                  v-if="store.rawData.length">
                  <q-tooltip>Personalizar Colores</q-tooltip>
                </q-btn>
              </div>
              <PivotChart ref="pivotChartRef" />
            </q-tab-panel>
          </q-tab-panels>
        </div>

        <!-- Empty state -->
        <div v-else-if="!store.dataLoading" class="empty-state">
          <q-icon name="analytics" size="80px" color="grey-4" />
          <p class="text-h6 text-grey-6 q-mt-md">Arrastra campos a las zonas y ejecuta la consulta</p>
          <p class="text-caption text-grey-5">Funciona como las tablas dinámicas de Excel</p>
        </div>

        <q-inner-loading :showing="store.dataLoading">
          <q-spinner-dots size="50px" color="primary" />
        </q-inner-loading>
      </div>
    </div>

    <!-- ═══ Save Dialog ══════════════════════════════════════════════════ -->
    <q-dialog v-model="showSaveDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6"><q-icon name="save" class="q-mr-sm" />Guardar Consulta</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="saveName" label="Nombre *" outlined dense class="q-mb-md" />
          <q-input v-model="saveDescription" label="Descripción" outlined dense type="textarea" rows="2"
            class="q-mb-md" />
          <q-select v-model="saveVisibility"
            :options="[{ label: 'Privada', value: 'private' }, { label: 'Pública', value: 'public' }]"
            label="Visibilidad" outlined dense emit-value map-options />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" @click="showSaveDialog = false" />
          <q-btn color="primary" label="Guardar" @click="handleSave" :disable="!saveName" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ═══ Color Customization Dialog ══════════════════════════════════ -->
    <q-dialog v-model="showColorDialog">
      <q-card style="min-width: 350px">
        <q-card-section class="bg-primary text-white row items-center">
          <div class="text-h6"><q-icon name="palette" class="q-mr-sm" />Colores del Gráfico</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pa-md" style="max-height: 60vh; overflow-y: auto">
          <div v-if="!currentChartSeries.length" class="text-center text-grey q-pa-lg">
            No hay series activas para colorear
          </div>
          <q-list v-else separator>
            <q-item v-for="series in currentChartSeries" :key="series" class="q-px-none">
              <q-item-section>
                <q-item-label>{{ series }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn round flat>
                  <div
                    :style="{ background: store.chartCustomColors[series] || '#ddd', width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ccc' }">
                  </div>
                  <q-menu>
                    <q-color v-model="store.chartCustomColors[series]" no-header no-footer default-view="palette"
                      class="my-picker" />
                  </q-menu>
                </q-btn>
              </q-item-section>
              <q-item-section side v-if="store.chartCustomColors[series]">
                <q-btn icon="close" size="sm" flat round @click="delete store.chartCustomColors[series]" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-separator />

        <q-card-actions align="between" class="q-px-md">
          <q-btn flat label="Restablecer Todo" color="negative" @click="store.chartCustomColors = {}" />
          <q-btn flat label="Cerrar" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDashboardStore } from 'src/stores/dashboard.store';
import PivotTable from 'src/components/dashboard/PivotTable.vue';
import PivotChart from 'src/components/dashboard/PivotChart.vue';

const store = useDashboardStore();

// ─── Local state ──────────────────────────────────────────────────────────────
const fieldSearch = ref('');
const expandedCategories = ref({});
const dragOverZone = ref(null);
const activeTab = ref('table');
const pivotTableRef = ref(null);
const pivotChartRef = ref(null);

// Save dialog
const showSaveDialog = ref(false);
const showColorDialog = ref(false);
const saveAsNew = ref(false);
const saveName = ref('');
const saveDescription = ref('');
const saveVisibility = ref('private');

// ─── Computed ─────────────────────────────────────────────────────────────────
const filteredFields = computed(() => {
  const search = (fieldSearch.value || '').toLowerCase();
  const result = {};
  for (const [cat, fields] of Object.entries(store.fieldsByCategory)) {
    const filtered = search ? fields.filter(f => f.label.toLowerCase().includes(search) || f.key.toLowerCase().includes(search)) : fields;
    if (filtered.length) result[cat] = filtered;
  }
  return result;
});

const currentChartSeries = computed(() => {
  const td = store.pivotTableData;
  if (!td.bodyRows?.length) return [];
  const type = store.chartType;
  const isPie = type === 'pie' || type === 'doughnut';

  if (isPie) {
    if (store.pivotRows.length === 0) {
      if (td.hasPivotColumns) {
        // Sin filas pero con columnas: cada combo columna-valor es una tajada
        const valueHeaders = td.headers.filter(h => h.isValue);
        return valueHeaders.map(h => `${h.label} - ${h.subLabel}`);
      }
      // Sin filas y sin columnas: cada campo de valor es una tajada
      const valueHeaderKeys = td.headers.filter((_, i) => i >= store.pivotRows.length);
      return valueHeaderKeys.map(h => h.label);
    }
    // Con filas: cada categoría de fila es una tajada
    const rowHeaderKeys = td.headers.filter(h => h.isRowHeader).map(h => h.key);
    return td.bodyRows.map(row => rowHeaderKeys.map(k => row[k] || '').join(' | '));
  }

  if (td.hasPivotColumns) {
    // Barras/Líneas con columnas: cada grupo de columna es una serie
    const valueHeaders = td.headers.filter(h => h.isValue);
    const colValuesSet = [...new Set(valueHeaders.map(h => h.label))];
    return colValuesSet;
  }

  // Barras/Líneas simples: cada campo de valor es una serie
  const valueHeaderKeys = td.headers.filter((_, i) => i >= store.pivotRows.length);
  return valueHeaderKeys.map(h => h.label);
});

// ─── Methods ──────────────────────────────────────────────────────────────────
function toggleCategory(cat) {
  expandedCategories.value[cat] = !expandedCategories.value[cat];
}

function onDragStart(event, field) {
  event.dataTransfer.setData('application/json', JSON.stringify(field));
  event.dataTransfer.effectAllowed = 'move';
}

function onDrop(event, zone) {
  dragOverZone.value = null;
  try {
    const field = JSON.parse(event.dataTransfer.getData('application/json'));
    store.addFieldToZone(field, zone);
  } catch (e) { /* ignore */ }
}

function getFilterLabel(f) {
  if (!f.value && f.value !== 0) return '(vacío)';
  const opMap = {
    eq: '=', neq: '≠', like: 'contiene', gt: '>', lt: '<', gte: '≥', lte: '≤', in: 'uno de'
  };
  return `${opMap[f.operator] || f.operator} "${f.value}"`;
}

async function handleSave() {
  if (saveAsNew.value) store.currentQueryId = null;
  const ok = await store.saveCurrentQuery(saveName.value, saveDescription.value, saveVisibility.value);
  if (ok) {
    showSaveDialog.value = false;
    saveAsNew.value = false;
  }
}

// ─── Export functions ─────────────────────────────────────────────────────────
function exportCSV() {
  const data = store.pivotTableData;
  if (!data.bodyRows?.length) return;
  const headers = data.headers.map(h => h.subLabel ? `${h.label} - ${h.subLabel}` : h.label);
  const keys = data.headers.map(h => h.key);
  let csv = headers.join(',') + '\n';
  data.bodyRows.forEach(row => {
    csv += keys.map(k => `"${row[k] ?? ''}"`).join(',') + '\n';
  });
  downloadFile(csv, 'dashboard.csv', 'text/csv');
}

function exportJSON() {
  const data = store.rawData;
  downloadFile(JSON.stringify(data, null, 2), 'dashboard.json', 'application/json');
}

async function exportExcel() {
  // Dynamic import of SheetJS
  const XLSX = await import('xlsx');
  const data = store.pivotTableData;
  if (!data.bodyRows?.length) return;
  const headers = data.headers.map(h => h.subLabel ? `${h.label} - ${h.subLabel}` : h.label);
  const keys = data.headers.map(h => h.key);
  const wsData = [headers, ...data.bodyRows.map(row => keys.map(k => row[k] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard');
  XLSX.writeFile(wb, 'dashboard.xlsx');
}

function exportChartPNG() {
  pivotChartRef.value?.exportPNG();
}

function exportChartPDF() {
  pivotChartRef.value?.exportPDF();
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await store.loadAvailableFields();
  await store.loadSavedQueries();
  // Expand all categories by default
  for (const cat of Object.keys(store.fieldsByCategory)) {
    expandedCategories.value[cat] = true;
  }
});
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 50px);
  background: #f5f7fa;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e0e4e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dashboard-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ─── Fields Panel ──────────────────────────────────────────────── */
.fields-panel {
  width: 260px;
  min-width: 260px;
  background: white;
  border-right: 1px solid #e0e4e8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #eee;
}

.fields-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.field-category {
  margin-bottom: 2px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #555;
  background: #fafafa;
  user-select: none;
}

.category-header:hover {
  background: #f0f0f0;
}

.category-fields {
  padding: 2px 8px 4px 8px;
}

.field-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  margin: 2px 0;
  border-radius: 4px;
  cursor: grab;
  font-size: 12px;
  background: #f8f9ff;
  border: 1px solid #e8eaf6;
  transition: all 0.15s;
  user-select: none;
}

.field-chip:hover {
  background: #e3f2fd;
  border-color: #90caf9;
  transform: translateX(2px);
}

.field-chip:active {
  cursor: grabbing;
}

.field-icon {
  color: #78909c;
}

.field-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Center Panel ──────────────────────────────────────────────── */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  gap: 10px;
}

/* ─── Drop Zones ────────────────────────────────────────────────── */
.drop-zones {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drop-zones-row {
  display: flex;
  gap: 6px;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fafafa;
  transition: all 0.2s;
  min-height: 42px;
}

.drop-zone.zone-active {
  border-color: #1976d2;
  background: #e3f2fd;
}

.zone-rows {
  flex: 1;
}

.zone-columns {
  flex: 1;
}

.zone-values {
  flex: 1;
}

.zone-label {
  font-size: 11px;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.zone-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.zone-placeholder {
  font-size: 12px;
  color: #bbb;
  font-style: italic;
}

.execute-bar {
  display: flex;
}

/* ─── Results ───────────────────────────────────────────────────── */
.results-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.results-tabs {
  background: #fafafa;
}

.results-content {
  flex: 1;
  overflow: auto;
}

.chart-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>
