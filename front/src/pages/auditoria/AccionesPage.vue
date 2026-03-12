<template>
    <q-page padding>
        <div class="text-h4 q-mb-md">Auditoría - Registro de Acciones</div>

        <q-card class="q-mb-md">
            <q-card-section>
                <!-- Buscador general -->
                <div class="row q-col-gutter-md q-mb-md">
                    <div class="col-12 col-md-4">
                        <q-input v-model="globalSearch" dense outlined placeholder="Buscar en todos los campos..."
                            clearable>
                            <template v-slot:prepend>
                                <q-icon name="search" />
                            </template>
                        </q-input>
                    </div>
                    <div class="col-12 col-md-8 row justify-end q-gutter-sm">
                        <!-- Botones de exportación -->
                        <q-btn-dropdown color="primary" label="Exportar" icon="download">
                            <q-list>
                                <q-item-label header>Página actual</q-item-label>
                                <q-item clickable v-close-popup @click="exportData('excel', 'page')">
                                    <q-item-section avatar><q-icon name="grid_on" color="green" /></q-item-section>
                                    <q-item-section>Excel (.xlsx)</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('csv', 'page')">
                                    <q-item-section avatar><q-icon name="text_snippet" color="blue" /></q-item-section>
                                    <q-item-section>CSV</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('json', 'page')">
                                    <q-item-section avatar><q-icon name="code" color="orange" /></q-item-section>
                                    <q-item-section>JSON</q-item-section>
                                </q-item>
                                <q-separator />
                                <q-item-label header>Filtrados ({{ filteredLogs.length }})</q-item-label>
                                <q-item clickable v-close-popup @click="exportData('excel', 'filtered')">
                                    <q-item-section avatar><q-icon name="grid_on" color="green" /></q-item-section>
                                    <q-item-section>Excel (.xlsx)</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('csv', 'filtered')">
                                    <q-item-section avatar><q-icon name="text_snippet" color="blue" /></q-item-section>
                                    <q-item-section>CSV</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('json', 'filtered')">
                                    <q-item-section avatar><q-icon name="code" color="orange" /></q-item-section>
                                    <q-item-section>JSON</q-item-section>
                                </q-item>
                                <q-separator />
                                <q-item-label header>Todos ({{ logs.length }})</q-item-label>
                                <q-item clickable v-close-popup @click="exportData('excel', 'all')">
                                    <q-item-section avatar><q-icon name="grid_on" color="green" /></q-item-section>
                                    <q-item-section>Excel (.xlsx)</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('csv', 'all')">
                                    <q-item-section avatar><q-icon name="text_snippet" color="blue" /></q-item-section>
                                    <q-item-section>CSV</q-item-section>
                                </q-item>
                                <q-item clickable v-close-popup @click="exportData('json', 'all')">
                                    <q-item-section avatar><q-icon name="code" color="orange" /></q-item-section>
                                    <q-item-section>JSON</q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
                    </div>
                </div>

                <!-- Filtros por columna - Primera fila -->
                <div class="row q-col-gutter-sm q-mb-sm">
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.fecha" dense outlined label="Fecha" clearable hint="DD/MM/YYYY" />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.id_usuario" dense outlined label="ID Usuario" clearable
                            type="number" />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.usuario" dense outlined label="Usuario" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.ip" dense outlined label="IP" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.tabla" dense outlined label="Tabla" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-select v-model="filters.accion" dense outlined label="Acción" clearable emit-value
                            map-options :options="accionOptions" />
                    </div>
                </div>
                <!-- Filtros por columna - Segunda fila -->
                <div class="row q-col-gutter-sm">
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.id_registro" dense outlined label="Registro" clearable
                            type="number" />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.datos_anteriores" dense outlined label="Datos Anteriores" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.datos_nuevos" dense outlined label="Datos Posteriores" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.campos_modificados" dense outlined label="Columnas" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-4">
                        <q-input v-model="filters.comando_sql" dense outlined label="SQL" clearable />
                    </div>
                </div>
            </q-card-section>
        </q-card>

        <q-table :rows="filteredLogs" :columns="columns" row-key="id" :loading="loading" :pagination="pagination"
            @update:pagination="onPaginationChange" :rows-per-page-options="[10, 20, 50, 100, 0]">
            <template v-slot:body-cell-accion="props">
                <q-td :props="props">
                    <q-badge :color="getAccionColor(props.row.accion)">
                        {{ formatAccion(props.row.accion) }}
                    </q-badge>
                </q-td>
            </template>
            <template v-slot:body-cell-datos_anteriores="props">
                <q-td :props="props">
                    <q-btn v-if="props.row.datos_anteriores" flat dense size="sm" icon="visibility" color="primary"
                        @click="showJsonDialog('Datos Anteriores', props.row.datos_anteriores)">
                        <q-tooltip>Ver datos</q-tooltip>
                    </q-btn>
                    <span v-else>-</span>
                </q-td>
            </template>
            <template v-slot:body-cell-datos_nuevos="props">
                <q-td :props="props">
                    <q-btn v-if="props.row.datos_nuevos" flat dense size="sm" icon="visibility" color="primary"
                        @click="showJsonDialog('Datos Posteriores', props.row.datos_nuevos)">
                        <q-tooltip>Ver datos</q-tooltip>
                    </q-btn>
                    <span v-else>-</span>
                </q-td>
            </template>
            <template v-slot:body-cell-campos_modificados="props">
                <q-td :props="props">
                    <q-btn v-if="props.row.campos_modificados" flat dense size="sm" icon="visibility" color="secondary"
                        @click="showJsonDialog('Columnas Modificadas', props.row.campos_modificados)">
                        <q-tooltip>Ver cambios</q-tooltip>
                    </q-btn>
                    <span v-else>-</span>
                </q-td>
            </template>
        </q-table>

        <!-- Dialog para mostrar JSON -->
        <q-dialog v-model="jsonDialogOpen" persistent>
            <q-card style="min-width: 500px; max-width: 80vw">
                <q-card-section class="row items-center q-pb-none">
                    <div class="text-h6">{{ jsonDialogTitle }}</div>
                    <q-space />
                    <q-btn icon="close" flat round dense v-close-popup />
                </q-card-section>
                <q-card-section class="scroll" style="max-height: 60vh">
                    <pre style="white-space: pre-wrap; word-wrap: break-word;">{{ formatJson(jsonDialogContent) }}</pre>
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cerrar" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { authApi as api } from 'boot/axios'
import { useQuasar, exportFile } from 'quasar'
import * as XLSX from 'xlsx'

const $q = useQuasar()

// Data
const logs = ref([])
const loading = ref(false)
const pagination = ref({
    page: 1,
    rowsPerPage: 20,
    sortBy: 'id',
    descending: true
})

// Dialog para JSON
const jsonDialogOpen = ref(false)
const jsonDialogTitle = ref('')
const jsonDialogContent = ref(null)

// Filtros
const globalSearch = ref('')
const filters = reactive({
    fecha: '',
    id_usuario: null,
    usuario: '',
    ip: '',
    tabla: '',
    accion: null,
    id_registro: null,
    datos_anteriores: '',
    datos_nuevos: '',
    campos_modificados: '',
    comando_sql: ''
})

// Opciones de select
const accionOptions = [
    { label: 'INSERT', value: 'INSERT' },
    { label: 'UPDATE', value: 'UPDATE' },
    { label: 'BORRADO LÓGICO', value: 'SOFT_DELETE' },
    { label: 'BORRADO FÍSICO', value: 'DELETE' }
]

// Columnas
const columns = [
    { name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true },
    {
        name: 'fecha', label: 'FECHA', field: 'fecha', align: 'left', sortable: true,
        format: val => formatTimestamp(val)
    },
    { name: 'id_usuario', label: 'ID USUARIO', field: 'id_usuario', align: 'left', sortable: true },
    { name: 'usuario', label: 'USUARIO', field: 'usuario', align: 'left', sortable: true },
    { name: 'ip', label: 'IP', field: 'ip', align: 'left', sortable: true },
    { name: 'tabla', label: 'TABLA', field: 'tabla', align: 'left', sortable: true },
    { name: 'accion', label: 'ACCION', field: 'accion', align: 'center', sortable: true },
    { name: 'id_registro', label: 'REGISTRO', field: 'id_registro', align: 'left', sortable: true },
    { name: 'datos_anteriores', label: 'DATOS ANTERIORES', field: 'datos_anteriores', align: 'center' },
    { name: 'datos_nuevos', label: 'DATOS POSTERIORES', field: 'datos_nuevos', align: 'center' },
    { name: 'campos_modificados', label: 'COLUMNAS', field: 'campos_modificados', align: 'center' },
    { name: 'comando_sql', label: 'SQL', field: 'comando_sql', align: 'left', sortable: true }
]

// Filtrado combinado
const filteredLogs = computed(() => {
    let result = logs.value

    // Filtro global
    if (globalSearch.value) {
        const search = globalSearch.value.toLowerCase()
        result = result.filter(log =>
            String(log.id || '').includes(search) ||
            formatTimestamp(log.fecha).includes(search) ||
            String(log.id_usuario || '').includes(search) ||
            String(log.usuario || '').toLowerCase().includes(search) ||
            String(log.ip || '').toLowerCase().includes(search) ||
            String(log.tabla || '').toLowerCase().includes(search) ||
            String(log.accion || '').toLowerCase().includes(search) ||
            String(log.id_registro || '').includes(search) ||
            JSON.stringify(log.datos_anteriores || '').toLowerCase().includes(search) ||
            JSON.stringify(log.datos_nuevos || '').toLowerCase().includes(search) ||
            JSON.stringify(log.campos_modificados || '').toLowerCase().includes(search) ||
            String(log.comando_sql || '').toLowerCase().includes(search)
        )
    }

    // Filtros por columna
    if (filters.fecha) {
        const search = filters.fecha.toLowerCase()
        result = result.filter(log => formatTimestamp(log.fecha).toLowerCase().includes(search))
    }
    if (filters.id_usuario) {
        result = result.filter(log => String(log.id_usuario) === String(filters.id_usuario))
    }
    if (filters.usuario) {
        const search = filters.usuario.toLowerCase()
        result = result.filter(log => String(log.usuario || '').toLowerCase().includes(search))
    }
    if (filters.ip) {
        const search = filters.ip.toLowerCase()
        result = result.filter(log => String(log.ip || '').toLowerCase().includes(search))
    }
    if (filters.tabla) {
        const search = filters.tabla.toLowerCase()
        result = result.filter(log => String(log.tabla || '').toLowerCase().includes(search))
    }
    if (filters.accion) {
        result = result.filter(log => log.accion === filters.accion)
    }
    if (filters.id_registro) {
        result = result.filter(log => String(log.id_registro) === String(filters.id_registro))
    }
    if (filters.datos_anteriores) {
        const search = filters.datos_anteriores.toLowerCase()
        result = result.filter(log => JSON.stringify(log.datos_anteriores || '').toLowerCase().includes(search))
    }
    if (filters.datos_nuevos) {
        const search = filters.datos_nuevos.toLowerCase()
        result = result.filter(log => JSON.stringify(log.datos_nuevos || '').toLowerCase().includes(search))
    }
    if (filters.campos_modificados) {
        const search = filters.campos_modificados.toLowerCase()
        result = result.filter(log => JSON.stringify(log.campos_modificados || '').toLowerCase().includes(search))
    }
    if (filters.comando_sql) {
        const search = filters.comando_sql.toLowerCase()
        result = result.filter(log => String(log.comando_sql || '').toLowerCase().includes(search))
    }

    return result
})

// Formateadores
const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

const formatJson = (json) => {
    if (!json) return '-'
    try {
        return JSON.stringify(json, null, 2)
    } catch {
        return String(json)
    }
}

const getAccionColor = (accion) => {
    if (accion === 'INSERT') return 'positive'
    if (accion === 'UPDATE') return 'warning'
    if (accion === 'SOFT_DELETE') return 'purple'
    if (accion === 'DELETE') return 'negative'
    return 'grey'
}

const formatAccion = (accion) => {
    if (accion === 'INSERT') return 'INSERT'
    if (accion === 'UPDATE') return 'UPDATE'
    if (accion === 'SOFT_DELETE') return 'BORRADO LÓGICO'
    if (accion === 'DELETE') return 'BORRADO FÍSICO'
    return accion
}

const showJsonDialog = (title, content) => {
    jsonDialogTitle.value = title
    jsonDialogContent.value = content
    jsonDialogOpen.value = true
}

// Paginación
const onPaginationChange = (newPagination) => {
    pagination.value = newPagination
}

// Exportación
const exportData = (format, scope) => {
    let dataToExport

    if (scope === 'page') {
        const start = (pagination.value.page - 1) * pagination.value.rowsPerPage
        const end = pagination.value.rowsPerPage === 0
            ? filteredLogs.value.length
            : start + pagination.value.rowsPerPage
        dataToExport = filteredLogs.value.slice(start, end)
    } else if (scope === 'filtered') {
        dataToExport = filteredLogs.value
    } else {
        dataToExport = logs.value
    }

    // Preparar datos formateados
    const formattedData = dataToExport.map(log => ({
        ID: log.id,
        FECHA: formatTimestamp(log.fecha),
        'ID USUARIO': log.id_usuario,
        USUARIO: log.usuario,
        IP: log.ip,
        TABLA: log.tabla,
        ACCION: log.accion,
        REGISTRO: log.id_registro,
        'DATOS ANTERIORES': JSON.stringify(log.datos_anteriores || ''),
        'DATOS POSTERIORES': JSON.stringify(log.datos_nuevos || ''),
        COLUMNAS: JSON.stringify(log.campos_modificados || ''),
        SQL: log.comando_sql
    }))

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    if (format === 'json') {
        const content = JSON.stringify(formattedData, null, 2)
        const status = exportFile(`audit_logs_${timestamp}.json`, content, 'application/json')
        if (status !== true) {
            $q.notify({ type: 'negative', message: 'Error al exportar JSON' })
        }
    } else if (format === 'csv') {
        const headers = Object.keys(formattedData[0] || {}).join(',')
        const rows = formattedData.map(row =>
            Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
        ).join('\n')
        const content = `${headers}\n${rows}`
        const status = exportFile(`audit_logs_${timestamp}.csv`, content, 'text/csv')
        if (status !== true) {
            $q.notify({ type: 'negative', message: 'Error al exportar CSV' })
        }
    } else if (format === 'excel') {
        // Crear libro de Excel real con xlsx
        const worksheet = XLSX.utils.json_to_sheet(formattedData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs')

        // Generar archivo binario
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

        // Descargar
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `audit_logs_${timestamp}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    $q.notify({ type: 'positive', message: `Exportación ${format.toUpperCase()} completada` })
}

// Cargar datos
const fetchLogs = async () => {
    loading.value = true
    try {
        const res = await api.get('/audit-logs')
        logs.value = Array.isArray(res.data) ? res.data : []
    } catch (error) {
        console.error('Error al cargar audit logs:', error)
        $q.notify({ type: 'negative', message: 'Error al cargar los registros de acciones' })
        logs.value = []
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    fetchLogs()
})
</script>
