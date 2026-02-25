const routes = [
  {
    path: "/",
    component: () => import("layouts/InitialLayout.vue"),
    children: [
      {
        path: "",
        redirect: "/login"
      },
      {
        path: "/login",
        component: () => import("pages/login/LoginPage.vue"),
        meta: { requiresGuest: true },
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: false },
    children: [
      {
        path: "",
        component: () => import("pages/DashboardPage.vue"),
      },
      {
        path: "marco-legal",
        component: () => import("pages/MarcoLegalPage.vue"),
      },
      {
        path: "administracion",
        component: () => import("pages/admin/AdminPage.vue"),
      },
      // Rutas de auditoría
      {
        path: "auditoria/ingresos",
        component: () => import("pages/auditoria/LoginLogsPage.vue"),
      },
      {
        path: "auditoria/acciones",
        component: () => import("pages/auditoria/AccionesPage.vue"),
      },
      // Rutas de Mantenimiento
      {
        path: "mantenimiento/sesion",
        component: () => import("pages/admin/maintenance/SessionMaintenancePage.vue"),
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("layouts/InitialLayout.vue"),
  },
];

export default routes;
