<template>
  <div class="header">
    <img alt="Logo" src="img/logo-nobg1.png" class="logo-left" />
    <img alt="Observatorio Nacional de Ciencia, Tecnología e Innovación" src="img/oncti-nobg.png" class="logo-right" />
  </div>
  <div class="content-container">
    <img alt="Directorio" src="img/directorio1.png" class="directorio-image" />
    <div class="login-box">
      <h5>Directorio de Revistas Científicas</h5>
      <h4>Iniciar Sesión</h4>
      <q-input filled outlined v-model="email" label="Correo Electrónico" type="email" />
      <q-input filled outlined v-model="password" label="Contraseña" :type="isPasswordVisible ? 'text' : 'password'">
        <template v-slot:append>
          <q-btn :icon="isPasswordVisible ? 'visibility' : 'visibility_off'" flat round dense color="grey-7"
            @click="isPasswordVisible = !isPasswordVisible" />
        </template>
      </q-input>
      <q-btn label="Ingresar" class="q-mt-md" color="primary" @click="handleLogin" />
      <q-btn flat label="¿Olvidaste tu contraseña?" @click="recoverPassword" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { LocalStorage, Notify } from "quasar";
import axios from "axios";
const email = ref("");
const password = ref("");
const isPasswordVisible = ref(false);
const router = useRouter();
const loginUrl = import.meta.env.VITE_LOGIN_URL;
const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

const handleLogin = async () => {
  if (!email.value) {
    Notify.create({
      message: "El correo electrónico no puede estar vacío.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  } else if (!validateEmail(email.value)) {
    Notify.create({
      message: "El formato del correo electrónico no es válido.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  }

  if (!password.value) {
    Notify.create({
      message: "La contraseña no puede estar vacía.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return;
  }
  ////////////////////////
  try {

    const response = await axios.post(loginUrl, {
      // email: email.value,
      username: email.value,
      password: password.value,
    }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
    );
    if (response.data.message === "Inicio de sesión exitoso.") {
      // Almacenar token y permisos en LocalStorage (opcional)
      LocalStorage.set('token', response.data.token);
      LocalStorage.set('permissions', response.data.permissions);
      LocalStorage.set('role', response.data.role);

      Notify.create({
        message: "Ingresó correctamente",
        color: "positive",
        position: "top",
        timeout: 3000,
      });
      router.push("/inicio");
      // router.push("/admin");
    } else {
      Notify.create({
        message: "Credenciales inválidas",
        color: "negative",
        position: "top",
        timeout: 3000,
      });
    }
  } catch (error) {
    const mensaje = error == 'AxiosError: Request failed with status code 403'
      ? 'El usuario ya tiene una sesión abierta. Ciérrela e intente de nuevo'
      : 'Error de conexión. Intente nuevamente.';
    Notify.create({
      message: mensaje,
      color: "negative",
      position: "top",
      timeout: 3000,
    });
  }
};

const recoverPassword = () => {
  console.log("Recuperar contraseña");
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

.q-tab__label {
  font-size: 10px !important;
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
