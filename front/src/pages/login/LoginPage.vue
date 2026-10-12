<template>
  <div class="login-page" :style="{ backgroundImage: `url(${bgImage})` }">
    <div class="header">
      <img alt="Logo" src="img/logo-nobg2.png" class="logo-left" />
      <img alt="Observatorio Nacional de Ciencia, Tecnología e Innovación" src="img/oncti-nobg.png"
        class="logo-right" />
    </div>
    <div class="content-container">
      <div class="login-box">
        <h5>RENACER</h5>

        <!-- Fase 1: Credenciales -->
        <template v-if="!show2FA">
          <h4>Iniciar Sesión</h4>
          <q-input filled outlined v-model="email" label="Correo Electrónico" type="email" @keyup.enter="handleLogin" />

          <q-input filled outlined v-model="password" label="Contraseña" :type="isPasswordVisible ? 'text' : 'password'"
            class="no-uppercase" @keyup.enter="handleLogin">
            <template v-slot:append>
              <q-btn :icon="isPasswordVisible ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
                @click="isPasswordVisible = !isPasswordVisible" />
            </template>
          </q-input>
          <q-btn label="Ingresar" class="q-mt-md" color="primary" @click="handleLogin" :loading="loginLoading" />
          <q-btn flat label="¿Olvidaste tu contraseña?" @click="showRecoveryDialog = true" />
          <q-btn flat label="¿No tienes cuenta? Regístrate" color="primary" class="full-width q-mt-xs"
            icon="person_add" @click="$router.push('/registro')" />
          <q-separator class="q-my-md" />
          <div class="row q-gutter-sm justify-center">
            <q-btn flat label="LEER RIF" color="secondary" icon="badge" @click="leerRIF" :loading="rifLoading" />
            <q-btn flat label="LEER CEDULA" color="primary" icon="credit_card" @click="leerCedula"
              :loading="cedulaLoading" />
          </div>
        </template>

        <!-- Fase 2: Código 2FA -->
        <template v-if="show2FA">
          <h4>Verificación de Código</h4>
          <p class="text-body2 q-mb-sm">Se envió un código de 6 dígitos a su correo electrónico.</p>

          <p class="text-caption text-grey q-mb-md">El código expira en 10 minutos.</p>
          <q-input filled outlined v-model="twoFACode" label="Código de Verificación" mask="######" maxlength="6"
            class="code-input" @keyup.enter="handleVerify2FA">
            <template v-slot:prepend>
              <q-icon name="pin" />
            </template>
          </q-input>
          <q-btn label="Verificar" class="q-mt-md" color="primary" @click="handleVerify2FA" :loading="verifyLoading" />
          <div class="q-mt-sm">
            <q-btn flat dense label="Reenviar código" color="grey" icon="refresh" @click="handleLogin"
              :loading="loginLoading" :disable="loginLoading" />
            <q-btn flat dense label="Volver al login" color="grey" icon="arrow_back" @click="resetToLogin" />
          </div>
          <p v-if="attemptsLeftMsg" class="text-caption text-warning q-mt-sm">{{ attemptsLeftMsg }}</p>
        </template>
      </div>
    </div>
    <!-- Diálogo de recuperación de contraseña -->
    <q-dialog v-model="showRecoveryDialog" persistent>
      <q-card style="min-width: 400px; max-width: 500px;">
        <q-card-section class="bg-primary text-white row items-center">
          <div class="text-h6">
            <q-icon name="lock_reset" class="q-mr-sm" />
            Recuperar Contraseña
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
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
            class="code-input"
            :rules="[val => !!val || 'Requerido', val => val.length === 6 || 'Debe ser de 6 dígitos']">
            <template v-slot:prepend>
              <q-icon name="pin" />
            </template>
          </q-input>
        </q-card-section>

        <!-- Paso 3: Nueva contraseña -->
        <q-card-section v-if="recoveryStep === 3">
          <p class="text-body2 q-mb-md">Ingrese su nueva contraseña.</p>

          <q-input filled v-model="newPassword" label="Nueva Contraseña" :type="showNewPassword ? 'text' : 'password'"
            class="q-mb-sm no-uppercase" :rules="passwordRules">
            <template v-slot:append>
              <q-btn :icon="showNewPassword ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
                @click="showNewPassword = !showNewPassword" />
            </template>
          </q-input>

          <q-input filled v-model="confirmPassword" label="Confirmar Contraseña"
            :type="showConfirmPassword ? 'text' : 'password'" class="no-uppercase"
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
              <q-icon :name="req.met ? 'check_circle' : 'cancel'" :color="req.met ? 'positive' : 'grey-5'"
                size="16px" />
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

    <!-- Diálogo RIF -->
    <q-dialog v-model="showRifDialog" persistent>
      <q-card style="min-width: 500px; max-width: 600px;">
        <q-card-section class="bg-secondary text-white row items-center">
          <div class="text-h6">
            <q-icon name="badge" class="q-mr-sm" />
            Información del RIF
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="rifData">
          <div class="q-pa-md">
            <div class="q-mb-sm">
              <strong>RIF:</strong>
              <span class="q-ml-sm">{{ rifData.rif || 'No encontrado' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Nombre:</strong>
              <span class="q-ml-sm">{{ rifData.nombre || 'No encontrado' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Domicilio Fiscal:</strong>
              <span class="q-ml-sm">{{ rifData.domicilioFiscal || 'No encontrado' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Fecha de Inscripción:</strong>
              <span class="q-ml-sm">{{ rifData.fechaInscripcion || 'No encontrada' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Última Actualización:</strong>
              <span class="q-ml-sm">{{ rifData.fechaUltimaActualizacion || 'No encontrada' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Fecha de Vencimiento:</strong>
              <span class="q-ml-sm">{{ rifData.fechaVencimiento || 'No encontrada' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>N° Comprobante:</strong>
              <span class="q-ml-sm">{{ rifData.comprobante || 'No encontrado' }}</span>
            </div>
            <div class="q-mb-sm">
              <strong>Serial:</strong>
              <span class="q-ml-sm">{{ rifData.serial || 'No encontrado' }}</span>
            </div>
          </div>
        </q-card-section>

        <q-card-section v-else-if="rifLoading">
          <div class="text-center q-pa-md">
            <q-spinner-dots size="50px" color="primary" />
            <p class="q-mt-md">Leyendo RIF...</p>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cerrar" color="grey" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Diálogo Cédula -->
    <q-dialog v-model="showCedulaDialog" persistent>
      <q-card style="min-width: 500px; max-width: 650px;">
        <q-card-section class="bg-primary text-white row items-center">
          <div class="text-h6">
            <q-icon name="credit_card" class="q-mr-sm" />
            Información de la Cédula
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="cedulaLoading">
          <div class="text-center q-pa-md">
            <q-spinner-dots size="50px" color="primary" />
            <p class="q-mt-md">Analizando imagen y extrayendo datos (puede tardar unos segundos)...</p>
          </div>
        </q-card-section>

        <q-card-section v-else-if="cedulaData">
          <!-- Veredicto anti-copia -->
          <q-banner :class="cedulaBannerClass" rounded class="q-mb-md">
            <template v-slot:avatar>
              <q-icon :name="cedulaVerdictIcon" />
            </template>
            <strong>{{ cedulaData.antiCopy.verdict.label }}</strong>
            <div v-for="(r, i) in cedulaData.antiCopy.reasons" :key="i" class="text-caption q-ml-sm">• {{ r }}</div>
          </q-banner>

          <!-- Métricas -->
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-3 text-center">
              <div class="text-caption text-grey">Color</div>
              <div class="text-weight-bold">{{ cedulaData.antiCopy.colorfulness }}</div>
            </div>
            <div class="col-3 text-center">
              <div class="text-caption text-grey">Contraste</div>
              <div class="text-weight-bold">{{ cedulaData.antiCopy.contrast }}</div>
            </div>
            <div class="col-3 text-center">
              <div class="text-caption text-grey">Nitidez</div>
              <div class="text-weight-bold">{{ cedulaData.antiCopy.sharpness }}</div>
            </div>
            <div class="col-3 text-center">
              <div class="text-caption text-grey">% Grises</div>
              <div class="text-weight-bold">{{ cedulaData.antiCopy.grayscalePercent }}%</div>
            </div>
          </div>
          <q-separator class="q-mb-md" />

          <div class="q-mb-sm">
            <strong>Cédula:</strong>
            <span class="q-ml-sm">{{ cedulaData.cedula || 'No encontrada' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Apellidos:</strong>
            <span class="q-ml-sm">{{ cedulaData.apellidos || 'No encontrados' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Nombres:</strong>
            <span class="q-ml-sm">{{ cedulaData.nombres || 'No encontrados' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Fecha de Nacimiento:</strong>
            <span class="q-ml-sm">{{ cedulaData.fechaNacimiento || 'No encontrada' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Lugar de Emisión:</strong>
            <span class="q-ml-sm">{{ cedulaData.lugarEmision || 'No encontrado' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Fecha de Emisión:</strong>
            <span class="q-ml-sm">{{ cedulaData.fechaEmision || 'No encontrada' }}</span>
          </div>
          <div class="q-mb-sm">
            <strong>Fecha de Vencimiento:</strong>
            <span class="q-ml-sm">{{ cedulaData.fechaVencimiento || 'No encontrada' }}</span>
          </div>

          <q-expansion-item label="Texto OCR completo" icon="notes" dense>
            <div class="raw-ocr">{{ cedulaData.rawText }}</div>
          </q-expansion-item>
        </q-card-section>

        <q-card-section v-else>
          <q-banner class="bg-negative text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            {{ cedulaError }}
          </q-banner>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cerrar" color="grey" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { LocalStorage, Notify } from "quasar";
import axios from "axios";

const email = ref("");
const password = ref("");
const isPasswordVisible = ref(false);
const loginLoading = ref(false);
const router = useRouter();
const loginUrl = import.meta.env.VITE_LOGIN_URL;
const bgImage = new URL('/img/centro_adultos_mayores_venezuela.jpg', import.meta.url).href;
const authApiUrl = import.meta.env.VITE_AUTH_API_URL || '/auth';

// ==========================================
// 2FA
// ==========================================
const show2FA = ref(false);
const twoFACode = ref("");
const tempToken = ref("");
const verifyLoading = ref(false);
const attemptsLeftMsg = ref("");

// Validación de email
const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

const resetToLogin = () => {
  show2FA.value = false;
  twoFACode.value = "";
  tempToken.value = "";
  attemptsLeftMsg.value = "";
};

// Login (Fase 1 → enviar código 2FA)
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

  loginLoading.value = true;
  try {
    const response = await axios.post(loginUrl, {
      username: email.value,
      password: password.value,
    }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });

    if (response.data.requires2FA) {
      // Fase 2: mostrar input de código
      tempToken.value = response.data.tempToken;
      twoFACode.value = "";
      attemptsLeftMsg.value = response.data.attemptsLeft <= 1
        ? `Atención: le quedan ${response.data.attemptsLeft} solicitud(es) de código antes de que su cuenta sea suspendida.`
        : "";
      show2FA.value = true;
      Notify.create({ message: response.data.message, color: "positive", position: "top", timeout: 4000, icon: "email" });
    } else if (response.data.message === "Inicio de sesión exitoso.") {
      // Login directo (por si se deshabilita 2FA en el futuro)
      completeLogin(response.data);
    }
  } catch (error) {
    const mensaje = error.response?.data?.error || 'Error de conexión. Intente nuevamente.';
    Notify.create({ message: mensaje, color: "negative", position: "top", timeout: 4000 });
    if (error.response?.data?.suspended) {
      resetToLogin();
    }
  } finally {
    loginLoading.value = false;
  }
};

// Verificar código 2FA (Fase 2)
const handleVerify2FA = async () => {
  if (!twoFACode.value || twoFACode.value.length !== 6) {
    Notify.create({ message: "Ingrese el código de 6 dígitos.", color: "negative", position: "top", timeout: 3000 });
    return;
  }

  verifyLoading.value = true;
  try {
    const response = await axios.post(`${authApiUrl}/verify-2fa`, {
      tempToken: tempToken.value,
      code: twoFACode.value
    });

    if (response.data.message === "Inicio de sesión exitoso.") {
      completeLogin(response.data);
    }
  } catch (error) {
    const data = error.response?.data;
    const mensaje = data?.error || "Error al verificar el código.";
    Notify.create({ message: mensaje, color: "negative", position: "top", timeout: 4000 });

    if (data?.codeInvalidated || data?.expired) {
      // Código invalidado: volver al login para solicitar nuevo
      attemptsLeftMsg.value = "Código invalidado. Presione 'Reenviar código' para solicitar uno nuevo.";
      twoFACode.value = "";
    }
    if (data?.suspended) {
      resetToLogin();
    }
  } finally {
    verifyLoading.value = false;
  }
};

// Completar login exitoso
const completeLogin = (data) => {
  LocalStorage.set('token', data.token);
  LocalStorage.set('permissions', data.permissions);
  LocalStorage.set('role', data.role);
  LocalStorage.set('firstName', data.firstName || '');
  LocalStorage.set('lastName', data.lastName || '');
  LocalStorage.set('userEmail', data.email || email.value);

  Notify.create({ message: "Ingresó correctamente", color: "positive", position: "top", timeout: 3000, icon: "check_circle" });
  router.push("/admin");
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

// ==========================================
// LEER RIF
// ==========================================
const showRifDialog = ref(false);
const rifLoading = ref(false);
const rifData = ref(null);
const rifError = ref("");

const leerRIF = async () => {
  showRifDialog.value = true;
  rifLoading.value = true;
  rifError.value = "";
  rifData.value = null;

  try {
    const response = await axios.get(`${authApiUrl}/read-rif`);
    if (response.data.success) {
      rifData.value = response.data.data;
    } else {
      rifError.value = response.data.error || "Error al leer el RIF";
    }
  } catch (error) {
    rifError.value = error.response?.data?.error || "Error de conexión al leer RIF";
  } finally {
    rifLoading.value = false;
  }
};

// ==========================================
// LEER CEDULA
// ==========================================
const showCedulaDialog = ref(false);
const cedulaLoading = ref(false);
const cedulaData = ref(null);
const cedulaError = ref("");

const cedulaBannerClass = computed(() => {
  const label = cedulaData.value?.antiCopy?.verdict?.label || '';
  if (label.startsWith('ORIGINAL')) return 'bg-positive text-white';
  if (label.startsWith('POSIBLE COPIA')) return 'bg-negative text-white';
  return 'bg-warning text-black';
});

const cedulaVerdictIcon = computed(() => {
  const label = cedulaData.value?.antiCopy?.verdict?.label || '';
  if (label.startsWith('ORIGINAL')) return 'verified';
  if (label.startsWith('POSIBLE COPIA')) return 'content_copy';
  return 'help_outline';
});

const leerCedula = async () => {
  showCedulaDialog.value = true;
  cedulaLoading.value = true;
  cedulaError.value = "";
  cedulaData.value = null;

  try {
    const response = await axios.get(`${authApiUrl}/read-cedula`, { timeout: 120000 });
    if (response.data.success) {
      cedulaData.value = {
        ...response.data.data,
        antiCopy: response.data.antiCopy
      };
    } else {
      cedulaError.value = response.data.error || "Error al leer la cédula";
    }
  } catch (error) {
    cedulaError.value = error.response?.data?.error || "Error de conexión al leer cédula";
  } finally {
    cedulaLoading.value = false;
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
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 120px 20px 40px;
}

.login-box {
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  padding: 32px 28px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 340px;
  max-width: 90vw;
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
}

.raw-ocr {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
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

  .login-box {
    width: 100%;
    max-width: 320px;
    padding: 24px 20px;
  }

  .content-container {
    padding: 90px 16px 32px;
    align-items: flex-start;
  }
}
</style>
