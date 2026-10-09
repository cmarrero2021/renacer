<template>
  <div class="login-page" :style="{ backgroundImage: `url(${bgImage})` }">
    <div class="header">
      <img alt="Logo" src="img/logo-nobg2.png" class="logo-left" />
      <img alt="Observatorio Nacional de Ciencia, Tecnología e Innovación" src="img/oncti-nobg.png"
        class="logo-right" />
    </div>
    <div class="content-container">
      <div class="register-box">
        <h5>RENACER</h5>
        <h4>{{ tituloPaso }}</h4>

        <!-- Indicador de pasos -->
        <q-stepper flat v-model="pasoActual" alternative-labels class="bg-transparent no-shadow q-mb-sm" animated
          active-color="primary" done-color="positive" header-nav>
          <q-step :name="1" title="Correo" icon="mail" :done="pasoActual > 1" />
          <q-step :name="2" title="Código" icon="pin" :done="pasoActual > 2" />
          <q-step :name="3" title="Identidad" icon="badge" :done="pasoActual > 3" />
          <q-step :name="4" title="Datos" icon="home_work" :done="pasoActual > 4" />
          <q-step :name="5" title="Contraseña" icon="lock" :done="pasoActual > 5" />
        </q-stepper>

        <!-- PASO 1: Correo electrónico -->
        <template v-if="pasoActual === 1">
          <p class="text-body2 q-mb-sm">
            Ingrese su correo electrónico. Se le enviará un código de confirmación con una validez de 24 horas.
          </p>
          <q-input filled outlined v-model="email" label="Correo Electrónico" type="email"
            @keyup.enter="handleRequestCode">
            <template v-slot:prepend>
              <q-icon name="email" />
            </template>
          </q-input>
          <q-btn label="Enviar Código" class="q-mt-md full-width" color="primary" @click="handleRequestCode"
            :loading="loading" />
          <q-btn flat label="Volver al inicio de sesión" color="grey" icon="arrow_back" class="q-mt-sm"
            @click="$router.push('/login')" />
        </template>

        <!-- PASO 2: Código de confirmación -->
        <template v-if="pasoActual === 2">
          <p class="text-body2 q-mb-sm">
            Se envió un código de 6 dígitos a <strong>{{ email }}</strong>
          </p>
          <p class="text-caption text-grey q-mb-md">El código es válido por 24 horas.</p>
          <q-input filled outlined v-model="codigo" label="Código de Confirmación" mask="######" maxlength="6"
            class="code-input" @keyup.enter="handleVerifyCode">
            <template v-slot:prepend>
              <q-icon name="pin" />
            </template>
          </q-input>
          <q-btn label="Verificar Código" class="q-mt-md full-width" color="primary" @click="handleVerifyCode"
            :loading="loading" />
          <div class="q-mt-sm">
            <q-btn flat dense label="Reenviar código" color="grey" icon="refresh" @click="handleRequestCode"
              :loading="loading" :disable="loading" />
            <q-btn flat dense label="Volver al inicio" color="grey" icon="arrow_back" @click="volverAlInicio" />
          </div>
        </template>
        <!-- PASO 3: Identidad (nacionalidad y cédula) -->
        <template v-if="pasoActual === 3">
          <p class="text-body2 q-mb-sm">
            Introduzca su nacionalidad y número de cédula para verificar su identidad.
          </p>
          <div class="row q-col-gutter-sm">
            <div class="col-4">
              <q-select filled outlined v-model="nacionalidad" :options="opcionesNacionalidad" label="Nacionalidad"
                emit-value map-options :disable="!!identidad" />
            </div>
            <div class="col-8">
              <q-input filled outlined v-model="cedula" label="Cédula" type="number" min="1" :disable="!!identidad"
                @keyup.enter="handleConsultarIdentidad" />
            </div>
          </div>
          <q-btn v-if="!identidad" label="Consultar Identidad" class="q-mt-md full-width" color="primary"
            @click="handleConsultarIdentidad" :loading="loading" />

          <!-- Datos de identidad (solo lectura, rellenados por la API) -->
          <template v-if="identidad">
            <q-banner class="bg-positive text-white q-mt-md" rounded dense>
              <template v-slot:avatar>
                <q-icon name="check_circle" />
              </template>
              Datos de identidad verificados. Los mismos no pueden ser modificados.
            </q-banner>
            <q-input filled :model-value="identidad.primer_nombre" label="Primer Nombre" disable class="q-mt-sm" />
            <q-input filled :model-value="identidad.segundo_nombre" label="Segundo Nombre" disable />
            <q-input filled :model-value="identidad.primer_apellido" label="Primer Apellido" disable />
            <q-input filled :model-value="identidad.segundo_apellido" label="Segundo Apellido" disable />
            <div class="row q-col-gutter-sm">
              <div class="col-4">
                <q-input filled :model-value="identidad.sexo" label="Sexo" disable />
              </div>
              <div class="col-5">
                <q-input filled :model-value="identidad.fecha_nacimiento" label="F. Nacimiento" disable />
              </div>
              <div class="col-3">
                <q-input filled :model-value="identidad.nacionalidad" label="Nac." disable />
              </div>
            </div>
            <q-btn label="Continuar" class="q-mt-md full-width" color="primary" @click="pasoActual = 4" />
          </template>
          <div v-else class="q-mt-sm">
            <q-btn flat dense label="Volver al inicio" color="grey" icon="arrow_back" @click="volverAlInicio" />
          </div>
        </template>

        <!-- PASO 4: Datos del usuario y del centro -->
        <template v-if="pasoActual === 4">
          <p class="text-caption text-weight-medium q-mb-xs">Datos de contacto del usuario</p>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-input filled v-model="telefono" label="N° de Teléfono" mask="(####) ###-####" unmasked-value
                :rules="[val => !!val || 'Requerido']">
                <template v-slot:prepend>
                  <q-icon name="phone" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6">
              <q-input filled v-model="celular" label="N° de Celular" mask="(####) ###-####" unmasked-value
                :rules="[val => !!val || 'Requerido']">
                <template v-slot:prepend>
                  <q-icon name="smartphone" />
                </template>
              </q-input>
            </div>
          </div>

          <q-separator class="q-my-md" />
          <p class="text-caption text-weight-medium q-mb-sm">Datos del centro (sólo puede registrar un centro)</p>

          <div class="row q-col-gutter-sm">
            <div class="col-5 col-sm-4">
              <q-select filled v-model="tipoRif" :options="opcionesTipoRif" label="Tipo de RIF" emit-value map-options
                :rules="[val => !!val || 'Requerido']" />
            </div>
            <div class="col-7 col-sm-8">
              <q-input filled v-model="numeroRif" label="N° del RIF" mask="########-#" unmasked-value
                :rules="rifRules">
                <template v-slot:prepend>
                  <span class="text-weight-bold">{{ tipoRif || '?' }}</span>
                </template>
              </q-input>
            </div>
          </div>

          <q-input filled v-model="nombreCentro" label="Nombre del Centro" counter maxlength="150"
            :rules="[val => !!val || 'Requerido']" class="q-mt-sm" />

          <q-input filled v-model="direccionCentro" label="Dirección del Centro" type="textarea" counter
            maxlength="500" :rules="[val => !!val || 'Requerido']" class="q-mt-sm" autogrow />

          <q-input filled v-model="telefonoCentro" label="N° de Teléfono del Centro" mask="(####) ###-####"
            unmasked-value :rules="[val => !!val || 'Requerido']" class="q-mt-sm">
            <template v-slot:prepend>
              <q-icon name="business" />
            </template>
          </q-input>

          <q-input filled v-model="correoCentro" label="Correo Electrónico del Centro" type="email" class="q-mt-sm"
            :rules="[val => !!val || 'Requerido', val => validateEmail(val) || 'Correo inválido']">
            <template v-slot:prepend>
              <q-icon name="email" />
            </template>
          </q-input>

          <div class="row q-mt-md q-gutter-sm">
            <q-btn flat label="Volver" color="grey" @click="pasoActual = 3" :disable="loading" />
            <q-btn label="Continuar" color="primary" class="col" @click="validarDatosYContinuar" :disable="loading" />
          </div>
        </template>
        <!-- PASO 5: Contraseña -->
        <template v-if="pasoActual === 5">
          <p class="text-body2 q-mb-sm">Cree su contraseña de acceso.</p>

          <q-input filled v-model="password" label="Contraseña" :type="showPassword ? 'text' : 'password'"
            class="q-mb-sm no-uppercase">
            <template v-slot:append>
              <q-btn :icon="showPassword ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
                @click="showPassword = !showPassword" />
            </template>
          </q-input>

          <q-input filled v-model="confirmPassword" label="Confirmar Contraseña"
            :type="showConfirmPassword ? 'text' : 'password'" class="no-uppercase"
            :rules="[val => !!val || 'Requerido', val => val === password || 'Las contraseñas no coinciden']">
            <template v-slot:append>
              <q-btn :icon="showConfirmPassword ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
                @click="showConfirmPassword = !showConfirmPassword" />
            </template>
          </q-input>

          <!-- Indicador de requisitos en tiempo real -->
          <div class="q-mt-sm">
            <p class="text-caption text-weight-medium q-mb-xs">Requisitos de la contraseña:</p>
            <div v-for="req in passwordRequirements" :key="req.label" class="req-item">
              <q-icon :name="req.met ? 'check_circle' : 'cancel'" :color="req.met ? 'positive' : 'grey-5'"
                size="16px" />
              <span :class="req.met ? 'text-positive' : 'text-grey'" class="text-caption q-ml-xs">{{ req.label }}</span>
            </div>
          </div>

          <div class="row q-mt-md q-gutter-sm">
            <q-btn flat label="Volver" color="grey" @click="pasoActual = 4" :disable="loading" />
            <q-btn label="Registrarse" color="primary" class="col" @click="handleCompletarRegistro"
              :loading="loading" />
          </div>
        </template>

        <!-- Diálogo de éxito -->
        <q-dialog v-model="registroExitoso" persistent>
          <q-card style="min-width: 340px; max-width: 450px;">
            <q-card-section class="text-center">
              <q-icon name="check_circle" color="positive" size="64px" />
              <div class="text-h6 q-mt-sm">¡Registro exitoso!</div>
              <p class="text-body2 q-mt-sm">
                Su cuenta y su centro han sido registrados correctamente. Ya puede iniciar sesión con su correo y
                contraseña.
              </p>
            </q-card-section>
            <q-card-actions align="center">
              <q-btn label="Ir a Iniciar Sesión" color="primary" @click="$router.push('/login')" />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { Notify } from "quasar";
import { registroService } from "src/services/registro.service";

const bgImage = new URL('/img/centro_adultos_mayores_venezuela.jpg', import.meta.url).href;

// ==========================================
// Estado general
// ==========================================
const pasoActual = ref(1);
const loading = ref(false);
const registroToken = ref("");
const registroExitoso = ref(false);

const titulos = {
  1: "Registro - Correo Electrónico",
  2: "Verificación de Código",
  3: "Datos de Identidad",
  4: "Datos del Usuario y del Centro",
  5: "Contraseña de Acceso",
};
const tituloPaso = computed(() => titulos[pasoActual.value] || "Registro de Usuario");

const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

const volverAlInicio = () => {
  pasoActual.value = 1;
  email.value = "";
  codigo.value = "";
  registroToken.value = "";
  identidad.value = null;
};

// ==========================================
// PASO 1: Solicitar código
// ==========================================
const email = ref("");

const handleRequestCode = async () => {
  if (!email.value) {
    Notify.create({ message: "El correo electrónico no puede estar vacío.", color: "negative", position: "top", timeout: 3000 });
    return;
  }
  if (!validateEmail(email.value)) {
    Notify.create({ message: "El formato del correo electrónico no es válido.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  loading.value = true;
  try {
    const response = await registroService.requestCode(email.value);

    if (response.data.alreadyVerified) {
      // El correo ya estaba verificado: continuar directamente
      registroToken.value = response.data.registroToken;
      pasoActual.value = 3;
      Notify.create({ message: response.data.message, color: "positive", position: "top", timeout: 4000 });
    } else if (response.data.alreadyRequested) {
      // Código vigente pendiente de uso: no se reenvía
      Notify.create({ message: response.data.message, color: "warning", position: "top", timeout: 6000 });
      pasoActual.value = 2;
    } else {
      pasoActual.value = 2;
      Notify.create({ message: response.data.message, color: "positive", position: "top", timeout: 5000, icon: "email" });
    }
  } catch (error) {
    const data = error.response?.data;
    Notify.create({ message: data?.error || "Error al enviar el código. Intente nuevamente.", color: "negative", position: "top", timeout: 5000 });
  } finally {
    loading.value = false;
  }
};

// ==========================================
// PASO 2: Verificar código
// ==========================================
const codigo = ref("");

const handleVerifyCode = async () => {
  if (!codigo.value || codigo.value.length !== 6) {
    Notify.create({ message: "Ingrese el código de 6 dígitos.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  loading.value = true;
  try {
    const response = await registroService.verifyCode(email.value, codigo.value);
    registroToken.value = response.data.registroToken;
    Notify.create({ message: "Correo electrónico verificado correctamente.", color: "positive", position: "top", timeout: 4000, icon: "check_circle" });
    pasoActual.value = 3;
  } catch (error) {
    const data = error.response?.data;
    Notify.create({ message: data?.error || "Error al verificar el código.", color: "negative", position: "top", timeout: 5000 });
    if (data?.expired || data?.codeInvalidated) {
      codigo.value = "";
    }
  } finally {
    loading.value = false;
  }
};

// ==========================================
// PASO 3: Consultar identidad
// ==========================================
const nacionalidad = ref(null);
const cedula = ref("");
const identidad = ref(null);

const opcionesNacionalidad = [
  { label: "V - Venezolano", value: "V" },
  { label: "E - Extranjero", value: "E" },
];

const handleConsultarIdentidad = async () => {
  if (!nacionalidad.value) {
    Notify.create({ message: "Seleccione la nacionalidad.", color: "negative", position: "top", timeout: 3000 });
    return;
  }
  const cedulaNum = parseInt(cedula.value, 10);
  if (!cedula.value || !Number.isInteger(cedulaNum) || cedulaNum <= 0) {
    Notify.create({ message: "El número de cédula debe ser un número entero.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  loading.value = true;
  try {
    const response = await registroService.consultarIdentidad(registroToken.value, nacionalidad.value, cedulaNum);
    if (response.data.encontrado) {
      identidad.value = response.data.identidad;
      Notify.create({ message: "Datos de identidad obtenidos correctamente.", color: "positive", position: "top", timeout: 4000 });
    } else {
      Notify.create({ message: response.data.message || "No se encontraron datos de identidad.", color: "warning", position: "top", timeout: 5000 });
    }
  } catch (error) {
    const data = error.response?.data;
    if (error.response?.status === 401) {
      Notify.create({ message: data?.error || "Sesión de registro expirada. Inicie nuevamente.", color: "negative", position: "top", timeout: 5000 });
      volverAlInicio();
    } else {
      Notify.create({ message: data?.error || "Error al consultar la identidad.", color: "negative", position: "top", timeout: 5000 });
    }
  } finally {
    loading.value = false;
  }
};

// ==========================================
// PASO 4: Datos del usuario y del centro
// ==========================================
const telefono = ref("");
const celular = ref("");
const tipoRif = ref(null);
const numeroRif = ref("");
const nombreCentro = ref("");
const direccionCentro = ref("");
const telefonoCentro = ref("");
const correoCentro = ref("");

// Tipos de RIF permitidos (se excluyen V - Natural, E - Extranjero y P - Pasaporte)
const opcionesTipoRif = [
  { label: "J - Jurídico", value: "J" },
  { label: "G - Gobierno", value: "G" },
  { label: "C - Comuna", value: "C" },
];

const rifRules = [
  (val) => !!val || "Requerido",
  (val) => val.replace(/\D/g, "").length === 9 || "Debe contener 9 dígitos (8 + verificador)",
];

const validarDatosYContinuar = () => {
  if (!telefono.value || !celular.value) {
    Notify.create({ message: "Complete los números de teléfono y celular del usuario.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (!tipoRif.value) {
    Notify.create({ message: "Seleccione el tipo de RIF.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  const rifDigits = String(numeroRif.value || "").replace(/\D/g, "");
  if (rifDigits.length !== 9) {
    Notify.create({ message: "El número del RIF debe contener 9 dígitos.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (!nombreCentro.value.trim()) {
    Notify.create({ message: "Ingrese el nombre del centro.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (!direccionCentro.value.trim()) {
    Notify.create({ message: "Ingrese la dirección del centro.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (!telefonoCentro.value) {
    Notify.create({ message: "Ingrese el número de teléfono del centro.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (!correoCentro.value || !validateEmail(correoCentro.value)) {
    Notify.create({ message: "Ingrese un correo electrónico válido del centro.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  pasoActual.value = 5;
};

// ==========================================
// PASO 5: Contraseña
// ==========================================
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);

// Requisitos en tiempo real
const passwordRequirements = computed(() => [
  { label: "Mínimo 8 caracteres", met: password.value.length >= 8 },
  { label: "Al menos una mayúscula", met: /[A-Z]/.test(password.value) },
  { label: "Al menos una minúscula", met: /[a-z]/.test(password.value) },
  { label: "Al menos un número", met: /[0-9]/.test(password.value) },
  { label: "No más de dos caracteres iguales consecutivos", met: !/(.)\1{2,}/.test(password.value) },
  { label: "Al menos un carácter especial (#$%&/@.-)", met: /[$#%&/@.-]/.test(password.value) },
]);

const handleCompletarRegistro = async () => {
  const allMet = passwordRequirements.value.every((r) => r.met);
  if (!allMet) {
    Notify.create({ message: "La contraseña no cumple todos los requisitos.", color: "negative", position: "top", timeout: 4000 });
    return;
  }
  if (password.value !== confirmPassword.value) {
    Notify.create({ message: "Las contraseñas no coinciden.", color: "negative", position: "top", timeout: 4000 });
    return;
  }

  loading.value = true;
  try {
    const rifDigits = String(numeroRif.value).replace(/\D/g, "");
    const payload = {
      identidad: identidad.value,
      telefono: telefono.value,
      celular: celular.value,
      password: password.value,
      centro: {
        tipo_rif: tipoRif.value,
        numero_rif: rifDigits,
        nombre: nombreCentro.value,
        direccion: direccionCentro.value,
        telefono: telefonoCentro.value,
        correo: correoCentro.value,
      },
    };
    await registroService.completar(registroToken.value, payload);
    registroExitoso.value = true;
  } catch (error) {
    const data = error.response?.data;
    const mensaje = data?.details ? data.details.join(" ") : data?.error || "Error al completar el registro.";
    Notify.create({ message: mensaje, color: "negative", position: "top", timeout: 6000 });
    if (error.response?.status === 401) {
      volverAlInicio();
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  position: absolute;
  top: 0px;
  left: 0;
  right: 0;
  z-index: 10;
}

.logo-left {
  width: 300px;
  height: auto;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.logo-right {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.content-container {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 96px 20px 200px;
}

.register-box {
  background-color: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  padding: 24px 28px 32px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 620px;
  max-width: 94vw;
  text-align: center;
  z-index: 5;
}

.code-input :deep(.q-field__native) {
  font-size: 24px;
  letter-spacing: 8px;
  text-align: center;
  font-weight: bold;
}

.req-item {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
  text-align: left;
}

@media (max-width: 768px) {
  .header {
    padding: 8px 12px;
  }

  .logo-left {
    width: 160px;
  }

  .logo-right {
    width: 45px;
    height: 45px;
  }

  .register-box {
    width: 100%;
    max-width: 94vw;
    padding: 16px 16px 24px;
  }

  .content-container {
    padding: 90px 12px 160px;
    align-items: flex-start;
  }
}
</style>
