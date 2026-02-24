<template>
  <q-dialog v-model="visible" :maximized="isMaximized" transition-show="scale" transition-hide="fade">
    <q-card class="custom-dialog">
      <!-- Toolbar -->
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title class="text-center text-responsive">
          Directorio de Revistas Científicas - ONCTI1
        </q-toolbar-title>
        <q-btn :icon="isMaximized ? 'fullscreen_exit' : 'fullscreen'" flat round dense @click="toggleMaximized"
          :title="isMaximized ? 'Salir de pantalla completa' : 'Pantalla completa'" />
        <q-btn icon="close" flat round dense @click="visible = false" />
      </q-toolbar>
      <!-- Contenido del diálogo con scroll -->
      <q-card-section class="scrollable-content">
        <div v-if="revista" class="row q-col-gutter-md" id="contenidoRevista">
          <!-- Columna de la Imagen -->
          <div class="col-xs-12 col-sm-4 col-md-4">
            <q-img :src="`${imageBaseUrl}${revista.portada}`" :alt="`Portada de ${revista.revista}`"
              class="portada-img" style="height: 100%; object-fit: cover;" />
          </div>
          <!-- Columna de Información -->
          <div class="col-xs-12 col-sm-8 col-md-8">
            <div class="row q-col-gutter-sm">
              <!-- Primera Columna -->
              <div class="col-6">
                <template v-for="(value, key) in infoCol1" :key="key">
                  <div class="q-mb-sm">
                    <div class="etq">{{ key.toUpperCase().replace(/_/g, ' ') }}</div>
                    <div class="contenido">{{ value ?? '' }}</div>
                  </div>
                </template>
              </div>
              <!-- Segunda Columna -->
              <div class="col-6">
                <template v-for="(value, key) in infoCol2" :key="key">
                  <div class="q-mb-sm">
                    <div class="etq">{{ key.toUpperCase().replace(/_/g, ' ') }}</div>
                    <div class="contenido">{{ value ?? '' }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <!-- Contenedor para el Resumen -->
        <div class="col-12 q-mt-lg">
          <div v-if="revista && revista.resumen" class="resumen-container">
            <label class="resumen-title">RESÚMEN</label>
            <div class="resumen-content" v-html="revista.resumen"></div>
          </div>
          <div v-else class="resumen-container">
            <label class="resumen-title">RESÚMEN</label>
            <div class="resumen-content"></div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
const props = defineProps({
  revista: { type: Object, required: true },
  modelValue: { type: Boolean, required: true },
  imageBaseUrl: { type: String, default: '/public/portadas/' }
});
const emit = defineEmits(['update:modelValue', 'close']);

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
});

const isMaximized = ref(false);
function toggleMaximized() {
  isMaximized.value = !isMaximized.value;
}

const infoKeys = computed(() => {
  if (!props.revista) return [];
  return Object.entries(props.revista)
    .filter(([key]) => !['portada', 'resumen', 'id'].includes(key));
});
const infoCol1 = computed(() => {
  const arr = infoKeys.value;
  const half = Math.ceil(arr.length / 2);
  return Object.fromEntries(arr.slice(0, half));
});
const infoCol2 = computed(() => {
  const arr = infoKeys.value;
  const half = Math.ceil(arr.length / 2);
  return Object.fromEntries(arr.slice(half));
});
</script>

<style scoped>
.custom-dialog {
  max-width: 1350px;
  width: 100vw;
}
.scrollable-content {
  max-height: 70vh;
  overflow-y: auto;
}
.portada-img {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.etq {
  font-weight: bold;
  font-size: 0.95em;
  color: #333;
}
.contenido {
  font-size: 0.95em;
  color: #444;
}
.resumen-title {
  font-weight: bold;
  font-size: 1.1em;
  color: #1976d2;
  margin-bottom: 4px;
  display: block;
}
.resumen-content {
  font-size: 0.98em;
  color: #222;
  background: #f8f8f8;
  border-radius: 6px;
  padding: 10px 12px;
  margin-top: 2px;
}
</style>
