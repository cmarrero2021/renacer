import { ref, onUnmounted } from "vue";
import { LocalStorage, Notify } from "quasar";

const WS_URL = import.meta.env.VITE_WS_URL;

// Estado compartido (singleton entre componentes)
const permissions = ref(LocalStorage.getItem("permissions") || []);
const role = ref(LocalStorage.getItem("role") || "");
const isConnected = ref(false);

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 2000;

/**
 * Composable para manejar la conexión WebSocket de permisos en tiempo real
 */
export function usePermissionsSocket() {
  const connect = () => {
    const token = LocalStorage.getItem("token");
    if (!token || !WS_URL) return;

    // Limpiar conexión anterior si existe
    if (ws) {
      ws.onclose = null; // Evitar reconexión en cierre intencional
      ws.close();
    }

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("🔌 WebSocket conectado");
        isConnected.value = true;
        reconnectAttempts = 0;

        // Enviar token para autenticarse
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "auth_success") {
            console.log("✅ WebSocket autenticado");
          }

          if (data.type === "auth_error") {
            console.error("❌ WebSocket auth error:", data.message);
            ws.close();
          }

          if (data.type === "permissions_updated") {
            console.log("📡 Permisos actualizados recibidos:", data.reason);

            // Actualizar estado reactivo
            permissions.value = data.permissions || [];
            role.value = data.role || "";

            // Persistir en LocalStorage
            LocalStorage.set("permissions", data.permissions || []);
            if (data.role !== undefined) {
              LocalStorage.set("role", data.role || "");
            }

            // Notificar al usuario
            Notify.create({
              message: "Tus permisos han sido actualizados",
              color: "info",
              icon: "sync",
              position: "top-right",
              timeout: 3000,
            });
          }
        } catch (err) {
          // Ignorar mensajes mal formados
        }
      };

      ws.onclose = (event) => {
        console.log(
          `🔌 WebSocket desconectado (code: ${event.code}, reason: ${event.reason})`
        );
        isConnected.value = false;
        ws = null;

        // Reconectar automáticamente si no fue un cierre intencional
        if (event.code !== 4003 && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };
    } catch (err) {
      console.error("❌ Error creando WebSocket:", err);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("⚠️ Máximo de intentos de reconexión alcanzado");
      return;
    }

    // No reconectar si no hay token (usuario no logueado)
    if (!LocalStorage.getItem("token")) return;

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
      30000
    );
    reconnectAttempts++;

    console.log(
      `🔄 Reconectando en ${Math.round(delay / 1000)}s (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };

  const disconnect = () => {
    clearTimeout(reconnectTimer);
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevenir reconexión
    if (ws) {
      ws.onclose = null; // Evitar reconexión al cerrar
      ws.close(1000, "Logout");
      ws = null;
    }
    isConnected.value = false;
  };

  /**
   * Verifica si el usuario tiene un permiso específico
   * Usa el ref reactivo (se actualiza en tiempo real)
   */
  const hasPermission = (permissionName) => {
    return permissions.value.some((p) => p.name === permissionName);
  };

  /**
   * Verifica si el usuario es administrador
   */
  const isAdmin = () => {
    const r = role.value || LocalStorage.getItem("role") || "";
    return ["admin", "administrador", "administrator", "admininstrador"].includes(
      r.toLowerCase()
    );
  };

  /**
   * Sincroniza el estado reactivo desde LocalStorage
   * (llamar después del login)
   */
  const syncFromStorage = () => {
    permissions.value = LocalStorage.getItem("permissions") || [];
    role.value = LocalStorage.getItem("role") || "";
  };

  // Limpiar al desmontar componente
  onUnmounted(() => {
    // No desconectar aquí ya que el estado es compartido
    // Solo desconectar explícitamente en logout
  });

  return {
    permissions,
    role,
    isConnected,
    connect,
    disconnect,
    hasPermission,
    isAdmin,
    syncFromStorage,
  };
}
