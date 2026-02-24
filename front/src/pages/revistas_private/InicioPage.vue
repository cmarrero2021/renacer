<template>
  <div class="header">
    <img alt="Logo" src="img/logo-nobg1.png" class="logo-left" />
    <img alt="Observatorio Nacional de Ciencia, Tecnología e Innovación" src="img/oncti-nobg.png" class="logo-right" />
  </div>
  <div class="content-container">

  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Notify } from "quasar";
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
}

.logo-left {
  width: 400px;
  height: 100px;
}

.logo-right {
  width: 150px;
  height: 100px;
}

.content-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
}

.directorio-image {
  width: 60%;
  max-width: 600px;
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 5%;
}

@media (max-width: 768px) {
  .header {
    padding: 10px;
  }

  .logo-left {
    width: 180px;
    height: 50px;
  }

  .logo-right {
    width: 100px;
    height: 50px;
  }

  .content-container {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .directorio-image {
    width: 100%;
    max-width: 300px;
    border-radius: 5%;
    order: -1;
  }
}
</style>
