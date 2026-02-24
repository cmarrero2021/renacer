<template>
  <div class="q-pa-md">
    <h4>Prueba de Upload de Archivo</h4>
    <q-form @submit.prevent="handleUpload">
      <q-file v-model="file" label="Selecciona un archivo" filled />
      <q-btn label="Subir" type="submit" color="primary" class="q-mt-md" />
    </q-form>
    <div v-if="uploadResult" class="q-mt-md">
      <q-banner type="positive">{{ uploadResult }}</q-banner>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const file = ref(null);
const uploadResult = ref('');

const handleUpload = async () => {
  if (!file.value) {
    uploadResult.value = 'Selecciona un archivo primero.';
    return;
  }
  const formData = new FormData();
  const f = Array.isArray(file.value) ? file.value[0] : file.value;
  formData.append('archivo', f);
  try {
    const response = await axios.post(`${import.meta.env.VITE_RV_UPLOAD_URL}/test-upload`, formData);
    uploadResult.value = `Archivo subido: ${response.data.filename}`;
  } catch (err) {
    uploadResult.value = 'Error al subir el archivo.';
  }
};
</script>
