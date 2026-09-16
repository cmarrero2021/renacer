<template>
  <q-layout view="hHh Lpr lff" container style="height: 100vh">


    <q-header elevated class="bg-primary text-white">
      <img src="/img/cintillo.png" alt="Cintillo institucional" class="cintillo" />
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title class="text-subtitle1 text-md-h6">
          RENACER
        </q-toolbar-title>

        <q-space />

        <div class="gt-xs q-mr-md text-right">
          <div class="text-weight-bold" style="line-height: 1.2; font-size: 0.85rem;">{{ userFullName }}</div>
          <div class="text-caption text-grey-4" style="font-size: 0.75rem;">{{ userRole }}</div>
        </div>

        <q-btn flat round dense icon="logout" @click="logout" class="q-ml-sm">
          <q-tooltip>Cerrar Sesión</q-tooltip>
        </q-btn>

      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" elevated :width="280">
      <q-scroll-area class="fit">
        <!-- Menú basado en permisos -->
        <q-list>
          <q-item-label header>Menú Principal</q-item-label>

          <q-item clickable v-ripple to="/admin">
            <q-item-section avatar>
              <q-icon name="home" />
            </q-item-section>
            <q-item-section>Inicio</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/admin/marco-legal">
            <q-item-section avatar>
              <q-icon name="gavel" />
            </q-item-section>
            <q-item-section>Marco Legal</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/admin/centros" v-if="isAdmin() || hasPermission('list_centros')">
            <q-item-section avatar>
              <q-icon name="business" />
            </q-item-section>
            <q-item-section>Centros de Atención</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/admin/administracion" v-if="isAdmin() || hasPermission('view_admin_panel')">
            <q-item-section avatar>
              <q-icon name="admin_panel_settings" />
            </q-item-section>
            <q-item-section>Administración</q-item-section>
          </q-item>

          <!-- Menú expandible de Auditoría -->
          <q-expansion-item v-if="isAdmin() || hasPermission('view_audit_menu')" icon="policy" label="Auditoría"
            expand-separator>
            <q-item clickable v-ripple to="/admin/auditoria/ingresos"
              v-if="isAdmin() || hasPermission('view_login_logs')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="login" /></q-item-section>
              <q-item-section>Ingresos</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/auditoria/acciones"
              v-if="isAdmin() || hasPermission('view_action_logs')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="history" /></q-item-section>
              <q-item-section>Acciones</q-item-section>
            </q-item>
          </q-expansion-item>

          <!-- Menú expandible de Catálogos -->
          <q-expansion-item v-if="isAdmin() || hasPermission('view_catalogos_menu')" icon="category"
            label="Catálogos" expand-separator>
            <!-- Catálogos de Negocio -->
            <q-item-label header class="text-caption text-grey-6 q-pt-sm q-pb-xs q-pl-md">Establecimientos</q-item-label>
            <q-item clickable v-ripple to="/admin/catalogos/tipos_establecimiento"
              v-if="isAdmin() || hasPermission('view_tipos_establecimiento')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="domain" /></q-item-section>
              <q-item-section>Tipos de Establecimiento</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/catalogos/tipos_clasificacion"
              v-if="isAdmin() || hasPermission('view_tipos_clasificacion')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="apartment" /></q-item-section>
              <q-item-section>Tipos de Clasificación</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/catalogos/tipos_documentos"
              v-if="isAdmin() || hasPermission('view_tipos_documentos')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="folder_shared" /></q-item-section>
              <q-item-section>Tipos de Documentos</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/catalogos/servicios_catalogo"
              v-if="isAdmin() || hasPermission('view_servicios_catalogo')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="medical_services" /></q-item-section>
              <q-item-section>Servicios</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/catalogos/estados_inmueble"
              v-if="isAdmin() || hasPermission('view_estados_inmueble')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="home_work" /></q-item-section>
              <q-item-section>Estados del Inmueble</q-item-section>
            </q-item>
          </q-expansion-item>

          <!-- Menú expandible de Mantenimiento -->
          <q-expansion-item v-if="isAdmin() || hasPermission('view_maintenance_menu')" icon="build"
            label="Mantenimiento" expand-separator>
            <q-item clickable v-ripple to="/admin/mantenimiento/sesion"
              v-if="isAdmin() || hasPermission('view_session_settings')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="timer" /></q-item-section>
              <q-item-section>Sesión</q-item-section>
            </q-item>
            <q-item clickable v-ripple to="/admin/mantenimiento/enfriamiento"
              v-if="isAdmin() || hasPermission('view_attempts_settings')" class="q-pl-lg">
              <q-item-section avatar><q-icon name="hourglass_empty" /></q-item-section>
              <q-item-section>Enfriamiento</q-item-section>
            </q-item>
          </q-expansion-item>

        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios'
import { usePermissionsSocket } from 'src/composables/usePermissionsSocket'
import { useCatalogosStore } from 'src/stores/catalogos.store'

const leftDrawerOpen = ref(false)
const router = useRouter()
const logoutUrl = import.meta.env.VITE_LOGOUT_URL
const catalogosStore = useCatalogosStore()

// Composable de permisos en tiempo real
const { hasPermission, isAdmin, connect, disconnect, syncFromStorage } = usePermissionsSocket()

const userEmail = computed(() => LocalStorage.getItem('userEmail') || '')
const userFirstName = computed(() => LocalStorage.getItem('firstName') || '')
const userLastName = computed(() => LocalStorage.getItem('lastName') || '')
const userFullName = computed(() => {
  if (!userFirstName.value && !userLastName.value) return userEmail.value.toUpperCase()
  return `${userFirstName.value} ${userLastName.value}`.trim().toUpperCase()
})

const userRole = computed(() => {
  const role = LocalStorage.getItem('role') || ''
  return role.charAt(0).toUpperCase() + role.slice(1)
})


const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

// Conectar WebSocket y pre-cargar catálogos al montar el layout
onMounted(() => {
  syncFromStorage()
  connect()
  catalogosStore.fetchAll()
})

const logout = async () => {
  try {
    const token = LocalStorage.getItem('token')

    // Llamar al endpoint de logout en el backend
    await axios.post(logoutUrl, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    // Desconectar WebSocket antes de limpiar
    disconnect()

    // Limpiar el almacenamiento local
    LocalStorage.remove('token')
    LocalStorage.remove('permissions')
    LocalStorage.remove('role')
    LocalStorage.remove('firstName')
    LocalStorage.remove('lastName')
    LocalStorage.remove('userEmail')


    Notify.create({
      message: 'Sesión cerrada correctamente',
      color: 'positive'
    })

    // Redirigir al login
    router.push('/login')
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
    Notify.create({
      message: 'Error al cerrar sesión',
      color: 'negative'
    })
  }
}
</script>

<style lang="scss" scoped>
.cintillo {
  width: 100%;
  height: auto;
  display: block;
}
</style>
