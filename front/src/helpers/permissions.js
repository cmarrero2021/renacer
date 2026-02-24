import { LocalStorage } from "quasar";

export const hasPermission = (permissionName) => {
  const permissions = LocalStorage.getItem("userPermissions") || [];
  return permissions.some((p) => p.name === permissionName);
};

export const getPermissions = () => {
  return LocalStorage.getItem("userPermissions") || [];
};
