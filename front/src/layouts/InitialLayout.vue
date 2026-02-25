<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" height-hint="98">
      <img src="img/cintillo.png" alt="Cintillo institucional" class="cintillo" />
      <q-toolbar>
        <q-toolbar-title>
          RENACER - Registro Nacional de Centros de Atención al Adulto Mayor
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
.cintillo {
  width: 100%;
  height: auto;
  display: block;
}

.q-page-container {
  position: relative;
  min-height: 100vh;
}
</style>
