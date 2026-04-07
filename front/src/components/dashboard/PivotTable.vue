<template>
  <div class="pivot-table-container" ref="tableContainer">
    <div class="pivot-info-bar" v-if="tableData.bodyRows?.length">
      <span class="row-count">{{ tableData.bodyRows.length }} filas</span>
      <span class="total-label" v-if="store.totalRows">de {{ store.totalRows }} registros</span>
    </div>
    <div class="pivot-table-scroll">
      <table class="pivot-table" v-if="tableData.headers?.length">
        <!-- Header -->
        <thead>
          <!-- If pivot columns: 2-row header -->
          <tr v-if="tableData.hasPivotColumns" class="pivot-header-top">
            <th v-for="h in tableData.headers.filter(h => h.isRowHeader)" :key="'rh-'+h.key"
              class="pivot-th pivot-th-row" :rowspan="2">{{ h.label }}</th>
            <template v-for="cv in tableData.colValues" :key="'cv-'+cv">
              <th :colspan="store.pivotValues.length" class="pivot-th pivot-th-col">{{ cv }}</th>
            </template>
            <th class="pivot-th pivot-th-total" :rowspan="2" v-if="tableData.colValues?.length">Total</th>
          </tr>
          <tr v-if="tableData.hasPivotColumns" class="pivot-header-sub">
            <template v-for="cv in tableData.colValues" :key="'cvs-'+cv">
              <th v-for="v in store.pivotValues" :key="'vs-'+cv+v.key" class="pivot-th pivot-th-val">
                {{ v.aggregation || 'COUNT' }}
              </th>
            </template>
          </tr>
          <!-- Simple header (no pivot columns) -->
          <tr v-if="!tableData.hasPivotColumns" class="pivot-header-simple">
            <th v-for="h in tableData.headers" :key="'sh-'+h.key" class="pivot-th"
              @click="sortBy(h.key)" :class="{ 'sort-active': sortColumn === h.key }">
              {{ h.label }}
              <q-icon v-if="sortColumn === h.key" :name="sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'" size="14px" />
            </th>
          </tr>
        </thead>
        <!-- Body -->
        <tbody>
          <tr v-for="(row, idx) in sortedRows" :key="idx" class="pivot-row" :class="{ 'row-even': idx % 2 === 0 }">
            <template v-if="!tableData.hasPivotColumns">
              <td v-for="h in tableData.headers" :key="'d-'+h.key"
                class="pivot-td" :class="{ 'td-numeric': isNumeric(row[h.key]) }">
                {{ formatValue(row[h.key]) }}
              </td>
            </template>
            <template v-else>
              <td v-for="h in tableData.headers.filter(h => h.isRowHeader)" :key="'dr-'+h.key"
                class="pivot-td pivot-td-row">{{ formatValue(row[h.key]) }}</td>
              <td v-for="h in tableData.headers.filter(h => h.isValue)" :key="'dv-'+h.key"
                class="pivot-td td-numeric" :class="heatmapClass(row[h.key], h.key)">
                {{ formatNumber(row[h.key]) }}
              </td>
              <td class="pivot-td td-numeric td-total">{{ formatNumber(rowTotal(row)) }}</td>
            </template>
          </tr>
        </tbody>
        <!-- Footer: Grand Totals -->
        <tfoot v-if="tableData.grandTotals && Object.keys(tableData.grandTotals).length">
          <tr class="pivot-total-row">
            <td v-if="tableData.hasPivotColumns"
              :colspan="store.pivotRows.length" class="pivot-td pivot-td-total-label">Gran Total</td>
            <td v-if="!tableData.hasPivotColumns"
              :colspan="store.pivotRows.length || 1" class="pivot-td pivot-td-total-label">Total</td>
            <template v-if="!tableData.hasPivotColumns">
              <td v-for="h in tableData.headers.filter((h,i) => i >= (store.pivotRows.length || 1))"
                :key="'gt-'+h.key" class="pivot-td td-numeric td-total">
                {{ formatNumber(tableData.grandTotals[h.key]) }}
              </td>
            </template>
            <template v-else>
              <td v-for="h in tableData.headers.filter(h => h.isValue)" :key="'gtv-'+h.key"
                class="pivot-td td-numeric td-total">
                {{ formatNumber(tableData.grandTotals[h.key]) }}
              </td>
              <td class="pivot-td td-numeric td-total td-grand-total">
                {{ formatNumber(Object.values(tableData.grandTotals).reduce((a,b) => a + (Number(b)||0), 0)) }}
              </td>
            </template>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDashboardStore } from 'src/stores/dashboard.store';

const store = useDashboardStore();
const tableContainer = ref(null);
const sortColumn = ref(null);
const sortDir = ref('asc');

const tableData = computed(() => store.pivotTableData);

const sortedRows = computed(() => {
  const rows = [...(tableData.value.bodyRows || [])];
  if (sortColumn.value) {
    rows.sort((a, b) => {
      const va = a[sortColumn.value];
      const vb = b[sortColumn.value];
      const isNum = !isNaN(Number(va)) && !isNaN(Number(vb));
      if (isNum) return sortDir.value === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
      return sortDir.value === 'asc'
        ? String(va || '').localeCompare(String(vb || ''))
        : String(vb || '').localeCompare(String(va || ''));
    });
  }
  return rows;
});

function sortBy(key) {
  if (sortColumn.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = key;
    sortDir.value = 'asc';
  }
}

function isNumeric(val) {
  return val !== null && val !== undefined && !isNaN(Number(val));
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  return val;
}

function formatNumber(val) {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

function rowTotal(row) {
  const valHeaders = tableData.value.headers.filter(h => h.isValue);
  return valHeaders.reduce((sum, h) => sum + (Number(row[h.key]) || 0), 0);
}

// Heatmap coloring based on relative value
function heatmapClass(val, key) {
  if (!val || !tableData.value.bodyRows?.length) return '';
  const values = tableData.value.bodyRows.map(r => Number(r[key]) || 0);
  const max = Math.max(...values);
  if (max === 0) return '';
  const ratio = (Number(val) || 0) / max;
  if (ratio > 0.8) return 'heat-high';
  if (ratio > 0.5) return 'heat-medium';
  if (ratio > 0.2) return 'heat-low';
  return '';
}

defineExpose({ tableContainer });
</script>

<style scoped>
.pivot-table-container { display: flex; flex-direction: column; height: 100%; }
.pivot-info-bar {
  display: flex; gap: 8px; padding: 6px 12px; font-size: 12px; color: #777;
  background: #f8f9fa; border-bottom: 1px solid #e8e8e8;
}
.pivot-table-scroll { flex: 1; overflow: auto; }

.pivot-table {
  width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Segoe UI', Tahoma, sans-serif;
}
/* ─── Headers ──────────────────────────────────────────── */
.pivot-th {
  background: #4472c4; color: white; font-weight: 600; padding: 8px 12px;
  text-align: left; border: 1px solid #3a62a8; white-space: nowrap;
  position: sticky; top: 0; z-index: 2; cursor: pointer; user-select: none;
  font-size: 12px; letter-spacing: 0.3px;
}
.pivot-th:hover { background: #3a62a8; }
.pivot-th-row { background: #2e5090; }
.pivot-th-col { text-align: center; background: #5b9bd5; }
.pivot-th-val { text-align: center; font-size: 11px; font-weight: 500; background: #6fadd8; }
.pivot-th-total { background: #2e4057; text-align: center; }
.pivot-header-simple .pivot-th { background: #4472c4; }
.sort-active { background: #2e5090 !important; }

/* ─── Body ─────────────────────────────────────────────── */
.pivot-td {
  padding: 6px 12px; border: 1px solid #e2e8f0; white-space: nowrap;
}
.row-even { background: #f8fafd; }
.pivot-row:hover { background: #e8f0fe !important; }
.td-numeric { text-align: right; font-variant-numeric: tabular-nums; }
.pivot-td-row { font-weight: 500; background: #f0f4f8; }
.td-total { font-weight: 700; background: #edf2f7; }
.td-grand-total { background: #dce6f1; }

/* ─── Heatmap ──────────────────────────────────────────── */
.heat-high { background: rgba(76, 175, 80, 0.2) !important; }
.heat-medium { background: rgba(255, 193, 7, 0.15) !important; }
.heat-low { background: rgba(33, 150, 243, 0.1) !important; }

/* ─── Total Row ────────────────────────────────────────── */
.pivot-total-row { position: sticky; bottom: 0; z-index: 1; }
.pivot-total-row .pivot-td { background: #d8e2ef; font-weight: 700; border-top: 2px solid #4472c4; }
.pivot-td-total-label { font-weight: 700; text-align: left; }
</style>
