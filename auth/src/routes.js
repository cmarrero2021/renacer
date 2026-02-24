const express = require("express");
const router = express.Router();
const {
  deleteRevista,
  createUser,
  verifyEmail,
  changePassword,
  listUsers,
  updateUser,
  deleteUser,
  deleteUserPermanently,
  createRole,
  listRoles,
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  listRolesPermissions,
  listUserssPermissions,
  listUserRoles,
  login,
  logout,
  forceLogout,
  prueba,
  uploadPortada,
  updateRevista,
  insertRevista,
  getGlobalSessionTimeout,
  updateGlobalSessionTimeout,
  updateUserSessionTimeout,
  updateRoleSessionTimeout,
  assignPermissionToRole,
  removePermissionFromRole,
  assignPermissionToUser,
  removePermissionFromUser,
  assignRoleToUser,
  removeRoleFromUser,
  updateRole,
  deleteRole,
  testUpload,
  insertRevistaWithUpload,
  getRevista,
  listLoginLogs,
  listAuditLogs,
  getSessionSettings,
  updateSessionSettings
} = require("./controllers");
const { authenticate, authorize, checkBlacklist } = require("./middlewares");

// Endpoint de prueba para upload de archivos
router.post("/test-upload", testUpload);

// Rutas Públicas
router.get("/prueba", prueba);
router.post("/login", login); // Inicio de sesión
router.post("/verify-email", verifyEmail); // Verificación de correo electrónico
router.post("/force-logout", forceLogout); // Cierre forzoso de sesión

// Rutas Protegidas
router.delete("/revistas/:id", authenticate, deleteRevista); // Eliminar revista

router.use(checkBlacklist); // Middleware para verificar tokens en la lista negra

// Sesiones
router.get(
  "/session-settings/global",
  authenticate,
  authorize("get_global_session_settings"),
  getGlobalSessionTimeout
);
router.patch(
  "/session-settings/global",
  authenticate,
  authorize("update_global_session_settings"),
  updateGlobalSessionTimeout
);
router.patch(
  "/users/:userId/session-timeout",
  authenticate,
  authorize("update_user_session_timeout"),
  updateUserSessionTimeout
);
router.patch(
  "/roles/:roleId/session-timeout",
  authenticate,
  authorize("update_role_session_timeout"),
  updateRoleSessionTimeout
);
// Mantenimiento - Sesión
router.get(
  "/maintenance/session",
  authenticate,
  authorize("view_session_settings"),
  getSessionSettings
);
router.put(
  "/maintenance/session",
  authenticate,
  authorize("edit_session_settings"),
  updateSessionSettings
);
// Usuarios
router.post("/users", authenticate, authorize("create_user"), createUser); // Crear usuario (solo administradores)
router.get("/users", authenticate, authorize("list_users"), listUsers); // Listar usuarios
router.put(
  "/users/:userId",
  authenticate,
  authorize("update_user"),
  updateUser
); // Actualizar usuario
router.delete(
  "/users/:userId",
  authenticate,
  authorize("delete_user"),
  deleteUser
); // Borrado lógico
router.delete(
  "/users/:userId/permanent",
  authenticate,
  authorize("delete_user_permanently"),
  deleteUserPermanently
); // Borrado físico

// Cambio de Contraseña
router.post("/change-password", authenticate, changePassword); // Cambiar contraseña

// Logout
router.post("/logout", logout); // Cerrar sesión

// Roles
router.get("/roles", authenticate, authorize("list_roles"), listRoles); // Listar roles
router.post("/roles", authenticate, authorize("create_role"), createRole); // Crear rol
router.put('/roles/:roleId', authenticate, authorize('update_role'), updateRole); // Actualizar rol
router.delete('/roles/:roleId', authenticate, authorize('delete_role'), deleteRole); // Borrado lógico/físico

// Permisos
router.get("/permissions", listPermissions); // Listar permisos
router.post("/permissions", authenticate, authorize("create_permission"), createPermission); // Crear permiso
router.put("/permissions/:permissionId", authenticate, authorize("update_permission"), updatePermission); // Actualizar permiso
router.delete("/permissions/:permissionId", authenticate, authorize("delete_permission"), deletePermission); // Eliminar permiso
router.get("/roles_permissions", listRolesPermissions); // Listar permisos roles
router.get("/users_permissions", listUserssPermissions); // Listar permisos usuarios
router.get("/users_roles", listUserRoles); // Listar roles usuarios

// Asignaciones
router.post('/assign-role', authenticate, authorize('assign_role'), assignRoleToUser); // Asignar rol a usuario
router.post('/remove-role', authenticate, authorize('remove_role'), removeRoleFromUser); // Remover rol de usuario

router.post('/assign-rolepermission', authenticate, authorize('assign_permission'), assignPermissionToRole); // Asignar permiso a rol
router.post('/remove-rolepermission', authenticate, authorize('remove_permission'), removePermissionFromRole); // Remover permiso de rol

router.post('/assign-userpermission', authenticate, authorize('assign_permission'), assignPermissionToUser); // Asignar permiso a usuario
router.post('/remove-userpermission', authenticate, authorize('remove_permission'), removePermissionFromUser); // Remover permiso de usuario

// Mantenedores Revistas (requieren autenticación)
router.post("/upload-portada/:id", authenticate, uploadPortada);
router.get("/revistas/:id", authenticate, getRevista);
router.patch("/revistas/:id", authenticate, updateRevista);
router.post("/revista", authenticate, insertRevista);
router.post("/revista-con-portada", authenticate, insertRevistaWithUpload);

// Logs y auditoria
router.get("/login-logs", authenticate, authorize('view_login_logs'), listLoginLogs); // Listar registros de ingreso
router.get("/audit-logs", authenticate, authorize('view_action_logs'), listAuditLogs); // Listar registros de acciones
module.exports = router;