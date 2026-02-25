<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <img src="img/cintillo.png" alt="Cintillo institucional" class="cintillo" />
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          RENACER - Registro Nacional de Centros de Atención al Adulto Mayor
        </q-toolbar-title>

        <q-space />

        <q-btn flat round dense icon="logout" @click="logout" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" elevated>
      <!-- Menú basado en permisos -->
      <q-list>
        <q-item-label header>Menú Principal</q-item-label>

        <q-item clickable v-ripple to="/admin">
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>Inicio</q-item-section>
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
          <q-item clickable v-ripple to="/admin/auditoria/ingresos" v-if="isAdmin() || hasPermission('view_login_logs')"
            class="q-pl-lg">
            <q-item-section avatar><q-icon name="login" /></q-item-section>
            <q-item-section>Ingresos</q-item-section>
          </q-item>
          <q-item clickable v-ripple to="/admin/auditoria/acciones"
            v-if="isAdmin() || hasPermission('view_action_logs')" class="q-pl-lg">
            <q-item-section avatar><q-icon name="history" /></q-item-section>
            <q-item-section>Acciones</q-item-section>
          </q-item>
        </q-expansion-item>

        <!-- Menú expandible de Mantenimiento -->
        <q-expansion-item v-if="isAdmin() || hasPermission('view_maintenance_menu')" icon="build" label="Mantenimiento"
          expand-separator>
          <q-item clickable v-ripple to="/admin/mantenimiento/sesion"
            v-if="isAdmin() || hasPermission('view_session_settings')" class="q-pl-lg">
            <q-item-section avatar><q-icon name="timer" /></q-item-section>
            <q-item-section>Sesión</q-item-section>
          </q-item>
        </q-expansion-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LocalStorage, Notify } from 'quasar'
import axios from 'axios'

const leftDrawerOpen = ref(false)
const router = useRouter()
const logoutUrl = import.meta.env.VITE_LOGOUT_URL

const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const hasPermission = (permissionName) => {
  const permissions = LocalStorage.getItem('permissions') || []
  return permissions.some(p => p.name === permissionName)
}

const isAdmin = () => {
  const role = LocalStorage.getItem('role')
  return role && ['admin', 'administrador', 'administrator'].includes(role.toLowerCase())
}

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

    // Limpiar el almacenamiento local
    LocalStorage.remove('token')
    LocalStorage.remove('permissions')

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
