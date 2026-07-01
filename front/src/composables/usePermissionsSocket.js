import { shallowRef, onUnmounted } from "vue";
import { LocalStorage, Notify } from "quasar";

const WS_URL = import.meta.env.VITE_WS_URL;

const permissions = shallowRef(LocalStorage.getItem("permissions") || []);
const role = shallowRef(LocalStorage.getItem("role") || "");
const isConnected = shallowRef(false);
const lastUpdated = shallowRef(null);

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 2000;

// ─── Debounce de mensajes ─────────────────────────────────────────────────
let debounceTimer = null;
let pendingUpdate = null;
let lastNotifyTime = 0;

const DEBOUNCE_MS = 500;
const NOTIFY_THROTTLE_MS = 5000;

function applyPendingUpdate() {
  if (!pendingUpdate) return;

  const { newPermissions, newRole, reason } = pendingUpdate;
  pendingUpdate = null;

  // Dedup: si el JSON es idéntico, saltar
  const currentKey = JSON.stringify([permissions.value, role.value]);
  const newKey = JSON.stringify([newPermissions, newRole]);
  if (currentKey === newKey) return;

  permissions.value = newPermissions;
  role.value = newRole;
  lastUpdated.value = Date.now();

  LocalStorage.set("permissions", newPermissions);
  LocalStorage.set("role", newRole);

  // Notify trottled: máximo 1 cada 5s
  const now = Date.now();
  if (now - lastNotifyTime > NOTIFY_THROTTLE_MS) {
    lastNotifyTime = now;
    Notify.create({
      message: reason
        ? `Permisos actualizados: ${reason}`
        : "Tus permisos han sido actualizados",
      color: "info",
      icon: "sync",
      position: "top-right",
      timeout: 3000,
    });
  }
}

function scheduleApply() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyPendingUpdate, DEBOUNCE_MS);
}

// ─── Composable ──────────────────────────────────────────────────────────

export function usePermissionsSocket() {
  const connect = () => {
    const token = LocalStorage.getItem("token");
    if (!token || !WS_URL) return;

    if (ws) {
      ws.onclose = null;
      ws.close();
    }

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        isConnected.value = true;
        reconnectAttempts = 0;
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "auth_success") return;

          if (data.type === "auth_error") {
            ws.close();
            return;
          }

          if (data.type === "permissions_updated") {
            // Acumular en lugar de aplicar inmediatamente
            pendingUpdate = {
              newPermissions: data.permissions || [],
              newRole: data.role ?? role.value,
              reason: data.reason || "",
            };
            scheduleApply();
          }
        } catch (err) {
          // Ignorar mensajes mal formados
        }
      };

      ws.onclose = (event) => {
        isConnected.value = false;
        ws = null;

        if (event.code !== 4003 && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {};
    } catch (err) {
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    if (!LocalStorage.getItem("token")) return;

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
      30000
    );
    reconnectAttempts++;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  };

  const disconnect = () => {
    clearTimeout(reconnectTimer);
    clearTimeout(debounceTimer);
    pendingUpdate = null;
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    if (ws) {
      ws.onclose = null;
      ws.close(1000, "Logout");
      ws = null;
    }
    isConnected.value = false;
  };

  const syncFromStorage = () => {
    permissions.value = LocalStorage.getItem("permissions") || [];
    role.value = LocalStorage.getItem("role") || "";
  };

  const hasPermission = (permissionName) => {
    return permissions.value.some((p) => p.name === permissionName);
  };

  const isAdmin = () => {
    const r = role.value || LocalStorage.getItem("role") || "";
    return ["admin", "administrador", "administrator", "admininstrador"].includes(
      r.toLowerCase()
    );
  };

  onUnmounted(() => {});

  return {
    permissions,
    role,
    isConnected,
    lastUpdated,
    connect,
    disconnect,
    hasPermission,
    isAdmin,
    syncFromStorage,
  };
}
