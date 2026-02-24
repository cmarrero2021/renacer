<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" height-hint="98">
      <q-img src="img/cintillo.jpg" srcset="img/cintillo.jpg 100w,
      img/cintillo.jpg 1x,
      img/cintillo.jpg 1x,
      img/cintillo.jpg 1x" sizes="(max-width: 400px) 400w,
      (min-width: 400px) and (max-width: 800px) 800w,
      (min-width: 800px) and (max-width: 1200px) 1200w,
      (min-width: 1200px) 1600w" />
      <q-tabs align="center">
        <q-route-tab to="/" label="Inicio" />
        <q-route-tab to="/revistas" label="Publicaciones" />
        <q-route-tab to="/estadisticas" label="Estadísticas" />
        <q-route-tab to="/editores" label="Para Editores" />
        <q-route-tab to="/somos" label="Quiénes Somos" />
      </q-tabs>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
<style lang="scss" scoped>
.bg-azul-oncti {
  background-color: #243584;
}

.q-tab__label {
  font-size: 10px !important;
}

.q-page-container {
  position: relative;
  min-height: 100vh;
}

.q-page-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.7;
  z-index: -1;
}

.txt-pie {
  display: block;
  font-size: small;
  text-align: center;
}

@media (max-width: 480px) or (max-height: 480px) {
  .pie {
    display: none;
  }
}

/* Estilos para pantallas pequeñas (responsive) */
@media (max-width: 767.98px) {
  .q-header .row {
    flex-direction: column;
    /* Coloca los elementos en columna */
  }

  .q-header .col-12 {
    width: 100%;
    /* Ocupa todo el ancho */
  }

  .q-header .q-tabs {
    justify-content: center;
    /* Centra el menú */
    margin-top: 10px;
    /* Espacio entre la imagen y el menú */
  }
}

/* Estilos para pantallas medianas y superiores (desktop) */
@media (min-width: 768px) {
  .q-header .row {
    display: flex;
    align-items: center;
  }

  .q-header .col-md-6 {
    flex: 0 0 50%;
    max-width: 50%;
  }

  .q-header .q-tabs {
    justify-content: flex-end;
    /* Alinea el menú a la derecha */
  }
}
</style>
