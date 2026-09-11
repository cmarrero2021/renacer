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
        component: () => import("pages/dashboard/DynamicDashboardPage.vue"),
      },
      {
        path: "marco-legal",
        component: () => import("pages/MarcoLegalPage.vue"),
      },
      // ── Módulo de Centros ──────────────────────────────────────────────
      {
        path: "centros",
        component: () => import("pages/centros/CentrosListPage.vue"),
        meta: { permission: "list_centros" },
      },
      {
        path: "centros/nuevo",
        component: () => import("pages/centros/CentroFormPage.vue"),
        meta: { permission: "create_centro" },
      },
      {
        path: "centros/:id",
        component: () => import("pages/centros/CentroDetallePage.vue"),
        meta: { permission: "view_centro" },
      },
      {
        path: "centros/:id/editar",
        component: () => import("pages/centros/CentroFormPage.vue"),
        meta: { permission: "edit_centro" },
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
      {
        path: "mantenimiento/enfriamiento",
        component: () => import("pages/admin/maintenance/CooldownMaintenancePage.vue"),
      },
      // Rutas de Catálogos
      {
        path: "catalogos",
        redirect: "/admin/catalogos/tipos_establecimiento",
      },
      {
        path: "catalogos/:catalogo",
        component: () => import("pages/catalogos/CatalogosPage.vue"),
      },

    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("layouts/InitialLayout.vue"),
  },
];

export default routes;
