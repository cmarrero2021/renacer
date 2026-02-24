<template>
    <q-page padding>
        <div class="text-h4 q-mb-md">Administración</div>

        <q-card>
            <q-tabs v-model="tab" dense class="text-grey" active-color="primary" indicator-color="primary"
                align="justify" narrow-indicator>
                <q-tab name="users" label="Usuarios" icon="people" />
                <q-tab name="roles" label="Roles" icon="security" />
                <q-tab name="permissions" label="Permisos" icon="vpn_key" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="tab" animated>
                <!-- Panel de Usuarios -->
                <q-tab-panel name="users">
                    <div class="text-h6">Gestión de Usuarios</div>
                    <q-table :rows="filteredUsers" :columns="userColumns" row-key="id" :loading="loadingUsers">
                        <template v-slot:top-right>
                            <q-input v-model="userSearch" dense outlined placeholder="Buscar usuario..." class="q-mr-md"
                                style="min-width: 200px">
                                <template v-slot:prepend>
                                    <q-icon name="search" />
                                </template>
                                <template v-slot:append v-if="userSearch">
                                    <q-icon name="close" class="cursor-pointer" @click="userSearch = ''" />
                                </template>
                            </q-input>
                            <q-btn color="primary" icon="add" label="Nuevo Usuario" @click="openUserModal()" />
                        </template>
                        <template v-slot:body-cell-actions="props">
                            <q-td :props="props">
                                <q-btn flat round dense color="primary" icon="edit" @click="openUserModal(props.row)" />
                                <q-btn flat round dense color="negative" icon="delete"
                                    @click="confirmDeleteUser(props.row)" />
                                <q-btn flat round dense color="secondary" icon="admin_panel_settings"
                                    @click="openAssignRoleModal(props.row)">
                                    <q-tooltip>Asignar Roles</q-tooltip>
                                </q-btn>
                            </q-td>
                        </template>
                    </q-table>
                </q-tab-panel>

                <!-- Panel de Roles -->
                <q-tab-panel name="roles">
                    <div class="text-h6">Gestión de Roles</div>
                    <q-table :rows="filteredRoles" :columns="roleColumns" row-key="id" :loading="loadingRoles">
                        <template v-slot:top-right>
                            <q-input v-model="roleSearch" dense outlined placeholder="Buscar rol..." class="q-mr-md"
                                style="min-width: 200px">
                                <template v-slot:prepend>
                                    <q-icon name="search" />
                                </template>
                                <template v-slot:append v-if="roleSearch">
                                    <q-icon name="close" class="cursor-pointer" @click="roleSearch = ''" />
                                </template>
                            </q-input>
                            <q-btn color="primary" icon="add" label="Nuevo Rol" @click="openRoleModal()" />
                        </template>
                        <template v-slot:body-cell-actions="props">
                            <q-td :props="props">
                                <q-btn flat round dense color="primary" icon="edit" @click="openRoleModal(props.row)" />
                                <q-btn flat round dense color="negative" icon="delete"
                                    @click="confirmDeleteRole(props.row)" />
                                <q-btn flat round dense color="secondary" icon="vpn_key"
                                    @click="openAssignPermissionModal(props.row)">
                                    <q-tooltip>Asignar Permisos</q-tooltip>
                                </q-btn>
                            </q-td>
                        </template>
                    </q-table>
                </q-tab-panel>

                <!-- Panel de Permisos -->
                <q-tab-panel name="permissions">
                    <div class="text-h6">Gestión de Permisos</div>
                    <q-table :rows="filteredPermissions" :columns="permissionColumns" row-key="id"
                        :loading="loadingPermissions">
                        <template v-slot:top-right>
                            <q-input v-model="permissionSearch" dense outlined placeholder="Buscar permiso..."
                                class="q-mr-md" style="min-width: 200px">
                                <template v-slot:prepend>
                                    <q-icon name="search" />
                                </template>
                                <template v-slot:append v-if="permissionSearch">
                                    <q-icon name="close" class="cursor-pointer" @click="permissionSearch = ''" />
                                </template>
                            </q-input>
                            <q-btn color="primary" icon="add" label="Nuevo Permiso" @click="openPermissionModal()" />
                        </template>
                        <template v-slot:body-cell-actions="props">
                            <q-td :props="props">
                                <q-btn flat round dense color="primary" icon="edit"
                                    @click="openPermissionModal(props.row)" />
                                <q-btn flat round dense color="negative" icon="delete"
                                    @click="confirmDeletePermission(props.row)" />
                            </q-td>
                        </template>
                    </q-table>
                </q-tab-panel>
            </q-tab-panels>
        </q-card>

        <!-- Modal Usuario -->
        <q-dialog v-model="userModalOpen">
            <q-card style="min-width: 400px">
                <q-card-section>
                    <div class="text-h6">{{ editingUser ? 'Editar Usuario' : 'Nuevo Usuario' }}</div>
                </q-card-section>

                <q-card-section>
                    <q-form @submit="saveUser">
                        <q-input v-model="userForm.first_name" label="Nombre" :rules="[val => !!val || 'Requerido']" />
                        <q-input v-model="userForm.last_name" label="Apellido" :rules="[val => !!val || 'Requerido']" />
                        <q-input v-model="userForm.cedula" label="Cédula"
                            :rules="[val => !!val || 'Requerido', val => /^\d+$/.test(val) || 'Solo números']" />
                        <q-input v-model="userForm.email" label="Email" type="email"
                            :rules="[val => !!val || 'Requerido', val => /.+@.+\..+/.test(val) || 'Email inválido']" />

                        <div class="q-mt-md">
                            <div class="row items-center q-mb-sm">
                                <q-btn label="Generar Clave" color="secondary" size="sm" @click="generatePassword"
                                    icon="vpn_key" class="q-mr-sm" />
                                <div class="text-caption text-grey">Genera una clave segura automáticamente</div>
                            </div>

                            <q-input v-model="userForm.password" label="Contraseña"
                                :type="isPasswordVisible ? 'text' : 'password'"
                                :hint="editingUser ? 'Dejar en blanco para mantener la actual' : ''"
                                :rules="[val => (!editingUser && !val) ? 'Requerido' : true, val => !val || validatePasswordStrength(val) === true || validatePasswordStrength(val)]">
                                <template v-slot:append>
                                    <q-icon :name="isPasswordVisible ? 'visibility' : 'visibility_off'"
                                        class="cursor-pointer" @click="isPasswordVisible = !isPasswordVisible" />
                                </template>
                            </q-input>

                            <q-input v-model="userForm.confirmPassword" label="Confirmar Contraseña"
                                :type="isConfirmPasswordVisible ? 'text' : 'password'"
                                :rules="[val => val === userForm.password || 'Las contraseñas no coinciden']">
                                <template v-slot:append>
                                    <q-icon :name="isConfirmPasswordVisible ? 'visibility' : 'visibility_off'"
                                        class="cursor-pointer"
                                        @click="isConfirmPasswordVisible = !isConfirmPasswordVisible" />
                                </template>
                            </q-input>

                            <div class="q-mt-sm q-pa-sm bg-grey-2 rounded-borders">
                                <div class="text-caption text-weight-bold q-mb-xs">Requisitos de contraseña:</div>
                                <div class="row q-gutter-x-md">
                                    <div :class="hasMinLength ? 'text-positive' : 'text-grey'">
                                        <q-icon :name="hasMinLength ? 'check_circle' : 'radio_button_unchecked'" /> 8+
                                        caracteres
                                    </div>
                                    <div :class="hasUpperCase ? 'text-positive' : 'text-grey'">
                                        <q-icon :name="hasUpperCase ? 'check_circle' : 'radio_button_unchecked'" />
                                        Mayúscula
                                    </div>
                                    <div :class="hasLowerCase ? 'text-positive' : 'text-grey'">
                                        <q-icon :name="hasLowerCase ? 'check_circle' : 'radio_button_unchecked'" />
                                        Minúscula
                                    </div>
                                    <div :class="hasNumber ? 'text-positive' : 'text-grey'">
                                        <q-icon :name="hasNumber ? 'check_circle' : 'radio_button_unchecked'" /> Número
                                    </div>
                                    <div :class="hasSpecial ? 'text-positive' : 'text-grey'">
                                        <q-icon :name="hasSpecial ? 'check_circle' : 'radio_button_unchecked'" />
                                        Especial
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Duración de sesión -->
                        <q-input v-model.number="userForm.session_timeout_min" label="Duración de sesión (minutos)"
                            type="number" min="0"
                            hint="Opcional: deje en 0 o vacío para usar la configuración del rol o global"
                            class="q-mt-md">
                            <template v-slot:prepend>
                                <q-icon name="timer" />
                            </template>
                        </q-input>
                        <div class="row justify-end q-mt-md">
                            <q-btn label="Cancelar" color="negative" flat v-close-popup />
                            <q-btn label="Guardar" type="submit" color="primary" />
                        </div>
                    </q-form>
                </q-card-section>
            </q-card>
        </q-dialog>

        <!-- Modal Rol -->
        <q-dialog v-model="roleModalOpen">
            <q-card style="min-width: 400px">
                <q-card-section>
                    <div class="text-h6">{{ editingRole ? 'Editar Rol' : 'Nuevo Rol' }}</div>
                </q-card-section>
                <q-card-section>
                    <q-form @submit="saveRole">
                        <q-input v-model="roleForm.name" label="Nombre" :rules="[val => !!val || 'Requerido']" />
                        <q-input v-model="roleForm.description" label="Descripción" />

                        <!-- Duración de sesión para usuarios con este rol -->
                        <q-input v-model.number="roleForm.session_timeout_min" label="Duración de sesión (minutos)"
                            type="number" min="0" hint="Opcional: deje en 0 o vacío para usar la configuración global"
                            class="q-mt-md">
                            <template v-slot:prepend>
                                <q-icon name="timer" />
                            </template>
                        </q-input>

                        <div class="row justify-end q-mt-md">
                            <q-btn label="Cancelar" color="negative" flat v-close-popup />
                            <q-btn label="Guardar" type="submit" color="primary" />
                        </div>
                    </q-form>
                </q-card-section>
            </q-card>
        </q-dialog>

        <!-- Modal Asignar Roles a Usuario -->
        <q-dialog v-model="assignRoleModalOpen">
            <q-card style="min-width: 400px">
                <q-card-section>
                    <div class="text-h6">Asignar Roles a {{ selectedUser?.first_name }}</div>
                </q-card-section>
                <q-card-section>
                    <q-input v-model="assignRoleSearch" dense outlined placeholder="Buscar rol..." class="q-mb-md">
                        <template v-slot:prepend>
                            <q-icon name="search" />
                        </template>
                        <template v-slot:append v-if="assignRoleSearch">
                            <q-icon name="close" class="cursor-pointer" @click="assignRoleSearch = ''" />
                        </template>
                    </q-input>
                    <div v-for="role in filteredRolesForAssign" :key="role.id" class="q-mb-sm">
                        <q-checkbox v-model="userRolesSelection" :val="role.id" :label="role.name"
                            @update:model-value="toggleRole(role.id)" />
                    </div>
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cerrar" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>

        <!-- Modal Asignar Permisos a Rol -->
        <q-dialog v-model="assignPermissionModalOpen">
            <q-card style="min-width: 600px">
                <q-card-section>
                    <div class="text-h6">Asignar Permisos a {{ selectedRole?.name }}</div>
                </q-card-section>
                <q-card-section style="max-height: 50vh" class="scroll">
                    <q-input v-model="assignPermissionSearch" dense outlined placeholder="Buscar permiso..."
                        class="q-mb-md">
                        <template v-slot:prepend>
                            <q-icon name="search" />
                        </template>
                        <template v-slot:append v-if="assignPermissionSearch">
                            <q-icon name="close" class="cursor-pointer" @click="assignPermissionSearch = ''" />
                        </template>
                    </q-input>
                    <div v-for="perm in filteredPermissionsForAssign" :key="perm.id" class="q-mb-sm">
                        <q-checkbox v-model="rolePermissionsSelection" :val="perm.id"
                            :label="perm.name + ' - ' + perm.description"
                            @update:model-value="togglePermission(perm.id)" />
                    </div>
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cerrar" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>

        <!-- Modal Permiso -->
        <q-dialog v-model="permissionModalOpen">
            <q-card style="min-width: 400px">
                <q-card-section>
                    <div class="text-h6">{{ editingPermission ? 'Editar Permiso' : 'Nuevo Permiso' }}</div>
                </q-card-section>
                <q-card-section>
                    <q-form @submit="savePermission">
                        <q-input v-model="permissionForm.name" label="Nombre" :rules="[val => !!val || 'Requerido']"
                            hint="Ejemplo: create_user, delete_role, view_reports" />
                        <div class="row q-col-gutter-md q-mt-sm">
                            <div class="col-6">
                                <q-input v-model="permissionForm.resource" label="Recurso"
                                    :rules="[val => !!val || 'Requerido']" hint="Ej: users, roles, revistas" />
                            </div>
                            <div class="col-6">
                                <q-select v-model="permissionForm.action" label="Acción"
                                    :rules="[val => !!val || 'Requerido']"
                                    :options="['create', 'read', 'update', 'delete', 'assign', 'remove', 'export', 'import']"
                                    hint="Tipo de acción" />
                            </div>
                        </div>
                        <q-input v-model="permissionForm.description" label="Descripción" class="q-mt-md"
                            hint="Descripción breve de lo que permite este permiso" />
                        <div class="row justify-end q-mt-md">
                            <q-btn label="Cancelar" color="negative" flat v-close-popup />
                            <q-btn label="Guardar" type="submit" color="primary" />
                        </div>
                    </q-form>
                </q-card-section>
            </q-card>
        </q-dialog>

    </q-page>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { authApi as api } from 'boot/axios'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const tab = ref('users')

// --- Usuarios ---
const users = ref([])
const loadingUsers = ref(false)
const userColumns = [
    { name: 'first_name', label: 'Nombre', field: 'first_name', align: 'left' },
    { name: 'last_name', label: 'Apellido', field: 'last_name', align: 'left' },
    { name: 'cedula', label: 'Cédula', field: 'cedula', align: 'left' },
    { name: 'email', label: 'Email', field: 'email', align: 'left' },
    { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
]
const userModalOpen = ref(false)
const editingUser = ref(false)
const userForm = reactive({ id: null, first_name: '', last_name: '', cedula: '', email: '', password: '', confirmPassword: '', session_timeout_min: null })
const isPasswordVisible = ref(false)
const isConfirmPasswordVisible = ref(false)
const selectedUser = ref(null)
const assignRoleModalOpen = ref(false)
const userRolesSelection = ref([])

// --- Roles ---
const roles = ref([])
const loadingRoles = ref(false)
const roleColumns = [
    { name: 'name', label: 'Nombre', field: 'name', align: 'left' },
    { name: 'description', label: 'Descripción', field: 'description', align: 'left' },
    { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
]
const roleModalOpen = ref(false)
const editingRole = ref(false)
const roleForm = reactive({ id: null, name: '', description: '', session_timeout_min: null })
const selectedRole = ref(null)
const assignPermissionModalOpen = ref(false)
const rolePermissionsSelection = ref([])

// --- Permisos ---
const permissions = ref([])
const loadingPermissions = ref(false)
const permissionColumns = [
    { name: 'name', label: 'Nombre', field: 'name', align: 'left' },
    { name: 'resource', label: 'Recurso', field: 'resource', align: 'left' },
    { name: 'action', label: 'Acción', field: 'action', align: 'left' },
    { name: 'description', label: 'Descripción', field: 'description', align: 'left' },
    { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
]
const permissionModalOpen = ref(false)
const editingPermission = ref(false)
const permissionForm = reactive({ id: null, name: '', resource: '', action: '', description: '' })

// --- Búsquedas ---
const userSearch = ref('')
const roleSearch = ref('')
const permissionSearch = ref('')
const assignRoleSearch = ref('')
const assignPermissionSearch = ref('')

// --- Computed para filtrar ---
const filteredUsers = computed(() => {
    if (!userSearch.value) return users.value
    const search = userSearch.value.toLowerCase()
    return users.value.filter(u =>
        String(u.first_name || '').toLowerCase().includes(search) ||
        String(u.last_name || '').toLowerCase().includes(search) ||
        String(u.cedula || '').toLowerCase().includes(search) ||
        String(u.email || '').toLowerCase().includes(search)
    )
})

const filteredRoles = computed(() => {
    if (!roleSearch.value) return roles.value
    const search = roleSearch.value.toLowerCase()
    return roles.value.filter(r =>
        r.name?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
    )
})

const filteredPermissions = computed(() => {
    if (!permissionSearch.value) return permissions.value
    const search = permissionSearch.value.toLowerCase()
    return permissions.value.filter(p =>
        p.name?.toLowerCase().includes(search) ||
        p.resource?.toLowerCase().includes(search) ||
        p.action?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
    )
})

const filteredRolesForAssign = computed(() => {
    if (!assignRoleSearch.value) return roles.value
    const search = assignRoleSearch.value.toLowerCase()
    return roles.value.filter(r =>
        r.name?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
    )
})

const filteredPermissionsForAssign = computed(() => {
    if (!assignPermissionSearch.value) return permissions.value
    const search = assignPermissionSearch.value.toLowerCase()
    return permissions.value.filter(p =>
        p.name?.toLowerCase().includes(search) ||
        p.resource?.toLowerCase().includes(search) ||
        p.action?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
    )
})

// --- Carga Inicial ---
onMounted(() => {
    fetchUsers()
    fetchRoles()
    fetchPermissions()
})

// --- Funciones Usuarios ---
const fetchUsers = async () => {
    loadingUsers.value = true
    try {
        const res = await api.get('/users')
        users.value = Array.isArray(res.data) ? res.data : []
    } catch (error) {
        users.value = []
        $q.notify({ type: 'negative', message: 'Error al cargar usuarios' })
    } finally {
        loadingUsers.value = false
    }
}

const openUserModal = (user = null) => {
    if (user) {
        editingUser.value = true
        Object.assign(userForm, user)
    } else {
        editingUser.value = false
        Object.assign(userForm, { id: null, first_name: '', last_name: '', cedula: '', email: '', password: '', confirmPassword: '', session_timeout_min: null })
        isPasswordVisible.value = false
        isConfirmPasswordVisible.value = false
    }
    userModalOpen.value = true
}

const saveUser = async () => {
    try {
        if (editingUser.value) {
            await api.put(`/users/${userForm.id}`, userForm)
            $q.notify({ type: 'positive', message: 'Usuario actualizado' })
        } else {
            await api.post('/users', userForm)
            $q.notify({ type: 'positive', message: 'Usuario creado' })
        }
        userModalOpen.value = false
        fetchUsers()
    } catch (error) {
        $q.notify({ type: 'negative', message: 'Error al guardar usuario' })
    }
}

const confirmDeleteUser = (user) => {
    $q.dialog({
        title: 'Confirmar',
        message: `¿Eliminar usuario ${user.first_name}?`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        try {
            await api.delete(`/users/${user.id}`)
            $q.notify({ type: 'positive', message: 'Usuario eliminado' })
            fetchUsers()
        } catch (error) {
            $q.notify({ type: 'negative', message: 'Error al eliminar usuario' })
        }
    })
}

// --- Funciones Roles ---
const fetchRoles = async () => {
    loadingRoles.value = true
    try {
        const res = await api.get('/roles')
        roles.value = Array.isArray(res.data) ? res.data : []
    } catch (error) {
        roles.value = []
        $q.notify({ type: 'negative', message: 'Error al cargar roles' })
    } finally {
        loadingRoles.value = false
    }
}

const openRoleModal = (role = null) => {
    if (role) {
        editingRole.value = true
        Object.assign(roleForm, role)
    } else {
        editingRole.value = false
        Object.assign(roleForm, { id: null, name: '', description: '', session_timeout_min: null })
    }
    roleModalOpen.value = true
}

const saveRole = async () => {
    try {
        if (editingRole.value) {
            await api.put(`/roles/${roleForm.id}`, roleForm)
            $q.notify({ type: 'positive', message: 'Rol actualizado' })
        } else {
            await api.post('/roles', roleForm)
            $q.notify({ type: 'positive', message: 'Rol creado' })
        }
        roleModalOpen.value = false
        fetchRoles()
    } catch (error) {
        $q.notify({ type: 'negative', message: 'Error al guardar rol' })
    }
}

const confirmDeleteRole = (role) => {
    $q.dialog({
        title: 'Confirmar',
        message: `¿Eliminar rol ${role.name}?`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        try {
            await api.delete(`/roles/${role.id}`)
            $q.notify({ type: 'positive', message: 'Rol eliminado' })
            fetchRoles()
        } catch (error) {
            $q.notify({ type: 'negative', message: 'Error al eliminar rol' })
        }
    })
}

// --- Funciones Permisos ---
const fetchPermissions = async () => {
    loadingPermissions.value = true
    try {
        const res = await api.get('/permissions')
        permissions.value = Array.isArray(res.data) ? res.data : []
    } catch (error) {
        permissions.value = []
        $q.notify({ type: 'negative', message: 'Error al cargar permisos' })
    } finally {
        loadingPermissions.value = false
    }
}

const openPermissionModal = (permission = null) => {
    if (permission) {
        editingPermission.value = true
        Object.assign(permissionForm, permission)
    } else {
        editingPermission.value = false
        Object.assign(permissionForm, { id: null, name: '', resource: '', action: '', description: '' })
    }
    permissionModalOpen.value = true
}

const savePermission = async () => {
    try {
        if (editingPermission.value) {
            await api.put(`/permissions/${permissionForm.id}`, permissionForm)
            $q.notify({ type: 'positive', message: 'Permiso actualizado' })
        } else {
            await api.post('/permissions', permissionForm)
            $q.notify({ type: 'positive', message: 'Permiso creado' })
        }
        permissionModalOpen.value = false
        fetchPermissions()
    } catch (error) {
        const msg = error.response?.data?.error || 'Error al guardar permiso'
        $q.notify({ type: 'negative', message: msg })
    }
}

const confirmDeletePermission = (permission) => {
    $q.dialog({
        title: 'Confirmar',
        message: `¿Eliminar permiso "${permission.name}"? Se quitará de todos los roles y usuarios que lo tengan asignado.`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        try {
            await api.delete(`/permissions/${permission.id}`)
            $q.notify({ type: 'positive', message: 'Permiso eliminado' })
            fetchPermissions()
        } catch (error) {
            const msg = error.response?.data?.error || 'Error al eliminar permiso'
            $q.notify({ type: 'negative', message: msg })
        }
    })
}

// --- Asignaciones ---
const openAssignRoleModal = async (user) => {
    selectedUser.value = user
    userRolesSelection.value = [] // Reset
    await fetchUserRoles(user.id)
    assignRoleModalOpen.value = true
}

const fetchUserRoles = async (userId) => {
    try {
        const res = await api.get('/users_roles')
        const data = Array.isArray(res.data) ? res.data : []
        // Filtrar los que corresponden a este usuario
        const userRoles = data.filter(ur => ur.user_id === userId)
        userRolesSelection.value = userRoles.map(ur => ur.role_id)
    } catch (error) {
        console.error(error)
        userRolesSelection.value = []
        $q.notify({ type: 'negative', message: 'Error al cargar roles del usuario' })
    }
}

const toggleRole = async (roleId) => {
    if (!selectedUser.value) return
    const isAdded = userRolesSelection.value.includes(roleId)
    try {
        if (isAdded) {
            await api.post('/assign-role', { userId: selectedUser.value.id, roleId })
            $q.notify({ type: 'positive', message: 'Rol asignado' })
        } else {
            await api.post('/remove-role', { userId: selectedUser.value.id, roleId })
            $q.notify({ type: 'positive', message: 'Rol removido' })
        }
    } catch (error) {
        $q.notify({ type: 'negative', message: 'Error al actualizar rol' })
        // Revertir cambio local si falla (complejo con v-model directo, pero aceptable para MVP)
    }
}

const openAssignPermissionModal = (role) => {
    selectedRole.value = role
    rolePermissionsSelection.value = [] // Reset
    // Misma limitación: no sabemos qué permisos tiene el rol actualmente sin un endpoint específico.
    // Usaremos 'listRolesPermissions' para filtrar en frontend si es posible.
    fetchRolePermissions(role.id)
    assignPermissionModalOpen.value = true
}

const fetchRolePermissions = async (roleId) => {
    try {
        const res = await api.get('/roles_permissions')
        const data = Array.isArray(res.data) ? res.data : []
        // Filtrar los que corresponden a este rol
        const rolePerms = data.filter(rp => rp.role_id === roleId)
        rolePermissionsSelection.value = rolePerms.map(rp => rp.permission_id)
    } catch (error) {
        console.error(error)
        rolePermissionsSelection.value = []
    }
}

const togglePermission = async (permissionId) => {
    if (!selectedRole.value) return
    const isAdded = rolePermissionsSelection.value.includes(permissionId)
    try {
        if (isAdded) {
            await api.post('/assign-rolepermission', { roleId: selectedRole.value.id, permissionId })
            $q.notify({ type: 'positive', message: 'Permiso asignado' })
        } else {
            await api.post('/remove-rolepermission', { roleId: selectedRole.value.id, permissionId })
            $q.notify({ type: 'positive', message: 'Permiso removido' })
        }
    } catch (error) {
        $q.notify({ type: 'negative', message: 'Error al actualizar permiso' })
    }
}

// --- Password Logic ---
const hasMinLength = computed(() => (userForm.password || '').length >= 8)
const hasUpperCase = computed(() => /[A-Z]/.test(userForm.password || ''))
const hasLowerCase = computed(() => /[a-z]/.test(userForm.password || ''))
const hasNumber = computed(() => /[0-9]/.test(userForm.password || ''))
const hasSpecial = computed(() => /[!"#$%&/=.\-*;]/.test(userForm.password || ''))

const validatePasswordStrength = (val) => {
    if (!val) return 'Requerido'
    if (!hasMinLength.value) return 'Mínimo 8 caracteres'
    if (!hasUpperCase.value) return 'Al menos una mayúscula'
    if (!hasLowerCase.value) return 'Al menos una minúscula'
    if (!hasNumber.value) return 'Al menos un número'
    if (!hasSpecial.value) return 'Al menos un carácter especial (!"#$%&/=.-*;)'
    return true
}

const generatePassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"#$%&/=.-*;"
    let retVal = ""
    // Ensure at least one of each required type
    retVal += "A" // Upper
    retVal += "a" // Lower
    retVal += "1" // Number
    retVal += "." // Special

    for (let i = 0, n = charset.length; i < length - 4; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n))
    }

    // Shuffle
    retVal = retVal.split('').sort(function () { return 0.5 - Math.random() }).join('');

    userForm.password = retVal
    userForm.confirmPassword = retVal
}
</script>
