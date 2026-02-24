<template>
    <q-page padding>
        <div class="text-h4 q-mb-md">Auditoría - Registros de Ingreso</div>

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

                <!-- Filtros por columna -->
                <div class="row q-col-gutter-sm">
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.username" dense outlined label="Usuario" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-input v-model="filters.ip_address" dense outlined label="IP" clearable />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-select v-model="filters.login_status" dense outlined label="Login" clearable emit-value
                            map-options :options="loginStatusOptions" />
                    </div>
                    <div class="col-12 col-sm-6 col-md-2">
                        <q-select v-model="filters.logout_type" dense outlined label="Logout" clearable emit-value
                            map-options :options="logoutTypeOptions" />
                    </div>
                    <div class="col-12 col-sm-6 col-md-4">
                        <q-input v-model="filters.session_token" dense outlined label="Sesión" clearable />
                    </div>
                </div>
            </q-card-section>
        </q-card>

        <q-table :rows="filteredLogs" :columns="columns" row-key="id" :loading="loading" :pagination="pagination"
            @update:pagination="onPaginationChange" :rows-per-page-options="[10, 20, 50, 100, 0]">
            <template v-slot:body-cell-login_status="props">
                <q-td :props="props">
                    <q-badge :color="props.row.login_status === 'success' ? 'positive' : 'negative'">
                        {{ formatLoginStatus(props.row.login_status) }}
                    </q-badge>
                </q-td>
            </template>
            <template v-slot:body-cell-logout_type="props">
                <q-td :props="props">
                    <q-badge :color="getLogoutColor(props.row.logout_type, props.row.login_status)">
                        {{ formatLogoutType(props.row.logout_type, props.row.login_status) }}
                    </q-badge>
                </q-td>
            </template>
        </q-table>
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

// Filtros
const globalSearch = ref('')
const filters = reactive({
    username: '',
    ip_address: '',
    login_status: null,
    logout_type: null,
    session_token: ''
})

// Opciones de select
const loginStatusOptions = [
    { label: 'EXITOSO', value: 'success' },
    { label: 'FALLIDO', value: 'failed' }
]

const logoutTypeOptions = [
    { label: 'EN SISTEMA', value: 'null' },
    { label: 'TERMINADO', value: 'logout' },
    { label: 'EXPIRADO', value: 'expired' },
    { label: 'EXPULSADO', value: 'force logout' }
]

// Columnas
const columns = [
    { name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true },
    { name: 'user_id', label: 'ID USUARIO', field: 'user_id', align: 'left', sortable: true },
    { name: 'username', label: 'USUARIO', field: 'username', align: 'left', sortable: true },
    { name: 'ip_address', label: 'IP', field: 'ip_address', align: 'left', sortable: true },
    {
        name: 'login_status', label: 'LOGIN', field: 'login_status', align: 'center', sortable: true
    },
    {
        name: 'login_timestamp', label: 'INGRESO', field: 'login_timestamp', align: 'left', sortable: true,
        format: val => formatTimestamp(val)
    },
    {
        name: 'logout_type', label: 'LOGOUT', field: 'logout_type', align: 'center', sortable: true
    },
    {
        name: 'logout_timestamp', label: 'SALIDA', field: 'logout_timestamp', align: 'left', sortable: true,
        format: val => formatTimestamp(val)
    },
    { name: 'session_token', label: 'SESIÓN', field: 'session_token', align: 'left', sortable: true }
]

// Filtrado combinado
const filteredLogs = computed(() => {
    let result = logs.value

    // Filtro global
    if (globalSearch.value) {
        const search = globalSearch.value.toLowerCase()
        result = result.filter(log =>
            String(log.id || '').includes(search) ||
            String(log.user_id || '').includes(search) ||
            String(log.username || '').toLowerCase().includes(search) ||
            String(log.ip_address || '').toLowerCase().includes(search) ||
            formatLoginStatus(log.login_status).toLowerCase().includes(search) ||
            formatLogoutType(log.logout_type).toLowerCase().includes(search) ||
            formatTimestamp(log.login_timestamp).includes(search) ||
            formatTimestamp(log.logout_timestamp).includes(search) ||
            String(log.session_token || '').toLowerCase().includes(search)
        )
    }

    // Filtros por columna
    if (filters.username) {
        const search = filters.username.toLowerCase()
        result = result.filter(log => String(log.username || '').toLowerCase().includes(search))
    }
    if (filters.ip_address) {
        const search = filters.ip_address.toLowerCase()
        result = result.filter(log => String(log.ip_address || '').toLowerCase().includes(search))
    }
    if (filters.login_status) {
        result = result.filter(log => log.login_status === filters.login_status)
    }
    if (filters.logout_type) {
        // Los logins fallidos no tienen logout válido, excluirlos
        result = result.filter(log => log.login_status === 'success')
        if (filters.logout_type === 'null') {
            result = result.filter(log => log.logout_type === null || log.logout_type === '')
        } else {
            result = result.filter(log => log.logout_type === filters.logout_type)
        }
    }
    if (filters.session_token) {
        const search = filters.session_token.toLowerCase()
        result = result.filter(log => String(log.session_token || '').toLowerCase().includes(search))
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

const formatLoginStatus = (status) => {
    if (status === 'success') return 'EXITOSO'
    if (status === 'failed') return 'FALLIDO'
    return status || '-'
}

const formatLogoutType = (type, loginStatus) => {
    if (loginStatus === 'failed') return '-'
    if (type === null || type === '' || type === undefined) return 'EN SISTEMA'
    if (type === 'logout') return 'TERMINADO'
    if (type === 'expired') return 'EXPIRADO'
    if (type === 'force logout') return 'EXPULSADO'
    return type
}

const getLogoutColor = (type, loginStatus) => {
    if (loginStatus === 'failed') return 'grey'
    if (type === null || type === '' || type === undefined) return 'blue'
    if (type === 'logout') return 'positive'
    if (type === 'expired') return 'warning'
    if (type === 'force logout') return 'negative'
    return 'grey'
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
        'ID USUARIO': log.user_id,
        USUARIO: log.username,
        IP: log.ip_address,
        LOGIN: formatLoginStatus(log.login_status),
        INGRESO: formatTimestamp(log.login_timestamp),
        LOGOUT: formatLogoutType(log.logout_type),
        SALIDA: formatTimestamp(log.logout_timestamp),
        SESIÓN: log.session_token
    }))

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    if (format === 'json') {
        const content = JSON.stringify(formattedData, null, 2)
        const status = exportFile(`login_logs_${timestamp}.json`, content, 'application/json')
        if (status !== true) {
            $q.notify({ type: 'negative', message: 'Error al exportar JSON' })
        }
    } else if (format === 'csv') {
        const headers = Object.keys(formattedData[0] || {}).join(',')
        const rows = formattedData.map(row =>
            Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
        ).join('\n')
        const content = `${headers}\n${rows}`
        const status = exportFile(`login_logs_${timestamp}.csv`, content, 'text/csv')
        if (status !== true) {
            $q.notify({ type: 'negative', message: 'Error al exportar CSV' })
        }
    } else if (format === 'excel') {
        // Crear libro de Excel real con xlsx
        const worksheet = XLSX.utils.json_to_sheet(formattedData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Login Logs')

        // Generar archivo binario
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

        // Descargar
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `login_logs_${timestamp}.xlsx`
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
        const res = await api.get('/login-logs')
        logs.value = Array.isArray(res.data) ? res.data : []
    } catch (error) {
        console.error('Error al cargar login logs:', error)
        $q.notify({ type: 'negative', message: 'Error al cargar los registros de ingreso' })
        logs.value = []
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    fetchLogs()
})
</script>
