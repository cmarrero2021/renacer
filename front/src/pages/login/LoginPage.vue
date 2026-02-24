<template>
  <div class="header">
    <img alt="Logo" src="img/logo-nobg1.png" class="logo-left" />
    <img alt="Observatorio Nacional de Ciencia, Tecnología e Innovación" src="img/oncti-nobg.png" class="logo-right" />
  </div>
  <div class="content-container">
    <img alt="Directorio" src="img/directorio1.png" class="directorio-image" />
    <div class="login-box">
      <h5>Sistema de Gestión</h5>
      <h4>Iniciar Sesión</h4>
      <q-input filled outlined v-model="email" label="Correo Electrónico" type="email" />
      <q-input filled outlined v-model="password" label="Contraseña" :type="isPasswordVisible ? 'text' : 'password'">
        <template v-slot:append>
          <q-btn :icon="isPasswordVisible ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
            @click="isPasswordVisible = !isPasswordVisible" />
        </template>
      </q-input>
      <q-btn label="Ingresar" class="q-mt-md" color="primary" @click="handleLogin" />
      <q-btn flat label="¿Olvidaste tu contraseña?" @click="showRecoveryDialog = true" />
    </div>
  </div>

  <!-- Diálogo de recuperación de contraseña -->
  <q-dialog v-model="showRecoveryDialog" persistent>
    <q-card style="min-width: 400px; max-width: 500px;">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">
          <q-icon name="lock_reset" class="q-mr-sm" />
          Recuperar Contraseña
        </div>
      </q-card-section>

      <!-- Paso 1: Ingresar email -->
      <q-card-section v-if="recoveryStep === 1">
        <p class="text-body2 q-mb-md">Ingrese su correo electrónico para recibir un código de verificación.</p>
        <q-input filled v-model="recoveryEmail" label="Correo Electrónico" type="email"
          :rules="[val => !!val || 'Requerido', val => validateEmail(val) || 'Email inválido']">
          <template v-slot:prepend>
            <q-icon name="email" />
          </template>
        </q-input>
      </q-card-section>

      <!-- Paso 2: Ingresar código -->
      <q-card-section v-if="recoveryStep === 2">
        <p class="text-body2 q-mb-sm">Se envió un código de 6 dígitos a <strong>{{ recoveryEmail }}</strong></p>
        <p class="text-caption text-grey q-mb-md">El código expira en 10 minutos.</p>
        <q-input filled v-model="recoveryCode" label="Código de Verificación" mask="######" maxlength="6"
          class="code-input" :rules="[val => !!val || 'Requerido', val => val.length === 6 || 'Debe ser de 6 dígitos']">
          <template v-slot:prepend>
            <q-icon name="pin" />
          </template>
        </q-input>
      </q-card-section>

      <!-- Paso 3: Nueva contraseña -->
      <q-card-section v-if="recoveryStep === 3">
        <p class="text-body2 q-mb-md">Ingrese su nueva contraseña.</p>

        <q-input filled v-model="newPassword" label="Nueva Contraseña" :type="showNewPassword ? 'text' : 'password'"
          class="q-mb-sm" :rules="passwordRules">
          <template v-slot:append>
            <q-btn :icon="showNewPassword ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
              @click="showNewPassword = !showNewPassword" />
          </template>
        </q-input>

        <q-input filled v-model="confirmPassword" label="Confirmar Contraseña"
          :type="showConfirmPassword ? 'text' : 'password'"
          :rules="[val => !!val || 'Requerido', val => val === newPassword || 'Las contraseñas no coinciden']">
          <template v-slot:append>
            <q-btn :icon="showConfirmPassword ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
              @click="showConfirmPassword = !showConfirmPassword" />
          </template>
        </q-input>

        <!-- Indicador de requisitos -->
        <div class="q-mt-sm">
          <p class="text-caption text-weight-medium q-mb-xs">Requisitos de la contraseña:</p>
          <div v-for="req in passwordRequirements" :key="req.label" class="req-item">
            <q-icon :name="req.met ? 'check_circle' : 'cancel'" :color="req.met ? 'positive' : 'grey-5'" size="16px" />
            <span :class="req.met ? 'text-positive' : 'text-grey'" class="text-caption q-ml-xs">{{ req.label }}</span>
          </div>
        </div>
      </q-card-section>

      <!-- Mensaje de cuenta suspendida -->
      <q-card-section v-if="accountSuspended">
        <q-banner class="bg-negative text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          Su cuenta ha sido suspendida por exceder el número máximo de intentos.
          <br />
          Comuníquese con el administrador:
          <br />
          <strong>{{ adminContactEmail }}</strong>
        </q-banner>
      </q-card-section>

      <!-- Stepper indicador -->
      <q-card-section v-if="!accountSuspended" class="q-pt-none">
        <div class="row justify-center q-gutter-sm">
          <q-badge v-for="s in 3" :key="s" :color="s <= recoveryStep ? 'primary' : 'grey-4'" rounded />
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancelar" color="grey" @click="closeRecoveryDialog" />
        <q-btn v-if="recoveryStep === 1 && !accountSuspended" label="Enviar Código" color="primary"
          :loading="recoveryLoading" @click="handleRequestReset" />
        <q-btn v-if="recoveryStep === 2" label="Verificar Código" color="primary" :loading="recoveryLoading"
          @click="handleVerifyCode" />
        <q-btn v-if="recoveryStep === 3" label="Cambiar Contraseña" color="primary" :loading="recoveryLoading"
          @click="handleResetPassword" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { LocalStorage, Notify } from "quasar";
import axios from "axios";

const email = ref("");
const password = ref("");
const isPasswordVisible = ref(false);
const router = useRouter();
const loginUrl = import.meta.env.VITE_LOGIN_URL;
const authApiUrl = import.meta.env.VITE_AUTH_API_URL || '/auth';

// Validación de email
const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

// Login
const handleLogin = async () => {
  if (!email.value) {
    Notify.create({ message: "El correo electrónico no puede estar vacío.", color: "negative", position: "top", timeout: 3000 });
    return;
  } else if (!validateEmail(email.value)) {
    Notify.create({ message: "El formato del correo electrónico no es válido.", color: "negative", position: "top", timeout: 3000 });
    return;
  }
  if (!password.value) {
    Notify.create({ message: "La contraseña no puede estar vacía.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  try {
    const response = await axios.post(loginUrl, {
      username: email.value,
      password: password.value,
    }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });

    if (response.data.message === "Inicio de sesión exitoso.") {
      LocalStorage.set('token', response.data.token);
      LocalStorage.set('permissions', response.data.permissions);
      LocalStorage.set('role', response.data.role);
      Notify.create({ message: "Ingresó correctamente", color: "positive", position: "top", timeout: 3000 });
      router.push("/admin");
    } else {
      Notify.create({ message: "Credenciales inválidas", color: "negative", position: "top", timeout: 3000 });
    }
  } catch (error) {
    const mensaje = error == 'AxiosError: Request failed with status code 403'
      ? 'El usuario ya tiene una sesión abierta. Ciérrela e intente de nuevo'
      : 'Error de conexión. Intente nuevamente.';
    Notify.create({ message: mensaje, color: "negative", position: "top", timeout: 3000 });
  }
};

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================
const showRecoveryDialog = ref(false);
const recoveryStep = ref(1);
const recoveryLoading = ref(false);
const recoveryEmail = ref("");
const recoveryCode = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const resetToken = ref("");
const accountSuspended = ref(false);
const adminContactEmail = ref("recam@gmail.com");

// Requisitos de contraseña
const passwordRequirements = computed(() => [
  { label: 'Mínimo 8 caracteres', met: newPassword.value.length >= 8 },
  { label: 'Al menos una mayúscula', met: /[A-Z]/.test(newPassword.value) },
  { label: 'Al menos una minúscula', met: /[a-z]/.test(newPassword.value) },
  { label: 'Al menos un número', met: /[0-9]/.test(newPassword.value) },
  { label: 'Al menos un carácter especial', met: /[!"#$%&/=.\-*;]/.test(newPassword.value) },
]);

const passwordRules = [
  val => !!val || 'Requerido',
  val => val.length >= 8 || 'Mínimo 8 caracteres',
  val => /[A-Z]/.test(val) || 'Debe contener una mayúscula',
  val => /[a-z]/.test(val) || 'Debe contener una minúscula',
  val => /[0-9]/.test(val) || 'Debe contener un número',
  val => /[!"#$%&/=.\-*;]/.test(val) || 'Debe contener un carácter especial',
];

const closeRecoveryDialog = () => {
  showRecoveryDialog.value = false;
  recoveryStep.value = 1;
  recoveryEmail.value = "";
  recoveryCode.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  resetToken.value = "";
  accountSuspended.value = false;
  recoveryLoading.value = false;
};

// Paso 1: Solicitar código
const handleRequestReset = async () => {
  if (!recoveryEmail.value || !validateEmail(recoveryEmail.value)) {
    Notify.create({ message: "Ingrese un correo electrónico válido.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  recoveryLoading.value = true;
  try {
    const response = await axios.post(`${authApiUrl}/request-reset`, {
      email: recoveryEmail.value
    });

    if (response.data.attemptsLeft !== undefined && response.data.attemptsLeft <= 1) {
      Notify.create({
        message: `Atención: le quedan ${response.data.attemptsLeft} intento(s) antes de que su cuenta sea suspendida.`,
        color: "warning", position: "top", timeout: 5000
      });
    }

    Notify.create({ message: response.data.message, color: "positive", position: "top", timeout: 4000 });
    recoveryStep.value = 2;
  } catch (error) {
    const data = error.response?.data;
    if (data?.suspended) {
      accountSuspended.value = true;
      adminContactEmail.value = data.adminContact || 'recam@gmail.com';
    } else {
      Notify.create({ message: data?.error || "Error al enviar el código.", color: "negative", position: "top", timeout: 4000 });
    }
  } finally {
    recoveryLoading.value = false;
  }
};

// Paso 2: Verificar código
const handleVerifyCode = async () => {
  if (!recoveryCode.value || recoveryCode.value.length !== 6) {
    Notify.create({ message: "Ingrese el código de 6 dígitos.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  recoveryLoading.value = true;
  try {
    const response = await axios.post(`${authApiUrl}/verify-reset-code`, {
      email: recoveryEmail.value,
      code: recoveryCode.value
    });

    resetToken.value = response.data.resetToken;
    Notify.create({ message: "Código verificado correctamente.", color: "positive", position: "top", timeout: 3000 });
    recoveryStep.value = 3;
  } catch (error) {
    const data = error.response?.data;
    if (data?.suspended) {
      accountSuspended.value = true;
      adminContactEmail.value = data.adminContact || 'recam@gmail.com';
    } else {
      Notify.create({ message: data?.error || "Código inválido.", color: "negative", position: "top", timeout: 4000 });
    }
  } finally {
    recoveryLoading.value = false;
  }
};

// Paso 3: Cambiar contraseña
const handleResetPassword = async () => {
  // Validar que todos los requisitos se cumplan
  const allMet = passwordRequirements.value.every(r => r.met);
  if (!allMet) {
    Notify.create({ message: "La contraseña no cumple todos los requisitos.", color: "negative", position: "top", timeout: 3000 });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    Notify.create({ message: "Las contraseñas no coinciden.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  recoveryLoading.value = true;
  try {
    const response = await axios.post(`${authApiUrl}/reset-password`, {
      resetToken: resetToken.value,
      newPassword: newPassword.value
    });

    Notify.create({ message: response.data.message, color: "positive", position: "top", timeout: 5000, icon: "check_circle" });
    closeRecoveryDialog();
  } catch (error) {
    const data = error.response?.data;
    const message = data?.details ? data.details.join('. ') : data?.error || "Error al cambiar la contraseña.";
    Notify.create({ message, color: "negative", position: "top", timeout: 5000 });
  } finally {
    recoveryLoading.value = false;
  }
};
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

.login-box {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 300px;
  text-align: center;
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

  .login-box {
    width: 100%;
    max-width: 300px;
  }
}
</style>
