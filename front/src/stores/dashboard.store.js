// src/stores/dashboard.store.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dashboardService, savedQueriesService } from 'src/services/dashboard.service';

export const useDashboardStore = defineStore('dashboard', () => {
    // ─── State ────────────────────────────────────────────────────────────────
    const availableFields = ref([]);
    const loading = ref(false);
    const dataLoading = ref(false);

    // Pivot config
    const pivotRows = ref([]);
    const pivotColumns = ref([]);
    const pivotValues = ref([]);
    const pivotFilters = ref([]);

    // Chart config
    const chartType = ref('bar');
    const chartStacked = ref(false);
    const chartShowLabels = ref(false);
    const chartCustomColors = ref({});

    // Data
    const rawData = ref([]);
    const dataColumns = ref([]);
    const totalRows = ref(0);

    // Saved queries
    const savedQueries = ref([]);
    const currentQueryId = ref(null);
    const currentQueryName = ref('');

    // ─── Computed ─────────────────────────────────────────────────────────────
    const fieldsByCategory = computed(() => {
        const categories = {};
        for (const field of availableFields.value) {
            if (!categories[field.category]) {
                categories[field.category] = [];
            }
            categories[field.category].push(field);
        }
        return categories;
    });

    const hasConfig = computed(() =>
        pivotRows.value.length > 0 || pivotColumns.value.length > 0 || pivotValues.value.length > 0
    );

    const pivotConfig = computed(() => ({
        rows: pivotRows.value.map(f => f.key),
        columns: pivotColumns.value.map(f => f.key),
        values: pivotValues.value.map(f => ({ field: f.key, aggregation: f.aggregation || 'COUNT' })),
        filters: pivotFilters.value,
    }));

    // ─── Pivot table computed data ────────────────────────────────────────────
    const pivotTableData = computed(() => {
        if (!rawData.value.length) return { headers: [], rows: [], grandTotals: {} };
        return computePivotTable();
    });

    // ─── Actions ──────────────────────────────────────────────────────────────
    async function loadAvailableFields() {
        try {
            loading.value = true;
            const res = await dashboardService.getAvailableFields();
            const data = res.data?.data?.availableFields;
            if (data) {
                availableFields.value = JSON.parse(data);
            }
        } catch (err) {
            console.error('Error loading fields:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchData() {
        if (!hasConfig.value) return;
        try {
            dataLoading.value = true;
            const groupBy = [...pivotRows.value, ...pivotColumns.value].map(f => f.key);
            const values = pivotValues.value.map(f => ({
                field: f.key,
                aggregation: f.aggregation || 'COUNT',
            }));
            const fields = groupBy.length === 0
                ? [...pivotRows.value, ...pivotColumns.value, ...pivotValues.value].map(f => f.key)
                : undefined;
            const filters = pivotFilters.value
                .filter(f => f.value !== undefined && f.value !== '')
                .map(f => ({ field: f.field, operator: f.operator || 'eq', value: String(f.value) }));

            const res = await dashboardService.getData({
                fields,
                filters,
                groupBy: groupBy.length > 0 ? groupBy : undefined,
                values: values.length > 0 ? values : undefined,
                limit: 5000,
            });

            const result = res.data?.data?.dashboardData;
            if (result) {
                dataColumns.value = result.columns || [];
                rawData.value = JSON.parse(result.rows || '[]');
                totalRows.value = result.totalRows || 0;
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            dataLoading.value = false;
        }
    }

    function computePivotTable() {
        const rows = rawData.value;
        if (!rows.length) return { headers: [], bodyRows: [], grandTotals: {} };

        const rowKeys = pivotRows.value.map(f => f.key.replace('.', '_'));
        const colKeys = pivotColumns.value.map(f => f.key.replace('.', '_'));
        const valKeys = pivotValues.value.map(f => {
            const agg = (f.aggregation || 'COUNT').toLowerCase();
            return `${f.key.replace('.', '_')}_${agg}`;
        });

        // If no column pivoting, return flat table
        if (colKeys.length === 0) {
            const headers = [
                ...pivotRows.value.map(f => ({ key: f.key.replace('.', '_'), label: f.label })),
                ...pivotValues.value.map(f => ({
                    key: `${f.key.replace('.', '_')}_${(f.aggregation || 'COUNT').toLowerCase()}`,
                    label: `${f.label} (${f.aggregation || 'COUNT'})`,
                })),
            ];
            const grandTotals = {};
            valKeys.forEach(vk => { grandTotals[vk] = 0; });
            rows.forEach(row => {
                valKeys.forEach(vk => {
                    grandTotals[vk] += Number(row[vk]) || 0;
                });
            });
            return { headers, bodyRows: rows, grandTotals, hasPivotColumns: false };
        }

        // With column pivoting: need to cross-tab
        const colValuesSet = new Set();
        rows.forEach(row => {
            const colVal = colKeys.map(ck => row[ck] || '(vacío)').join(' | ');
            colValuesSet.add(colVal);
        });
        const colValues = [...colValuesSet].sort();

        // Build headers
        const headers = [
            ...pivotRows.value.map(f => ({ key: f.key.replace('.', '_'), label: f.label, isRowHeader: true })),
        ];
        colValues.forEach(cv => {
            pivotValues.value.forEach(f => {
                headers.push({
                    key: `${cv}__${f.key}`,
                    label: cv,
                    subLabel: `${f.label} (${f.aggregation || 'COUNT'})`,
                    isValue: true,
                });
            });
        });

        // Build cross-tab rows
        const rowGroups = {};
        rows.forEach(row => {
            const rowKey = rowKeys.map(rk => row[rk] || '(vacío)').join('|||');
            if (!rowGroups[rowKey]) {
                rowGroups[rowKey] = { _rowValues: {} };
                rowKeys.forEach(rk => { rowGroups[rowKey][rk] = row[rk]; });
            }
            const colVal = colKeys.map(ck => row[ck] || '(vacío)').join(' | ');
            valKeys.forEach((vk, vi) => {
                const hKey = `${colVal}__${pivotValues.value[vi].key}`;
                rowGroups[rowKey]._rowValues[hKey] = Number(row[vk]) || 0;
            });
        });

        const bodyRows = Object.values(rowGroups).map(group => {
            const row = {};
            rowKeys.forEach(rk => { row[rk] = group[rk]; });
            headers.filter(h => h.isValue).forEach(h => {
                row[h.key] = group._rowValues[h.key] || 0;
            });
            return row;
        });

        // Grand totals
        const grandTotals = {};
        headers.filter(h => h.isValue).forEach(h => {
            grandTotals[h.key] = bodyRows.reduce((sum, r) => sum + (Number(r[h.key]) || 0), 0);
        });

        return { headers, bodyRows, grandTotals, hasPivotColumns: true, colValues };
    }

    // ─── Field drag & drop ────────────────────────────────────────────────────
    function addFieldToZone(field, zone) {
        const fieldCopy = { ...field, aggregation: field.numeric ? 'SUM' : 'COUNT' };

        switch (zone) {
            case 'rows':
                if (!pivotRows.value.some(f => f.key === field.key)) {
                    pivotRows.value.push(fieldCopy);
                }
                break;
            case 'columns':
                if (!pivotColumns.value.some(f => f.key === field.key)) {
                    pivotColumns.value.push(fieldCopy);
                }
                break;
            case 'values':
                // Note: In values we actually could have the same field twice with different aggregations,
                // but for now let's keep it unique by field name for simplification.
                if (!pivotValues.value.some(f => f.key === field.key)) {
                    pivotValues.value.push(fieldCopy);
                }
                break;
            case 'filters':
                if (!pivotFilters.value.some(f => f.field === field.key)) {
                    pivotFilters.value.push({
                        field: field.key,
                        label: field.label,
                        operator: (field.numeric || field.date) ? 'eq' : 'like',
                        value: '',
                        numeric: !!field.numeric,
                        date: !!field.date
                    });
                }
                break;
        }
    }

    function removeFieldFromZone(fieldKey, zone) {
        switch (zone) {
            case 'rows': pivotRows.value = pivotRows.value.filter(f => f.key !== fieldKey); break;
            case 'columns': pivotColumns.value = pivotColumns.value.filter(f => f.key !== fieldKey); break;
            case 'values': pivotValues.value = pivotValues.value.filter(f => f.key !== fieldKey); break;
            case 'filters': pivotFilters.value = pivotFilters.value.filter(f => f.field !== fieldKey); break;
        }
    }

    function removeFieldFromAllZones(fieldKey) {
        pivotRows.value = pivotRows.value.filter(f => f.key !== fieldKey);
        pivotColumns.value = pivotColumns.value.filter(f => f.key !== fieldKey);
        pivotValues.value = pivotValues.value.filter(f => f.key !== fieldKey);
        pivotFilters.value = pivotFilters.value.filter(f => f.field !== fieldKey);
    }

    function changeAggregation(fieldKey, aggregation) {
        const field = pivotValues.value.find(f => f.key === fieldKey);
        if (field) field.aggregation = aggregation;
    }

    function clearConfig() {
        pivotRows.value = [];
        pivotColumns.value = [];
        pivotValues.value = [];
        pivotFilters.value = [];
        rawData.value = [];
        dataColumns.value = [];
        currentQueryId.value = null;
        currentQueryName.value = '';
    }

    // ─── Saved queries ────────────────────────────────────────────────────────
    async function loadSavedQueries() {
        try {
            const res = await savedQueriesService.list();
            savedQueries.value = res.data || [];
        } catch (err) {
            console.error('Error loading saved queries:', err);
        }
    }

    async function saveCurrentQuery(name, description, visibility = 'private') {
        const data = {
            name,
            description,
            graphql_query: '',
            pivot_config: {
                rows: pivotRows.value,
                columns: pivotColumns.value,
                values: pivotValues.value,
                filters: pivotFilters.value,
            },
            chart_config: {
                type: chartType.value,
                stacked: chartStacked.value,
                showLabels: chartShowLabels.value,
                customColors: chartCustomColors.value
            },
            visibility,
        };

        try {
            if (currentQueryId.value) {
                await savedQueriesService.update(currentQueryId.value, data);
            } else {
                const res = await savedQueriesService.create(data);
                currentQueryId.value = res.data.id;
            }
            currentQueryName.value = name;
            await loadSavedQueries();
            return true;
        } catch (err) {
            console.error('Error saving query:', err);
            return false;
        }
    }

    async function loadSavedQuery(query) {
        currentQueryId.value = query.id;
        currentQueryName.value = query.name;
        const config = typeof query.pivot_config === 'string'
            ? JSON.parse(query.pivot_config) : query.pivot_config;
        const chart = typeof query.chart_config === 'string'
            ? JSON.parse(query.chart_config) : (query.chart_config || {});

        pivotRows.value = config.rows || [];
        pivotColumns.value = config.columns || [];
        pivotValues.value = config.values || [];
        pivotFilters.value = config.filters || [];
        chartType.value = chart.type || 'bar';
        chartStacked.value = chart.stacked || false;
        chartShowLabels.value = chart.showLabels || false;
        chartCustomColors.value = chart.customColors || {};

        await fetchData();
    }

    async function deleteSavedQuery(id) {
        try {
            await savedQueriesService.delete(id);
            if (currentQueryId.value === id) {
                clearConfig();
            }
            await loadSavedQueries();
            return true;
        } catch (err) {
            console.error('Error deleting query:', err);
            return false;
        }
    }

    return {
        // State
        availableFields, loading, dataLoading,
        pivotRows, pivotColumns, pivotValues, pivotFilters,
        chartType, chartStacked, chartShowLabels, chartCustomColors,
        rawData, dataColumns, totalRows,
        savedQueries, currentQueryId, currentQueryName,
        // Computed
        fieldsByCategory, hasConfig, pivotConfig, pivotTableData,
        // Actions
        loadAvailableFields, fetchData,
        addFieldToZone, removeFieldFromZone, removeFieldFromAllZones,
        changeAggregation, clearConfig,
        loadSavedQueries, saveCurrentQuery, loadSavedQuery, deleteSavedQuery,
    };
});
