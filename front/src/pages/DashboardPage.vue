<template>
  <q-page class="flex flex-center">
    <div class="text-center q-pa-lg">
      <q-icon name="admin_panel_settings" size="80px" color="primary" class="q-mb-md" />
      <h4 class="text-h4 q-mb-sm">Panel de Administración</h4>
      <p class="text-subtitle1 text-grey-7">
        Bienvenido al sistema de gestión de usuarios, roles y permisos.
      </p>
      <p class="text-body2 text-grey-6 q-mb-lg">
        Utilice el menú lateral para acceder a las diferentes secciones.
      </p>
    </div>
  </q-page>
</template>

<script setup>
defineOptions({
  name: 'DashboardPage'
});
</script>
