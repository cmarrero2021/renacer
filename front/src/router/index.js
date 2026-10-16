import { createRouter, createWebHistory } from "vue-router";
import { LocalStorage } from "quasar";
import routes from "./routes";

// El rol "Usuario" se maneja por ID (no por nombre)
const USUARIO_ROLE_ID = 2;
const isUsuarioRole = () => {
  const roleId = Number(LocalStorage.getItem("roleId"));
  return Number.isFinite(roleId) && roleId === USUARIO_ROLE_ID;
};

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const isAuthenticated = LocalStorage.getItem("token");

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    return next(
      isUsuarioRole() ? "/admin/centros" : "/admin"
    );
  }

  // El rol Usuario nunca ve la página Inicio
  if (isAuthenticated && to.path === "/admin" && isUsuarioRole()) {
    return next("/admin/centros");
  }

  next();
});

export default router;
