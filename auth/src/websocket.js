const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { Client } = require("pg");

// Map de userId -> Set<WebSocket>
const userConnections = new Map();

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
 */
const startPgListener = async (wss) => {
  const pgClient = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
  });

  const connect = async () => {
    try {
      await pgClient.connect();
      await pgClient.query("LISTEN permissions_changed");
      console.log("🔔 pg_notify: Escuchando canal 'permissions_changed'");

      pgClient.on("notification", async (msg) => {
        try {
          const payload = JSON.parse(msg.payload);
          const { user_ids, reason } = payload;

          console.log(
            `📡 Notificación recibida: ${reason} para usuarios [${user_ids.join(", ")}]`
          );

          // Para cada usuario afectado, enviar permisos actualizados
          for (const userId of user_ids) {
            const connections = userConnections.get(userId);
            if (connections && connections.size > 0) {
              const permissions = await getUserPermissions(userId);
              const role = await getUserRole(userId);

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

              console.log(
                `  ✅ Permisos enviados a usuario ${userId} (${connections.size} conexión(es))`
              );
            }
          }
        } catch (err) {
          console.error("❌ Error procesando notificación pg_notify:", err.message);
        }
      });

      pgClient.on("error", (err) => {
        console.error("❌ Error en cliente pg_notify:", err.message);
        // Intentar reconectar después de 5 segundos
        setTimeout(() => {
          console.log("🔄 Reintentando conexión pg_notify...");
          connect();
        }, 5000);
      });
    } catch (err) {
      console.error("❌ Error conectando pg_notify:", err.message);
      setTimeout(() => {
        console.log("🔄 Reintentando conexión pg_notify...");
        connect();
      }, 5000);
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
  });

  console.log(`🌐 WebSocket server montado en path /ws`);

  return wss;
};

module.exports = { setupWebSocket };
