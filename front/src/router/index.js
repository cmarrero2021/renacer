import { createRouter, createWebHistory } from "vue-router";
import { LocalStorage } from "quasar";
import routes from "./routes";

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
    return next("/admin");
  }

  next();
});

export default router;
