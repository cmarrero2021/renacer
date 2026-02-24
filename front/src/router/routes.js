const routes = [
  {
    path: "/",
    component: () => import("layouts/InitialLayout.vue"),
    children: [
      { path: "", component: () => import("pages/IndexPage.vue") },
      {
        path: "/revistas",
        component: () => import("pages/revistas_public/RevistasPage.vue"),
      },
      {
        path: "/estadisticas",
        component: () => import("pages/revistas_public/EstadisticasPage.vue"),
      },
      {
        path: "/login",
        component: () => import("pages/login/LoginPage.vue"),
        meta: { requiresGuest: true },
      },
      {
        path: "/editores",
        component: () => import("pages/revistas_public/ParaEditores.vue"),
        meta: { requiresGuest: true },
      },
      {
        path: "/somos",
        component: () => import("pages/revistas_public/QuienesPage.vue"),
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
        component: () => import("pages/revistas_private/MantenedorPage.vue"),
      },
      {
        path: "test-upload",
        component: () => import("pages/TestUploadPage.vue"),
      },
      {
        path: "administracion",
        component: () => import("pages/admin/AdminPage.vue"),
      },
      // Rutas de mantenedores
      {
        path: "mantenedores/areas-conocimiento",
        component: () => import("pages/mantenedores/AreasConocimientoPage.vue"),
      },
      {
        path: "mantenedores/editoriales",
        component: () => import("pages/mantenedores/EditorialesPage.vue"),
      },
      {
        path: "mantenedores/estados",
        component: () => import("pages/mantenedores/EstadosPage.vue"),
      },
      {
        path: "mantenedores/formatos",
        component: () => import("pages/mantenedores/FormatosPage.vue"),
      },
      {
        path: "mantenedores/idiomas",
        component: () => import("pages/mantenedores/IdiomasPage.vue"),
      },
      {
        path: "mantenedores/indices",
        component: () => import("pages/mantenedores/IndicesPage.vue"),
      },
      {
        path: "mantenedores/periodicidad",
        component: () => import("pages/mantenedores/PeriodicidadPage.vue"),
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
    path: "/inicio",
    component: () => import("layouts/MainLayout.vue"),
    meta: { requiresAuth: false },
    children: [
      {
        path: "",
        component: () => import("pages/revistas_private/InicioPage.vue"),
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    component: () => import("layouts/InitialLayout.vue"),
  },
];

export default routes;
