<template>
    <q-page padding>
        <div class="q-pa-md">
            <h1 class="text-h4 q-mb-md">Mantenimiento de Sesión</h1>

            <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                    <q-card>
                        <q-card-section>
                            <div class="text-h6">Configuración Global</div>
                            <div class="text-subtitle2">Defina el tiempo de expiración de sesión para todos los
                                usuarios.</div>
                        </q-card-section>

                        <q-card-section>
                            <q-form @submit="saveSettings" class="q-gutter-md">
                                <q-input v-model.number="globalTimeout" type="number"
                                    label="Duración de Sesión (Minutos)" filled :rules="[
                                        val => val !== null && val !== '' || 'Este campo es requerido',
                                        val => val > 0 || 'Debe ser mayor a 0'
                                    ]" />

                                <q-toggle v-model="twoFactorEnabled" label="Habilitar Segundo Factor (2FA) Globalmente"
                                    color="primary" />

                                <div v-if="hasPermission('edit_session_settings') || isAdmin()">
                                    <q-btn label="Guardar Cambios" type="submit" color="primary" :loading="loading" />
                                </div>
                                <div v-else>
                                    <q-banner class="bg-warning text-white">
                                        Solo lectura. No tienes permisos para editar.
                                    </q-banner>
                                </div>
                            </q-form>
                        </q-card-section>
                    </q-card>
                </div>
            </div>
        </div>
    </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api, authApi } from 'boot/axios'
import { useQuasar, LocalStorage } from 'quasar'

const $q = useQuasar()
const globalTimeout = ref(60)
const twoFactorEnabled = ref(true)
const loading = ref(false)

const isAdmin = () => {
    const role = LocalStorage.getItem('role')
    return role && ['admin', 'administrador', 'administrator'].includes(role.toLowerCase())
}

const hasPermission = (permissionName) => {
    const permissions = LocalStorage.getItem('permissions') || []
    return permissions.some(p => p.name === permissionName)
}

const loadSettings = async () => {
    try {
        const response = await authApi.get('/maintenance/session')
        if (response.data) {
            if (response.data.global_timeout) globalTimeout.value = response.data.global_timeout
            if (response.data.two_factor_enabled !== undefined) twoFactorEnabled.value = response.data.two_factor_enabled
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error)
        $q.notify({
            color: 'negative',
            message: 'Error al cargar la configuración de sesión',
            icon: 'error'
        })
    }
}

const saveSettings = async () => {
    loading.value = true
    try {
        await authApi.put('/maintenance/session', {
            global_timeout: globalTimeout.value,
            two_factor_enabled: twoFactorEnabled.value
        })

        $q.notify({
            color: 'positive',
            message: 'Configuración actualizada correctamente',
            icon: 'check'
        })
    } catch (error) {
        console.error('Error al guardar configuración:', error)
        $q.notify({
            color: 'negative',
            message: 'Error al actualizar la configuración',
            icon: 'error'
        })
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadSettings()
})
</script>
