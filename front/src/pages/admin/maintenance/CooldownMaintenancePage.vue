<template>
    <q-page padding>
        <div class="q-pa-md">
            <h1 class="text-h4 q-mb-md">Tiempo de Enfriamiento</h1>

            <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                    <q-card>
                        <q-card-section>
                            <div class="text-h6">Configuración Global</div>
                            <div class="text-subtitle2">Defina el tiempo de espera entre intentos de inicio de sesión
                                y recuperación de contraseña para todos los usuarios.</div>
                        </q-card-section>

                        <q-card-section>
                            <q-form @submit="saveSettings" class="q-gutter-md">
                                <q-input v-model.number="cooldownMinutes" type="number"
                                    label="Tiempo de Enfriamiento (Minutos)" filled
                                    hint="Use 0 para desactivar el enfriamiento global" :rules="[
                                        val => val !== null && val !== '' || 'Este campo es requerido',
                                        val => val >= 0 || 'Debe ser mayor o igual a 0'
                                    ]" />

                                <q-banner v-if="cooldownMinutes === 0" class="bg-orange-2 text-orange-9 q-mt-sm"
                                    rounded>
                                    <template v-slot:avatar>
                                        <q-icon name="warning" color="orange" />
                                    </template>
                                    El enfriamiento está <strong>desactivado</strong> a nivel global. Los usuarios
                                    podrán intentar iniciar sesión y recuperar contraseña sin restricción de tiempo.
                                </q-banner>

                                <div v-if="hasPermission('edit_attempts_settings') || isAdmin()">
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

                <div class="col-12 col-md-6">
                    <q-card>
                        <q-card-section>
                            <div class="text-h6">Información</div>
                        </q-card-section>
                        <q-card-section>
                            <q-list>
                                <q-item>
                                    <q-item-section avatar>
                                        <q-icon name="info" color="primary" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label>Prioridad de configuración</q-item-label>
                                        <q-item-label caption>
                                            Si el usuario tiene un tiempo asignado, se usa ese valor.
                                            Si no, se usa el del rol. Si ninguno está definido, se usa el global.
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                                <q-item>
                                    <q-item-section avatar>
                                        <q-icon name="block" color="orange" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label>Desactivar enfriamiento</q-item-label>
                                        <q-item-label caption>
                                            Un valor de 0 desactiva el enfriamiento en cualquier nivel
                                            (global, rol o usuario).
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                                <q-item>
                                    <q-item-section avatar>
                                        <q-icon name="security" color="green" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-label>Efecto del enfriamiento</q-item-label>
                                        <q-item-label caption>
                                            El usuario deberá esperar el tiempo configurado entre cada intento
                                            de inicio de sesión y cada intento de recuperación de contraseña.
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-card-section>
                    </q-card>
                </div>
            </div>
        </div>
    </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { authApi } from 'boot/axios'
import { useQuasar, LocalStorage } from 'quasar'

const $q = useQuasar()
const cooldownMinutes = ref(10)
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
        const response = await authApi.get('/maintenance/cooldown')
        if (response.data && response.data.cooldown_minutes !== undefined) {
            cooldownMinutes.value = response.data.cooldown_minutes
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error)
        $q.notify({
            color: 'negative',
            message: 'Error al cargar la configuración de enfriamiento',
            icon: 'error'
        })
    }
}

const saveSettings = async () => {
    loading.value = true
    try {
        await authApi.put('/maintenance/cooldown', {
            cooldown_minutes: cooldownMinutes.value
        })

        $q.notify({
            color: 'positive',
            message: 'Configuración de enfriamiento actualizada correctamente',
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
