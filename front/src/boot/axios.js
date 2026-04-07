/*
import { boot } from 'quasar/wrappers'
import axios from 'axios'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({ baseURL: 'https://api.example.com' })

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
*/
import { boot } from "quasar/wrappers";
import axios from "axios";
import { LocalStorage, Notify } from "quasar";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
const authApi = axios.create({ baseURL: import.meta.env.VITE_AUTH_API_URL || '/auth' });
const analyticsApi = axios.create({ baseURL: import.meta.env.VITE_ANALYTICS_API_URL || '/analytics' });

// Función para manejar sesión expirada
const handleSessionExpired = (router) => {
  // Limpiar almacenamiento local
  LocalStorage.remove('token');
  LocalStorage.remove('permissions');
  LocalStorage.remove('role');
  LocalStorage.remove('user');

  // Mostrar notificación
  Notify.create({
    type: 'warning',
    message: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
    position: 'top',
    timeout: 5000,
    icon: 'logout'
  });

  // Redirigir al login
  if (router) {
    router.push('/login');
  } else {
    window.location.href = '/login';
  }
};

// Función recursiva para transformar campos de texto
const transformPayload = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformPayload);

  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Campos que NO deben ser alterados (Passwords y Tokens)
      const lowKey = key.toLowerCase();
      if (lowKey.includes('password') ||
        lowKey.includes('pass') ||
        lowKey.includes('contrasena') ||
        lowKey.includes('contraseña') ||
        lowKey.includes('token') ||
        lowKey.includes('secret') ||
        lowKey.includes('clave') ||
        lowKey.includes('pin') ||
        lowKey.includes('code')) {
        newObj[key] = value;
      }
      // Campos que deben ser MINÚSCULAS o permanecer como están (incluye metadatos técnicos)
      else if (key.toLowerCase().includes('email') ||
        key.toLowerCase().includes('correo') ||
        key.toLowerCase().includes('username') ||
        key.toLowerCase().includes('user') ||
        key.toLowerCase().includes('login') ||
        key.toLowerCase().includes('url') ||
        key.toLowerCase().includes('website') ||
        key.toLowerCase().includes('sitio_web') ||
        ['status', 'type', 'action', 'resource', 'state', 'method', 'mode'].includes(key.toLowerCase())) {
        newObj[key] = value.toLowerCase().trim();
      }
      // Campos que deben ser MAYÚSCULAS
      else {
        newObj[key] = value.toUpperCase().trim();
      }
    } else if (typeof value === 'object') {
      newObj[key] = transformPayload(value);
    } else {
      newObj[key] = value;
    }
  }
  return newObj;
};

export default boot(({ app, router }) => {
  // Interceptor para añadir token automáticamente (request)
  const requestInterceptor = (config) => {
    const token = LocalStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Transformar payload
    if (config.data && !(config.data instanceof FormData)) {
      config.data = transformPayload(config.data);
    }

    return config;
  };

  api.interceptors.request.use(requestInterceptor);
  authApi.interceptors.request.use(requestInterceptor);
  // analyticsApi: solo token, SIN transformPayload (GraphQL es case-sensitive)
  analyticsApi.interceptors.request.use((config) => {
    const token = LocalStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  axios.interceptors.request.use(requestInterceptor);

  // Interceptor para manejar errores de respuesta (response)
  const responseErrorHandler = (error) => {
    if (error.response && error.response.status === 401) {
      // Sesión expirada o no autorizado
      handleSessionExpired(router);
    }
    return Promise.reject(error);
  };

  api.interceptors.response.use(
    (response) => response,
    responseErrorHandler
  );

  authApi.interceptors.response.use(
    (response) => response,
    responseErrorHandler
  );

  analyticsApi.interceptors.response.use(
    (response) => response,
    responseErrorHandler
  );

  axios.interceptors.response.use(
    (response) => response,
    responseErrorHandler
  );

  app.config.globalProperties.$axios = axios;
  app.config.globalProperties.$api = api;
  app.config.globalProperties.$authApi = authApi;
});

export { axios, api, authApi, analyticsApi };
