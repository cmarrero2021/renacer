const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { Client } = require("pg");

// Map de userId -> Set<WebSocket>
const userConnections = new Map();

// Control de concurrencia para evitar saturar el pool de BD
const BATCH_SIZE = 10; // máximo 10 usuarios procesados simultáneamente
const SYNC_COOLDOWN_MS = 30000; // no re-sincronizar usuarios actualizados hace < 30s
const lastUserSync = new Map();

async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function sendToUser(userId, permissions, role, reason) {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) return;

  const message = JSON.stringify({
    type: "permissions_updated",
    permissions,
    role,
    reason,
  });

  for (const ws of connections) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
  lastUserSync.set(userId, Date.now());
}

/**
 * Difunde una actualización de catálogo a todas las conexiones WebSocket activas
 */
function broadcastCatalogUpdate(catalogKey) {
  const message = JSON.stringify({
    type: "catalogs_updated",
    catalog: catalogKey,
    timestamp: Date.now(),
  });

  console.log(`📢 Difundiendo actualización de catálogo '${catalogKey}' a conexiones activas`);

  for (const [userId, connections] of userConnections.entries()) {
    for (const ws of connections) {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    }
  }
}

function processUser(userId) {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) return;

  return Promise.allSettled([
    getUserPermissions(userId),
    getUserRole(userId),
  ]).then(([permResult, roleResult]) => {
    const permissions = permResult.status === "fulfilled" ? permResult.value : [];
    const role = roleResult.status === "fulfilled" ? roleResult.value : null;
    return { userId, permissions, role };
  });
}

// ─── Batch de notificaciones (backend debounce) ───────────────────────────
const BATCH_WINDOW_MS = 200;
const notifyBatch = {
  userIds: new Set(),
  reasons: [],
  timer: null,
};

function flushBatch(wss) {
  if (notifyBatch.userIds.size === 0) return;

  const userIds = [...notifyBatch.userIds];
  const reason = notifyBatch.reasons.filter(Boolean).join("; ");
  notifyBatch.userIds.clear();
  notifyBatch.reasons = [];

  processInBatches(userIds, BATCH_SIZE, processUser).then((results) => {
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { userId, permissions, role } = result.value;
      sendToUser(userId, permissions, role, reason || "Tus permisos han sido actualizados");
    }
  });
}

/**
 * Re-sincroniza el estado de los usuarios conectados
 * después de una reconexión del listener pg_notify.
 * Omite usuarios sincronizados hace menos de SYNC_COOLDOWN_MS.
 */
function syncAllUsers() {
  const now = Date.now();
  const userIds = [...userConnections.keys()].filter((id) => {
    const last = lastUserSync.get(id);
    return !last || now - last > SYNC_COOLDOWN_MS;
  });

  if (userIds.length === 0) return;

  console.log(`🔄 Re-sincronizando permisos para ${userIds.length} usuario(s) conectado(s)`);

  processInBatches(userIds, BATCH_SIZE, processUser).then((results) => {
    let synced = 0;
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { userId, permissions, role } = result.value;
      sendToUser(userId, permissions, role, "Sincronización tras reconexión");
      synced++;
    }
    console.log(`  ✅ ${synced}/${userIds.length} usuario(s) sincronizado(s)`);
  });
}

/**
 * Consulta los permisos actualizados de un usuario
 * (misma query UNION que usa el login)
 */
const getUserPermissions = async (userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT DISTINCT p.name, p.description, p.action, p.resource
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1
      UNION
      SELECT DISTINCT p.name, p.description, p.action, p.resource
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
      ORDER BY resource, action
      `,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
};

/**
 * Consulta el rol actual del usuario
 */
const getUserRole = async (userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.name || null;
  } finally {
    client.release();
  }
};

/**
 * Inicia el listener de PostgreSQL para pg_notify
 * con reconexión segura: sin acumulación de listeners,
 * sin conexiones zombie, con exponential backoff.
 */
const startPgListener = async (wss) => {
  let attempt = 0;
  let connecting = false;

  const connect = async () => {
    if (connecting) return;
    connecting = true;

    attempt++;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);

    const pgClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT, 10),
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    try {
      await pgClient.connect();
      await pgClient.query("LISTEN permissions_changed");
      await pgClient.query("LISTEN catalogs_changed");
      attempt = 0;
      console.log("🔔 pg_notify: Escuchando canales 'permissions_changed' y 'catalogs_changed'");

      // Re-sincronizar estado con la BD para todos los usuarios conectados
      // (recupera cualquier NOTIFY perdido durante la desconexión)
      syncAllUsers();

      pgClient.on("notification", (msg) => {
        try {
          if (msg.channel === "catalogs_changed") {
            let cat = msg.payload;
            try {
              const parsed = JSON.parse(msg.payload);
              cat = parsed.catalog || parsed.table || cat;
            } catch (e) {}
            broadcastCatalogUpdate(cat);
            return;
          }

          const payload = JSON.parse(msg.payload);
          const { user_ids, reason } = payload;

          for (const id of user_ids) {
            notifyBatch.userIds.add(id);
          }
          if (reason) notifyBatch.reasons.push(reason);

          clearTimeout(notifyBatch.timer);
          notifyBatch.timer = setTimeout(() => flushBatch(wss), BATCH_WINDOW_MS);
        } catch (err) {
          console.error("❌ Error procesando notificación pg_notify:", err.message);
        }
      });

      pgClient.on("error", (err) => {
        console.error("❌ Error en cliente pg_notify:", err.message);
        pgClient.end().catch(() => {});
        connecting = false;
        setTimeout(connect, delay);
      });

      pgClient.on("end", () => {
        console.log("🔌 Cliente pg_notify desconectado");
        connecting = false;
      });
    } catch (err) {
      console.error(`❌ Error conectando pg_notify (intento ${attempt}): ${err.message}`);
      pgClient.end().catch(() => {});
      connecting = false;
      setTimeout(connect, delay);
    }
  };

  await connect();
};

/**
 * Configura el servidor WebSocket adjunto al HTTP server
 */
const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let userId = null;
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    console.log(`🔌 Nueva conexión WebSocket desde ${clientIp}`);

    // El cliente tiene 10 segundos para autenticarse
    const authTimeout = setTimeout(() => {
      if (!userId) {
        ws.close(4001, "Timeout de autenticación");
        console.log(`⏰ Conexión WebSocket cerrada por timeout de autenticación`);
      }
    }, 10000);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Mensaje de autenticación
        if (msg.type === "auth" && msg.token) {
          try {
            const decoded = jwt.verify(msg.token, process.env.JWT_SECRET);
            userId = decoded.userId;
            clearTimeout(authTimeout);

            // Registrar conexión
            if (!userConnections.has(userId)) {
              userConnections.set(userId, new Set());
            }
            userConnections.get(userId).add(ws);

            ws.send(
              JSON.stringify({
                type: "auth_success",
                message: "Autenticado correctamente",
              })
            );

            console.log(
              `  ✅ Usuario ${userId} autenticado (${userConnections.get(userId).size} conexión(es) activa(s))`
            );
          } catch (err) {
            ws.send(
              JSON.stringify({
                type: "auth_error",
                message: "Token inválido o expirado",
              })
            );
            ws.close(4003, "Token inválido");
          }
        }
      } catch (err) {
        // Ignorar mensajes mal formados
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (userId && userConnections.has(userId)) {
        userConnections.get(userId).delete(ws);
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);
        }
        console.log(
          `🔌 Usuario ${userId} desconectado (${userConnections.get(userId)?.size || 0} conexión(es) restante(s))`
        );
      }
    });

    ws.on("error", (err) => {
      console.error("❌ Error en WebSocket:", err.message);
    });
  });

  // Iniciar listener de PostgreSQL
  startPgListener(wss);

  // Heartbeat cada 30 segundos para mantener conexiones vivas
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    clearTimeout(notifyBatch.timer);
    notifyBatch.userIds.clear();
    notifyBatch.reasons = [];
  });

  console.log(`🌐 WebSocket server montado en path /ws`);

  return wss;
};

module.exports = { setupWebSocket, broadcastCatalogUpdate };
