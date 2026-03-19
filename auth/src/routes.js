const express = require("express");
const router = express.Router();
const {
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
  listLoginLogs,
  listAuditLogs,
  getSessionSettings,
  updateSessionSettings,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  toggleUserStatus,
  verify2FA,
  getCooldownSettings,
  updateCooldownSettings,
  assignUserPassword
} = require("./controllers");
const { authenticate, authorize, checkBlacklist } = require("./middlewares");

// Rutas Públicas
router.get("/prueba", prueba);
router.post("/login", login); // Inicio de sesión
router.post("/verify-email", verifyEmail); // Verificación de correo electrónico
router.post("/force-logout", forceLogout); // Cierre forzoso de sesión
router.post("/verify-2fa", verify2FA); // Verificar código 2FA

// Recuperación de contraseña (públicas)
router.post("/request-reset", requestPasswordReset); // Solicitar código de recuperación
router.post("/verify-reset-code", verifyResetCode); // Verificar código
router.post("/reset-password", resetPassword); // Restablecer contraseña

// Middleware para verificar tokens en la lista negra
router.use(checkBlacklist);

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

// Mantenimiento - Enfriamiento (Cooldown)
router.get(
  "/maintenance/cooldown",
  authenticate,
  authorize("view_attempts_settings"),
  getCooldownSettings
);
router.put(
  "/maintenance/cooldown",
  authenticate,
  authorize("edit_attempts_settings"),
  updateCooldownSettings
);

// Usuarios
router.post("/users", authenticate, authorize("create_user"), createUser);
router.get("/users", authenticate, authorize("list_users"), listUsers);
router.put(
  "/users/:userId",
  authenticate,
  authorize("update_user"),
  updateUser
);
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
router.patch(
  "/users/:userId/status",
  authenticate,
  authorize("update_user"),
  toggleUserStatus
); // Suspender/Reactivar
router.post(
  "/users/:userId/password",
  authenticate,
  authorize("assign_user_password"),
  assignUserPassword
); // Asignar clave (Admin)

// Cambio de Contraseña
router.post("/change-password", authenticate, changePassword);

// Logout
router.post("/logout", logout);

// Roles
router.get("/roles", authenticate, authorize("list_roles"), listRoles);
router.post("/roles", authenticate, authorize("create_role"), createRole);
router.put('/roles/:roleId', authenticate, authorize('update_role'), updateRole);
router.delete('/roles/:roleId', authenticate, authorize('delete_role'), deleteRole);

// Permisos
router.get("/permissions", listPermissions);
router.post("/permissions", authenticate, authorize("create_permission"), createPermission);
router.put("/permissions/:permissionId", authenticate, authorize("update_permission"), updatePermission);
router.delete("/permissions/:permissionId", authenticate, authorize("delete_permission"), deletePermission);
router.get("/roles_permissions", listRolesPermissions);
router.get("/users_permissions", listUserssPermissions);
router.get("/users_roles", listUserRoles);

// Asignaciones
router.post('/assign-role', authenticate, authorize('assign_role'), assignRoleToUser);
router.post('/remove-role', authenticate, authorize('remove_role'), removeRoleFromUser);

router.post('/assign-rolepermission', authenticate, authorize('assign_permission'), assignPermissionToRole);
router.post('/remove-rolepermission', authenticate, authorize('remove_permission'), removePermissionFromRole);

router.post('/assign-userpermission', authenticate, authorize('assign_user_permission'), assignPermissionToUser);
router.post('/remove-userpermission', authenticate, authorize('remove_user_permission'), removePermissionFromUser);

// Logs y auditoría
router.get("/login-logs", authenticate, authorize('view_login_logs'), listLoginLogs);
router.get("/audit-logs", authenticate, authorize('view_action_logs'), listAuditLogs);

module.exports = router;