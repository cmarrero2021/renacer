import { boot } from "quasar/wrappers";
import axios from "axios";
import { LocalStorage } from "quasar";

export default boot(({ app, router }) => {
  // Configurar axios para incluir el token en las peticiones
  axios.interceptors.request.use(
    (config) => {
      const token = LocalStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Manejar errores de autenticación
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        LocalStorage.remove("authToken");
        LocalStorage.remove("userPermissions");
        router.push("/login");
      }
      return Promise.reject(error);
    }
  );
});
