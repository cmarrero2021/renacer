<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 800px; max-width: 90vw; max-height: 90vh" class="revista-modal">
      <!-- Header -->
      <q-card-section class="q-pb-none">
        <div class="text-h5 text-weight-medium text-primary">
          <q-icon :name="isEditing ? 'edit' : 'add_circle_outline'" size="28px" class="q-mr-sm" />
          {{ isEditing ? "Editar Revista" : "Nueva Revista" }}
        </div>
      </q-card-section>

      <!-- Tabs Navigation -->
      <q-card-section class="q-pt-md q-pb-none">
        <q-tabs v-model="activeTab" dense align="left" class="custom-tabs" indicator-color="primary"
          active-color="primary" active-bg-color="blue-1">
          <q-tab name="revista" class="custom-tab">
            <div class="row items-center no-wrap">
              <q-icon name="menu_book" size="20px" class="q-mr-xs" />
              <span>REVISTA</span>
            </div>
          </q-tab>
          <q-tab name="editor" class="custom-tab">
            <div class="row items-center no-wrap">
              <q-icon name="business" size="20px" class="q-mr-xs" />
              <span>EDITORIAL</span>
            </div>
          </q-tab>
        </q-tabs>
      </q-card-section>

      <!-- Form Content (scrollable) -->
      <q-card-section class="scroll-area q-pt-sm" style="max-height: calc(90vh - 280px); overflow-y: auto;">
        <q-form @submit="onSave">
          <q-tab-panels v-model="activeTab" animated class="bg-transparent">

            <!-- TAB REVISTA -->
            <q-tab-panel name="revista" class="q-pa-none">
              <!-- Información Básica -->
              <div class="section-divider">
                <q-icon name="info" size="18px" class="q-mr-xs" />
                <span class="section-title">Información Básica</span>
              </div>
              <div class="row q-col-gutter-md q-mb-lg">
                <div class="col-12 col-md-4">
                  <q-input v-model="localForm.id" label="ID" readonly filled dense />
                </div>
                <div class="col-12 col-md-8">
                  <q-input v-model="localForm.revista" label="📚 Nombre de la Revista" filled dense
                    @keyup="forceInputCase($event, 'revista', 'upper')" class="uppercase-input required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.anio_inicial" label="📅 Año Inicial" type="number" filled dense />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.url" label="🌐 URL" type="url" filled dense
                    @keyup="forceInputCase($event, 'url', 'lower')" class="lowercase-input" />
                </div>
                <div class="col-12">
                  <q-input v-model="localForm.direccion" label="📍 Dirección" filled dense
                    @keyup="forceInputCase($event, 'direccion', 'upper')" class="uppercase-input required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.correo_revista" label="📧 Correo Revista" type="email" filled dense
                    @keyup="forceInputCase($event, 'correo_revista', 'lower')" class="lowercase-input" />
                </div>
              </div>

              <!-- Identificadores -->
              <div class="section-divider">
                <q-icon name="fingerprint" size="18px" class="q-mr-xs" />
                <span class="section-title">Identificadores</span>
              </div>
              <div class="row q-col-gutter-md q-mb-lg">
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.issn_impreso" label="🏷️ ISSN Impreso" filled dense
                    @keyup="forceInputCase($event, 'issn_impreso', 'upper')" class="uppercase-input" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.issn_digital" label="🏷️ ISSN Digital" filled dense
                    @keyup="forceInputCase($event, 'issn_digital', 'upper')" class="uppercase-input" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.deposito_legal_impreso" label="📋 Depósito Legal Impreso" filled dense
                    @keyup="forceInputCase($event, 'deposito_legal_impreso', 'upper')" class="uppercase-input" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.deposito_legal_digital" label="📋 Depósito Legal Digital" filled dense
                    @keyup="forceInputCase($event, 'deposito_legal_digital', 'upper')" class="uppercase-input" />
                </div>
              </div>

              <!-- Clasificación -->
              <div class="section-divider">
                <q-icon name="category" size="18px" class="q-mr-xs" />
                <span class="section-title">Clasificación</span>
              </div>
              <div class="row q-col-gutter-md q-mb-lg">
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.area_conocimiento" :options="filteredAreas"
                    label="🎓 Área de Conocimiento" filled dense option-label="label" option-value="value" emit-value
                    map-options use-input input-debounce="300" @filter="filterAreas" class="required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.indice" :options="filteredIndices" label="📚 Índice" filled dense
                    option-label="label" option-value="value" emit-value map-options use-input input-debounce="300"
                    @filter="filterIndices" class="required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.idioma" :options="filteredIdiomas" label="🌍 Idioma" filled dense
                    option-label="label" option-value="value" emit-value map-options use-input input-debounce="300"
                    @filter="filterIdiomas" class="required-field" />
                </div>
              </div>

              <!-- Publicación -->
              <div class="section-divider">
                <q-icon name="schedule" size="18px" class="q-mr-xs" />
                <span class="section-title">Publicación</span>
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.periodicidad" :options="filteredPeriodicidad" label="📅 Periodicidad"
                    filled dense option-label="label" option-value="value" emit-value map-options use-input
                    input-debounce="300" @filter="filterPeriodicidad" class="required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.formato" :options="filteredFormatos" label="📄 Formato" filled dense
                    option-label="label" option-value="value" emit-value map-options use-input input-debounce="300"
                    @filter="filterFormatos" class="required-field" />
                </div>
              </div>
            </q-tab-panel>

            <!-- TAB EDITORIAL -->
            <q-tab-panel name="editor" class="q-pa-none">
              <!-- Información Editorial -->
              <div class="section-divider">
                <q-icon name="business" size="18px" class="q-mr-xs" />
                <span class="section-title">Información Editorial</span>
              </div>
              <div class="row q-col-gutter-md q-mb-lg">
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.editorial" :options="filteredEditoriales" label="🏢 Editorial" filled
                    dense option-label="label" option-value="value" emit-value map-options use-input
                    input-debounce="300" @filter="filterEditoriales" class="required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-select v-model="localForm.estado" :options="filteredEstados" label="📍 Estado" filled dense
                    option-label="label" option-value="value" emit-value map-options use-input input-debounce="300"
                    @filter="filterEstados" class="required-field" />
                </div>
              </div>

              <!-- Datos del Editor -->
              <div class="section-divider">
                <q-icon name="person" size="18px" class="q-mr-xs" />
                <span class="section-title">Datos del Editor</span>
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.nombres_editor" label="👤 Nombres Editor" filled dense
                    @keyup="forceInputCase($event, 'nombres_editor', 'upper')" class="uppercase-input required-field" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.apellidos_editor" label="👤 Apellidos Editor" filled dense
                    @keyup="forceInputCase($event, 'apellidos_editor', 'upper')" class="uppercase-input" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.correo_editor" label="📧 Correo Editor" type="email" filled dense
                    @keyup="forceInputCase($event, 'correo_editor', 'lower')" class="lowercase-input" />
                </div>
                <div class="col-12 col-md-6">
                  <q-input v-model="localForm.telefono" label="📞 Teléfono Editor" filled dense
                    @keyup="forceInputCase($event, 'telefono', 'upper')" class="uppercase-input" />
                </div>
              </div>
            </q-tab-panel>
          </q-tab-panels>

          <!-- Resumen y Portada (fuera de tabs) -->
          <div class="q-mt-lg q-pt-md" style="border-top: 1px solid #e0e0e0;">
            <div class="section-divider">
              <q-icon name="description" size="18px" class="q-mr-xs" />
              <span class="section-title">Resumen y Portada</span>
            </div>

            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col-12">
                <q-input v-model="localForm.resumen" label="📝 Resumen" type="textarea" filled dense rows="4" counter
                  maxlength="500" spellcheck="false" class="normal-input required-field" hint="Máximo 500 caracteres" />
              </div>
              <div class="col-12">
                <q-file v-model="imageFile" label="📎 Subir portada (JPG/PNG, máx 2MB)" accept=".jpg,.jpeg,.png"
                  max-files="1" outlined dense @update:model-value="handleImageUpload"
                  class="portada-upload required-field">
                  <template v-slot:prepend>
                    <q-icon name="image" color="primary" />
                  </template>
                </q-file>
                <div v-if="imagePreview" class="q-mt-md text-center">
                  <q-img :src="imagePreview"
                    style="max-width: 250px; max-height: 250px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                    class="portada-preview" />
                </div>
              </div>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <!-- Footer con botones siempre visibles -->
      <q-separator />
      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn label="Cancelar" icon="cancel" color="negative" outline @click="onClose" class="q-px-lg" />
        <q-btn label="Guardar" icon="save" color="primary" unelevated @click="onSave" class="q-px-lg q-ml-sm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { Notify } from 'quasar';
const activeTab = ref('revista');
const props = defineProps({
  modelValue: Boolean,
  editForm: Object,
  isEditing: Boolean,
  optionsu: Object,
  imagePreview: String,
  imageFile: [File, Array, null],
});
const emit = defineEmits(['update:modelValue', 'save', 'close', 'update:imageFile', 'update:imagePreview']);
const localForm = ref({ ...props.editForm });
watch(() => props.editForm, (val) => {
  localForm.value = { ...val };
}, { deep: true, immediate: true });
const imageFile = ref(props.imageFile || null);
const imagePreview = ref(props.imagePreview || null);
watch(() => props.imageFile, (val) => { imageFile.value = val; });
watch(() => props.imagePreview, (val) => { imagePreview.value = val; });

// Variables reactivas para opciones filtradas
const filteredAreas = ref(props.optionsu?.area_conocimiento || []);
const filteredIndices = ref(props.optionsu?.indice || []);
const filteredIdiomas = ref(props.optionsu?.idioma || []);
const filteredFormatos = ref(props.optionsu?.formato || []);
const filteredPeriodicidad = ref(props.optionsu?.periodicidad || []);
const filteredEditoriales = ref(props.optionsu?.editorial || []);
const filteredEstados = ref(props.optionsu?.estado || []);

// Watch para actualizar las opciones filtradas cuando cambian las props
watch(() => props.optionsu, (val) => {
  if (val) {
    filteredAreas.value = val.area_conocimiento || [];
    filteredIndices.value = val.indice || [];
    filteredIdiomas.value = val.idioma || [];
    filteredFormatos.value = val.formato || [];
    filteredPeriodicidad.value = val.periodicidad || [];
    filteredEditoriales.value = val.editorial || [];
    filteredEstados.value = val.estado || [];
  }
}, { deep: true, immediate: true });

// Función genérica de filtrado
const filterFn = (val, update, fullOptions, filteredRef) => {
  update(() => {
    if (val === '') {
      filteredRef.value = fullOptions || [];
    } else {
      const needle = val.toLowerCase();
      filteredRef.value = (fullOptions || []).filter(
        item => item.label.toLowerCase().indexOf(needle) > -1
      );
    }
  });
};

// Funciones de filtrado para cada select
const filterAreas = (val, update) => filterFn(val, update, props.optionsu?.area_conocimiento, filteredAreas);
const filterIndices = (val, update) => filterFn(val, update, props.optionsu?.indice, filteredIndices);
const filterIdiomas = (val, update) => filterFn(val, update, props.optionsu?.idioma, filteredIdiomas);
const filterFormatos = (val, update) => filterFn(val, update, props.optionsu?.formato, filteredFormatos);
const filterPeriodicidad = (val, update) => filterFn(val, update, props.optionsu?.periodicidad, filteredPeriodicidad);
const filterEditoriales = (val, update) => filterFn(val, update, props.optionsu?.editorial, filteredEditoriales);
const filterEstados = (val, update) => filterFn(val, update, props.optionsu?.estado, filteredEstados);

const handleImageUpload = (file) => {
  if (file) {
    // Validar tipo de archivo (JPG o PNG)
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      Notify.create({
        type: 'negative',
        message: 'Solo se permiten archivos JPG o PNG',
        position: 'top'
      });
      imageFile.value = null;
      emit('update:imageFile', null);
      emit('update:imagePreview', null);
      return;
    }

    // Validar tamaño de archivo (max 2MB)
    const maxSizeMB = 2;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      Notify.create({
        type: 'negative',
        message: `El archivo es demasiado grande. Máximo permitido: ${maxSizeMB}MB (tu archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        position: 'top',
        timeout: 5000,
        icon: 'warning'
      });
      // Limpiar todo
      imageFile.value = null;
      imagePreview.value = null;
      emit('update:imageFile', null);
      emit('update:imagePreview', null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target.result;
      emit('update:imagePreview', e.target.result);
    };
    reader.readAsDataURL(file);
    imageFile.value = file;
    emit('update:imageFile', file);
  } else {
    imagePreview.value = null;
    imageFile.value = null;
    emit('update:imageFile', null);
    emit('update:imagePreview', null);
  }
};

// Manejar archivos rechazados por Quasar (tamaño o tipo inválido)
const onFileRejected = (rejectedEntries) => {
  rejectedEntries.forEach(entry => {
    if (entry.failedPropValidation === 'max-file-size') {
      Notify.create({
        type: 'negative',
        message: `El archivo "${entry.file.name}" excede el tamaño máximo de 2MB (${(entry.file.size / 1024 / 1024).toFixed(2)}MB)`,
        position: 'top',
        icon: 'warning',
        timeout: 5000
      });
    } else if (entry.failedPropValidation === 'accept') {
      Notify.create({
        type: 'negative',
        message: 'Solo se permiten archivos JPG/JPEG',
        position: 'top',
        icon: 'warning',
        timeout: 3000
      });
    }
  });
};

// Funciones de validación
const isValidEmail = (email) => {
  if (!email) return true; // Si está vacío, no validar formato (solo requerido valida si está vacío)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Valida URL y retorna array de errores específicos
const validateUrl = (url) => {
  const urlErrors = [];
  if (!url) return urlErrors; // Si está vacío, no hay errores de formato

  // Verificar espacios en blanco
  if (url.includes(' ')) {
    urlErrors.push('La URL no debe tener espacios en blanco');
  }

  // Verificar que comience con http o https
  const startsWithHttp = url.toLowerCase().startsWith('http');
  const startsWithHttps = url.toLowerCase().startsWith('https');
  if (!startsWithHttp && !startsWithHttps) {
    urlErrors.push('La URL debe comenzar con http o https');
  }

  // Verificar : después de http/https
  const hasColon = url.includes(':');
  if (!hasColon) {
    urlErrors.push('La URL debe tener : después de http o https');
  } else {
    // Verificar // después de :
    const colonIndex = url.indexOf(':');
    const afterColon = url.substring(colonIndex + 1);
    if (!afterColon.startsWith('//')) {
      urlErrors.push('La URL debe tener // después de los dos puntos');
    }
  }

  // Verificar dominio válido (solo si tiene el formato básico correcto)
  if (url.includes('://')) {
    const afterProtocol = url.split('://')[1];
    if (!afterProtocol || afterProtocol.trim() === '') {
      urlErrors.push('Se debe indicar el dominio en la URL');
    } else {
      // Verificar que el dominio tenga extensión (al menos un punto)
      const domain = afterProtocol.split('/')[0]; // Tomar solo el dominio, no la ruta
      if (!domain.includes('.')) {
        urlErrors.push('El dominio de la URL debe tener una extensión válida (ej: .com, .org, .ve)');
      }
    }
  }

  return urlErrors;
};

const onSave = (e) => {
  e.preventDefault();

  // Validar campos obligatorios y formatos
  const errors = [];

  // Campos obligatorios
  if (!localForm.value.revista?.trim()) errors.push('Nombre de la Revista es obligatorio');
  if (!localForm.value.direccion?.trim()) errors.push('Dirección es obligatoria');
  if (!localForm.value.area_conocimiento) errors.push('Área de Conocimiento es obligatoria');
  if (!localForm.value.indice) errors.push('Índice es obligatorio');
  if (!localForm.value.idioma) errors.push('Idioma es obligatorio');
  if (!localForm.value.periodicidad) errors.push('Periodicidad es obligatoria');
  if (!localForm.value.formato) errors.push('Formato es obligatorio');
  if (!localForm.value.resumen?.trim()) errors.push('Resumen es obligatorio');
  if (!imageFile.value && !props.imagePreview) errors.push('Portada es obligatoria');
  if (!localForm.value.editorial) errors.push('Editorial es obligatoria');
  if (!localForm.value.estado) errors.push('Estado es obligatorio');
  if (!localForm.value.nombres_editor?.trim()) errors.push('Nombres del Editor es obligatorio');

  // Validación de formato de URL (agrega todos los errores específicos)
  const urlErrors = validateUrl(localForm.value.url);
  errors.push(...urlErrors);

  // Validación de formato de correo
  if (localForm.value.correo_revista && !isValidEmail(localForm.value.correo_revista)) {
    errors.push('El correo de la revista no tiene un formato válido');
  }
  if (localForm.value.correo_editor && !isValidEmail(localForm.value.correo_editor)) {
    errors.push('El correo del editor no tiene un formato válido');
  }

  // Validación de ISSN y Depósito Legal
  const hasIssnImpreso = !!localForm.value.issn_impreso?.trim();
  const hasDepositoImpreso = !!localForm.value.deposito_legal_impreso?.trim();
  const hasIssnDigital = !!localForm.value.issn_digital?.trim();
  const hasDepositoDigital = !!localForm.value.deposito_legal_digital?.trim();

  // Obtener el nombre del formato seleccionado
  // localForm.value.formato puede ser un objeto {label, value} o solo el valor
  const formatoValue = typeof localForm.value.formato === 'object'
    ? localForm.value.formato?.value
    : localForm.value.formato;
  const formatoSeleccionado = props.optionsu?.formato?.find(f => String(f.value) === String(formatoValue));
  const formatoNombre = formatoSeleccionado?.label?.toUpperCase() ||
    (typeof localForm.value.formato === 'object' ? localForm.value.formato?.label?.toUpperCase() : '') || '';

  // Validar que al menos un par (impreso o digital) esté completo
  const tieneImpreso = hasIssnImpreso && hasDepositoImpreso;
  const tieneDigital = hasIssnDigital && hasDepositoDigital;

  if (!tieneImpreso && !tieneDigital) {
    // Si no hay ningún par completo, verificar qué falta
    if (!hasIssnImpreso && !hasIssnDigital && !hasDepositoImpreso && !hasDepositoDigital) {
      errors.push('Debe completar al menos el ISSN y Depósito Legal impreso o digital');
    } else {
      // Hay campos parcialmente llenos
      if (hasIssnImpreso && !hasDepositoImpreso) {
        errors.push('Si ingresa ISSN Impreso, también debe ingresar el Depósito Legal Impreso');
      }
      if (!hasIssnImpreso && hasDepositoImpreso) {
        errors.push('Si ingresa Depósito Legal Impreso, también debe ingresar el ISSN Impreso');
      }
      if (hasIssnDigital && !hasDepositoDigital) {
        errors.push('Si ingresa ISSN Digital, también debe ingresar el Depósito Legal Digital');
      }
      if (!hasIssnDigital && hasDepositoDigital) {
        errors.push('Si ingresa Depósito Legal Digital, también debe ingresar el ISSN Digital');
      }
    }
  } else {
    // Hay al menos un par completo, validar consistencia
    if (hasIssnImpreso && !hasDepositoImpreso) {
      errors.push('Si ingresa ISSN Impreso, también debe ingresar el Depósito Legal Impreso');
    }
    if (!hasIssnImpreso && hasDepositoImpreso) {
      errors.push('Si ingresa Depósito Legal Impreso, también debe ingresar el ISSN Impreso');
    }
    if (hasIssnDigital && !hasDepositoDigital) {
      errors.push('Si ingresa ISSN Digital, también debe ingresar el Depósito Legal Digital');
    }
    if (!hasIssnDigital && hasDepositoDigital) {
      errors.push('Si ingresa Depósito Legal Digital, también debe ingresar el ISSN Digital');
    }
  }

  // Validar que el formato coincida con los datos ingresados
  if (tieneImpreso && !tieneDigital) {
    // Solo tiene impreso, el formato debe ser IMPRESO
    if (!formatoNombre.includes('IMPRESO')) {
      errors.push('Si solo ingresa ISSN y Depósito Legal impreso, el formato debe ser Impreso');
    }
  } else if (!tieneImpreso && tieneDigital) {
    // Solo tiene digital, el formato debe ser DIGITAL
    if (!formatoNombre.includes('DIGITAL')) {
      errors.push('Si solo ingresa ISSN y Depósito Legal digital, el formato debe ser Digital');
    }
  } else if (tieneImpreso && tieneDigital) {
    // Tiene ambos, el formato debe ser MIXTO
    if (!formatoNombre.includes('MIXTO')) {
      errors.push('Si ingresa tanto impreso como digital, el formato debe ser Mixto');
    }
  }

  // Si hay errores, mostrar notificación y no guardar
  if (errors.length > 0) {
    Notify.create({
      type: 'negative',
      message: `Errores de validación:\n• ${errors.join('\n• ')}`,
      position: 'top',
      timeout: 8000,
      icon: 'error',
      html: true,
      multiLine: true
    });
    return;
  }

  emit('save', localForm.value, imageFile.value);
};
const onClose = () => {
  emit('close');
  emit('update:modelValue', false);
};
function forceInputCase(event, modelKey, type = 'upper') {
  const el = event.target;
  if (!el) return;
  if (type === 'upper') {
    el.value = el.value.toUpperCase();
    localForm.value[modelKey] = el.value;
  } else {
    el.value = el.value.toLowerCase();
    localForm.value[modelKey] = el.value;
  }
}
</script>

<style scoped>
/* Modal principal */
.revista-modal {
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* Header mejorado */
.text-h5 {
  display: flex;
  align-items: center;
}

/* Tabs personalizados */
.custom-tabs {
  background: linear-gradient(135deg, #f5f7fa 0%, #e3e8ef 100%);
  border-radius: 8px;
  padding: 4px;
}

.custom-tab {
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 6px;
  transition: all 0.3s ease;
  min-height: 44px;
}

.custom-tab:hover {
  background-color: rgba(25, 118, 210, 0.08);
}

/* Separadores de sección */
.section-divider {
  display: flex;
  align-items: center;
  padding: 12px 0;
  margin-bottom: 16px;
  border-bottom: 2px solid #1976d2;
  color: #1976d2;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* Área de scroll con estilo */
.scroll-area {
  padding: 16px 24px;
}

.scroll-area::-webkit-scrollbar {
  width: 8px;
}

.scroll-area::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.scroll-area::-webkit-scrollbar-thumb {
  background: #1976d2;
  border-radius: 10px;
}

.scroll-area::-webkit-scrollbar-thumb:hover {
  background: #1565c0;
}

/* Espaciado mejorado */
.q-mb-lg {
  margin-bottom: 28px;
}

/* Inputs y selects */
:deep(.q-field__control) {
  border-radius: 6px;
}

:deep(.q-field--filled .q-field__control) {
  background: #fafafa;
  transition: background 0.2s ease;
}

:deep(.q-field--filled .q-field__control:hover) {
  background: #f5f5f5;
}

:deep(.q-field--filled.q-field--focused .q-field__control) {
  background: #ffffff;
}

/* Campo de resumen mejorado */
.resumen-field :deep(textarea) {
  font-family: 'Roboto', sans-serif;
  line-height: 1.6;
  min-height: 100px;
}

/* Portada upload */
.portada-upload :deep(.q-field__control) {
  border: 2px dashed #1976d2;
  background: #f8f9fa;
  transition: all 0.3s ease;
}

.portada-upload:hover :deep(.q-field__control) {
  border-color: #1565c0;
  background: #e3f2fd;
}

/* Preview de portada */
.portada-preview {
  margin: 0 auto;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.portada-preview:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

/* Visual para mayúsculas/minúsculas */
.uppercase-input input,
.uppercase-input textarea {
  text-transform: uppercase;
  font-weight: 500;
}

.lowercase-input input,
.lowercase-input textarea {
  text-transform: lowercase;
}

/* Resumen sin transformación - mantiene formato original */
.normal-input input,
.normal-input textarea {
  text-transform: none;
  font-weight: 400;
}

/* Footer con botones */
:deep(.q-card-actions) {
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}

/* Botones mejorados */
:deep(.q-btn) {
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
}

:deep(.q-btn:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* daptaciones responsive */
@media (max-width: 600px) {
  .section-divider {
    font-size: 12px;
  }

  .section-title {
    font-size: 12px;
  }

  .scroll-area {
    padding: 12px 16px;
  }
}

/* Indicador de campo requerido (asterisco rojo) */
.required-field :deep(.q-field__label)::after {
  content: ' *';
  color: #d32f2f;
  font-weight: bold;
}
</style>
