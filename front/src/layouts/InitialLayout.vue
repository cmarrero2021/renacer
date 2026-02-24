<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" height-hint="98">
      <q-toolbar>
        <q-toolbar-title>
          Sistema de Gestión de Usuarios y Permisos
        </q-toolbar-title>
        <q-space />
        <q-btn flat label="Iniciar Sesión" to="/login" icon="login" />
      </q-toolbar>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style lang="scss" scoped>
.q-page-container {
  position: relative;
  min-height: 100vh;
}
</style>
