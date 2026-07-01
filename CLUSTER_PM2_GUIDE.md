# Guía de Cluster PM2 + Ajuste de Pools PostgreSQL — RENACER

## Índice
1. [Arquitectura actual](#1-arquitectura-actual)
2. [Qué es PM2 Cluster Mode](#2-qué-es-pm2-cluster-mode)
3. [Impacto en cada capa](#3-impacto-en-cada-capa)
4. [Paso 1: Calcular capacidad del servidor](#4-paso-1-cuántas-instancias-usar)
5. [Paso 2: Modificar ecosystem.config.js](#5-paso-2-modificar-ecosystemconfigjs)
6. [Paso 3: Ajustar pools de PostgreSQL](#6-paso-3-ajustar-los-pools-de-postgresql)
7. [Paso 4: WebSocket y pg_notify](#7-paso-4-websocket--pg_notify-en-cluster)
8. [Paso 5: Sticky sessions con Nginx](#8-paso-5-sticky-sessions-en-nginx)
9. [Paso 6: Probar en desarrollo (Windows)](#9-paso-6-probar-en-desarrollo-windows)
10. [Paso 7: Desplegar en producción (Debian)](#10-paso-7-desplegar-en-debian)
11. [Script de comando único](#11-script-de-comando-único)
12. [Rollback](#12-rollback)
13. [Monitorización post-despliegue](#13-monitorización-post-despliegue)

---

## 1. Arquitectura actual

```
┌──────────────────────────────────────────────┐
│              Servidor 192.168.0.32           │
│                                              │
│  ┌─────────────┐      ┌────────────────┐     │
│  │ auth-service │      │ analytics-svc  │     │
│  │ (1 proceso)  │      │ (1 proceso)    │     │
│  │ Puerto 4110  │      │ Puerto 4120    │     │
│  │ Pool PG: 50  │      │ Pool PG: 50    │     │
│  └──────┬───────┘      └───────┬────────┘     │
│         │                      │              │
│         └──────────┬───────────┘              │
│                    │                          │
│            PostgreSQL (5432)                  │
│            max_connections = 100 (default)    │
└──────────────────────────────────────────────┘
```

**Problemas identificados:**
- Un solo proceso por servicio: si una request bloquea el event loop (cálculo pesado, query lenta), **todos** los usuarios esperan.
- Los 4 núcleos de CPU del servidor están infrautilizados: Node.js solo usa 1.
- Pool de PostgreSQL sobredimensionado: max=50 para un solo proceso es excesivo.

---

## 2. Qué es PM2 Cluster Mode

PM2 Cluster Mode usa el módulo `cluster` de Node.js internamente. Crea **N réplicas** de tu proceso, todas escuchando en el **mismo puerto**. El SO distribuye las conexiones entrantes entre ellas (round-robin).

```
Sin cluster:                    Con cluster (4 instancias):
┌──────────────┐                ┌──────────────┐
│  auth:4110   │                │  pm2:4110    │  ← PM2 abre el puerto
│  (1 proc)    │                │  │   │   │   │     y reenvía a workers
│  CPU: 25%    │                ├──┴───┴───┴───┤
│  Mem: 120MB  │                │ W1  W2  W3  W4│  ← 4 procesos hijos
└──────────────┘                │ cpu  cpu cpu cpu│
                                │ 25%  25%  25% 25%│
                                │ mem  mem mem mem│
                                │ 35MB 35MB 35MB 35MB│
                                └────────────────┘
```

Cada worker es un proceso Node.js independiente:
- Tiene su propio event loop
- Su propio heap de memoria (~30-40 MB base + lo que consuma tu app)
- Su propio pool de conexiones a PostgreSQL
- Su propia copia del Map `userConnections` (importante para WebSocket)

PM2 se encarga de:
- Abrir el puerto real y distribuir (`cluster.schedulingPolicy`)
- Reiniciar workers individuales que fallen (sin downtime)
- Graceful shutdown: espera a que las peticiones en curso terminen antes de matar un worker
- `pm2 reload` para actualizar sin downtime (reinicia workers uno por uno)

---

## 3. Impacto en cada capa

| Capa | Sin cluster | Con cluster (ej: 4 workers) | ¿Cambio necesario? |
|---|---|---|---|
| **CPU** | 1 núcleo usado, 3 inactivos | Los 4 núcleos trabajando | Ninguno |
| **Memoria RAM** | auth: ~120 MB, analytics: ~80 MB | auth: ~480 MB, analytics: ~320 MB | Asegurar RAM suficiente (~1 GB adicional) |
| **PostgreSQL** | auth: pool 50, analytics: pool 50 | auth: pool 50×4 = 200, analytics: pool 50×4 = 200 | **Sí**: reducir pool por worker |
| **WebSocket** | Un Map `userConnections` global | Cada worker tiene su Map | **Sí**: sticky sessions |
| **pg_notify** | Un solo listener | Cada worker crea su listener | No crítico (ineficiente pero funcional) |
| **JWT (sesiones)** | Sin estado (JWT) → no hay problema | Sin estado → no hay problema | Ninguno |

---

## 4. Paso 1: Cuántas instancias usar

### Regla general

```
instancias = min(núcleos_CPU, conexiones_simultáneas_esperadas / 100)
```

### Para RENACER

Escenario típico: servidor con **4 núcleos** en Debian 12.

| Escenario | auth-service | analytics-service | Conexiones PG totales (pool=10 por worker) |
|---|---|---|---|
| **Mínimo** | 2 | 2 | 40 |
| **Recomendado** | 3 | 2 | 50 |
| **Máximo** | 4 | 4 | 80 |

**Recomendación inicial:**
- `auth-service`: **3 instancias** (más carga por WebSocket + CRUD)
- `analytics-service`: **2 instancias** (consultas pesadas pero menos concurrentes)

Total: 5 workers × ~60 MB ≈ 300 MB adicionales en RAM.

> **Nota sobre WebSocket:** Con sticky sessions, las conexiones WebSocket se distribuyen entre los workers. Cada worker maneja ~1/3 de las conexiones totales. El límite real no es el número de workers, sino el número de conexiones simultáneas que PostgreSQL puede manejar y el ancho de banda de red.

---

## 5. Paso 2: Modificar ecosystem.config.js

### Cambiar de fork a cluster

**Antes** (`ecosystem.config.js` actual):
```javascript
module.exports = {
  apps: [
    {
      name: "auth-service",
      cwd: "/var/www/html/renacer/auth",
      script: "src/index.js",
      watch: false,
      env_development: { NODE_ENV: "development", PORT: 4110 },
      env_production: { NODE_ENV: "production", PORT: 4110 }
    },
    {
      name: "analytics-service",
      cwd: "/var/www/html/renacer/analytics",
      script: "src/index.js",
      watch: false,
      env_development: { NODE_ENV: "development", PORT: 4120 },
      env_production: { NODE_ENV: "production", PORT: 4120 }
    }
  ]
};
```

**Después**:
```javascript
module.exports = {
  apps: [
    {
      name: "auth-service",
      cwd: "/var/www/html/renacer/auth",
      script: "src/index.js",
      exec_mode: "cluster",
      instances: 3,
      max_memory_restart: "300M",
      env_development: { NODE_ENV: "development", PORT: 4110 },
      env_production: { NODE_ENV: "production", PORT: 4110 }
    },
    {
      name: "analytics-service",
      cwd: "/var/www/html/renacer/analytics",
      script: "src/index.js",
      exec_mode: "cluster",
      instances: 2,
      max_memory_restart: "250M",
      env_development: { NODE_ENV: "development", PORT: 4120 },
      env_production: { NODE_ENV: "production", PORT: 4120 }
    }
  ]
};
```

### Explicación de los nuevos campos

| Campo | Valor | Explicación |
|---|---|---|
| `exec_mode: "cluster"` | — | Activa el modo cluster en lugar de fork |
| `instances: 3` | Número fijo | Usa 3 workers. Alternativas: `"max"` (todos los núcleos), `0` (misma cantidad que núcleos) |
| `max_memory_restart: "300M"` | 300 MB | Si un worker supera este límite, PM2 lo reinicia automáticamente |

### Consideraciones sobre `instances: "max"`

- `"max"` en Debian usa `os.cpus().length` (todos los núcleos)
- En Windows a veces reporta hyperthreading como núcleos separados
- **Problema:** si usas `"max"` en un servidor con 4 núcleos y 2 servicios, tendrías 8 workers totales compitiendo por CPU con el sistema operativo y PostgreSQL
- **Recomendación:** usar valores fijos (3 + 2) en lugar de `"max"`

---

## 6. Paso 3: Ajustar los pools de PostgreSQL

### Fórmula de dimensionamiento

```
pool_max_por_worker = max_connections_postgresql / (total_workers + conexiones_administrativas)
```

Para un servidor Debian típico: `max_connections = 100` (configurable en `postgresql.conf`).

```
pool_max = 100 / (3 + 2 + 2) = 100 / 7 ≈ 14
```

Donde:
- 3 = workers de auth-service
- 2 = workers de analytics-service
- 2 = conexiones administrativas (pgAdmin, backups, etc.)

**Valor seguro:** `max = 10` por worker.

### Cambiar variables de entorno

Actualmente `db.js` usa defaults con valores pensados para un solo worker:

```javascript
// auth/src/db.js y analytics/src/db.js
max: parseInt(process.env.DB_POOL_MAX, 10) || 50,     // ← 50 por defecto
min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
```

Hay dos opciones:

#### Opción A: Cambiar los defaults en db.js (más seguro, recomendado)

**auth/src/db.js:**
```javascript
max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
```

**analytics/src/db.js:**
```javascript
max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
```

#### Opción B: Agregar a los .env de producción (más flexible)

**auth/.env.production y analytics/.env.production:**
```ini
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECT_TIMEOUT=5000
DB_POOL_MAX_USES=10000
```

### Verificar/ajustar PostgreSQL en Debian

Conéctate al servidor y verifica:

```bash
# Ver configuración actual
sudo -u postgres psql -c "SHOW max_connections;" -d renacer

# Cuántas conexiones hay ahora (antes del cambio)
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='renacer';" -d renacer

# Si necesitas aumentar max_connections:
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Busca y modifica:
```ini
max_connections = 150          # Suficiente para 5 workers × 10 + margen
shared_buffers = 512MB         # 25% de la RAM disponible
```

Reinicia PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Resumen de conexiones final

| Servicio | Workers | Pool/worker | Conexiones totales |
|---|---|---|---|
| auth-service | 3 | max=10 | 30 |
| analytics-service | 2 | max=10 | 20 |
| **Total app** | **5** | — | **50** |
| Sistema + admin | — | — | ~5 |
| **Total PostgreSQL** | — | — | **~55** |

Con `max_connections = 100` en PostgreSQL, tienes ~45 conexiones de margen.

---

## 7. Paso 4: WebSocket + pg_notify en Cluster

### El problema

El WebSocket de `auth-service` guarda conexiones de usuario en un **Map en memoria** (`userConnections`):

```javascript
// websocket.js - línea 7
const userConnections = new Map();  // ← Esto NO se comparte entre workers
```

En cluster mode, cada worker tiene su propio `userConnections`. Si el usuario A se conecta al worker 1, y el worker 2 recibe una notificación de `pg_notify`, **no encontrará** al usuario A en su Map.

### Sticky Sessions: la solución

Las sticky sessions (afinidad de sesión) aseguran que un cliente siempre sea dirigido al mismo worker. PM2 no tiene sticky sessions nativas, pero puedes implementarlas con **Nginx** usando `ip_hash`.

#### Modificar el bloque de WebSocket en Nginx

En el proxy inverso (192.168.0.11), archivo `/etc/nginx/conf.d/renacer.conf`, cambia:

```nginx
# ANTES: WebSocket sin sticky
location /ws {
    proxy_pass http://192.168.0.32:4110;
    ...
}

# DESPUÉS: WebSocket con sticky sessions via ip_hash
upstream auth_backend {
    ip_hash;                          # ← Asegura que el mismo IP siempre va al mismo worker
    server 192.168.0.32:4110;
}

location /ws {
    proxy_pass http://auth_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_connect_timeout 86400s;
    proxy_buffering off;
}
```

> **Importante:** `ip_hash` funciona si los usuarios tienen IPs públicas distintas. Si muchos usuarios están detrás de la misma IP (NAT corporativo), todos caerían en el mismo worker. Para ese escenario, necesitarías usar `sticky` de Nginx Plus o un enfoque basado en cookie.

#### Alternativa: sticky con cookie (Nginx Plus no necesario)

Si no tienes Nginx Plus, puedes usar `hash $cookie_connect_sid` o un hash personalizado. Pero para RENACER (usuarios administrativos, no masivos), `ip_hash` es suficiente.

#### Impacto de pg_notify duplicado

Cada worker crea su propio listener `LISTEN permissions_changed`. Cuando se emite un NOTIFY:

1. **Todos los workers** reciben el evento
2. **Todos los workers** ejecutan `getUserPermissions(userId)` contra PostgreSQL
3. **Solo el worker que tiene la conexión WebSocket** del usuario encuentra el userId en su `userConnections` Map
4. Los otros workers ejecutan la query pero no encuentran al usuario → query desperdiciada

**Impacto:** ineficiente pero no dañino. Cada NOTIFY resulta en (workers-1) queries innecesarias a PostgreSQL. Si las notificaciones son infrecuentes (solo cuando un admin cambia permisos), es irrelevante.

**Solución futura (si se necesita optimizar):** Usar Redis como pub/sub centralizado en lugar de pg_notify, pero eso agrega otra dependencia.

---

## 8. Paso 5: Sticky sessions en Nginx

### Para el proxy inverso (192.168.0.11)

Archivo: `/etc/nginx/conf.d/renacer.conf`

```nginx
upstream auth_backend {
    ip_hash;
    server 192.168.0.32:4110;
}

upstream analytics_backend {
    ip_hash;
    server 192.168.0.32:4120;
}

# HTTP - Redirigir a HTTPS
server {
    listen 80;
    server_name renacer.minaamp.gob.ve;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl;
    server_name renacer.minaamp.gob.ve;

    ssl_certificate /etc/letsencrypt/live/renacer.minaamp.gob.ve/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/renacer.minaamp.gob.ve/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API Auth
    location /auth/ {
        proxy_pass http://auth_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # API Analytics
    location /analytics/ {
        proxy_pass http://analytics_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # WebSocket (con sticky gracias a upstream auth_backend con ip_hash)
    location /ws {
        proxy_pass http://auth_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 86400s;
        proxy_buffering off;
    }

    # Frontend SPA
    location / {
        proxy_pass http://192.168.0.32:9110;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    access_log /var/log/nginx/renacer_access.log;
    error_log /var/log/nginx/renacer_error.log;
}
```

> **Diferencia clave:** Usamos `upstream` blocks con `ip_hash` en lugar de `proxy_pass` directo a IP:puerto. Esto asegura que requests HTTP + WebSocket del mismo cliente siempre vayan al mismo worker.

---

## 9. Paso 6: Probar en desarrollo (Windows)

### Prerrequisitos
- Node.js 18+ instalado
- PM2 instalado global: `npm install -g pm2`
- PostgreSQL corriendo localmente

### Pasos

1. **Crear archivo `.env.development` para pruebas**

Crea `auth/.env.cluster-dev`:
```ini
APP_NAME=RENACER Cluster Dev
PORT=4110
DB_USER=postgres
DB_HOST=localhost
DB_NAME=renacer
DB_PASSWORD=postgres
DB_PORT=5432
JWT_SECRET=dev-secret-123
DB_POOL_MAX=5
DB_POOL_MIN=1
ALLOWED_ORIGINS=http://localhost:9110,http://localhost:4110
```

2. **Crear ecosystem.config.dev.js**

En la raíz del proyecto, crea `ecosystem.config.dev.js`:
```javascript
module.exports = {
  apps: [
    {
      name: "auth-service-dev",
      cwd: "D:\\proyectos\\renacer\\auth",
      script: "src/index.js",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "development",
        PORT: 4110
      }
    },
    {
      name: "analytics-service-dev",
      cwd: "D:\\proyectos\\renacer\\analytics",
      script: "src/index.js",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "development",
        PORT: 4120
      }
    }
  ]
};
```

3. **Iniciar en cluster**

```powershell
cd D:\proyectos\renacer
pm2 start ecosystem.config.dev.js
pm2 status
```

4. **Verificar workers**

```powershell
pm2 status
# Deberías ver algo como:
# ┌─────┬───────────────────┬──────────┬──────┬───────────┐
# │ id  │ name              │ mode     │ ↺    │ status    │
# ├─────┼───────────────────┼──────────┼──────┼───────────┤
# │ 0   │ auth-service-dev  │ cluster  │ 0    │ online    │
# │ 1   │ auth-service-dev  │ cluster  │ 0    │ online    │
# │ 2   │ analytics-servic  │ cluster  │ 0    │ online    │
# │ 3   │ analytics-servic  │ cluster  │ 0    │ online    │
# └─────┴───────────────────┴──────────┴──────┴───────────┘
```

5. **Probar balanceo**

```powershell
# Hacer 10 requests y ver qué worker responde cada una
for ($i=0; $i -lt 10; $i++) {
    Invoke-RestMethod -Uri "http://localhost:4110/auth/list-endpoints" -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 100
}

# Ver los logs para confirmar que distintos workers responden
pm2 logs auth-service-dev --lines 5
```

6. **Probar WebSocket**

Abre el frontend en `http://localhost:9110` e inicia sesión. En los logs de PM2:
```powershell
pm2 logs auth-service-dev
# Deberías ver que la conexión WebSocket se asigna a un worker específico
```

7. **Probar fallo de un worker**

```powershell
# Matar un worker específico (PM2 lo reiniciará automáticamente)
pm2 stop 0

# Verificar que el otro worker sigue respondiendo
Invoke-RestMethod -Uri "http://localhost:4110/auth/list-endpoints"

# El worker detenido se reinicia automáticamente
Start-Sleep 3
pm2 status
```

8. **Detener prueba**

```powershell
pm2 delete ecosystem.config.dev.js
```

### Limitaciones de la prueba en Windows

- `ip_hash` sticky sessions no aplica porque no hay Nginx en desarrollo
- Las conexiones WebSocket pueden saltar entre workers en Windows (no crítico para pruebas funcionales)
- Los pools reducidos (max=5) evitan saturar tu PostgreSQL local

---

## 10. Paso 7: Desplegar en Debian

### Orden de ejecución recomendado

```bash
# 1. Conectarse al servidor de aplicaciones
ssh user@192.168.0.32

# 2. Navegar al proyecto
cd /var/www/html/renacer

# 3. RESPALDAR configuración actual
cp ecosystem.config.js ecosystem.config.js.backup

# 4. ACTUALIZAR ecosystem.config.js con los cambios de cluster
#    (editar manualmente con nano o subir el archivo actualizado)
nano ecosystem.config.js
#    Pega el contenido del paso 5

# 5. ACTUALIZAR db.js para reducir pool defaults
cd auth/src
nano db.js
#    Cambia "|| 50" por "|| 10" y "|| 5" por "|| 2"

cd ../../analytics/src
nano db.js
#    Mismo cambio

cd ../..

# 6. AjustAR max_connections en PostgreSQL si es necesario
sudo -u postgres psql -c "SHOW max_connections;"
#    Si es < 100, aumentarlo en postgresql.conf
sudo nano /etc/postgresql/16/main/postgresql.conf
#    max_connections = 150

# 7. Reiniciar PostgreSQL (solo si cambiaste max_connections)
sudo systemctl restart postgresql

# 8. RECARGAR apps con PM2 en cluster mode
pm2 reload ecosystem.config.js --env production

# 9. Verificar que todo esté bien
pm2 status
#    Deberías ver 5 procesos totales (3 auth + 2 analytics)
#    Todos en modo "cluster", estado "online"

pm2 logs --lines 20
#    Revisar que no haya errores de conexión a PostgreSQL

# 10. Actualizar Nginx en el proxy (192.168.0.11)
#     Conectarse al proxy y modificar renacer.conf
ssh user@192.168.0.11
sudo nano /etc/nginx/conf.d/renacer.conf
#    Pega la configuración con upstream + ip_hash del paso 8
sudo nginx -t
sudo systemctl reload nginx
```

### Comando para verificar que el cluster funciona

```bash
# Ver workers activos
pm2 status

# Ver uso de CPU (todos los workers deberían distribuirse entre núcleos)
htop

# Ver conexiones PostgreSQL activas
sudo -u postgres psql -d renacer -c "
SELECT client_addr, count(*) as connections
FROM pg_stat_activity
WHERE datname = 'renacer'
  AND application_name LIKE '%node%'
GROUP BY client_addr
ORDER BY connections DESC;
"
# Deberías ver múltiples conexiones desde 127.0.0.1
```

---

## 11. Script de comando único

Para facilitar el despliegue futuro, puedes crear `scripts/deploy-cluster.sh` en el servidor:

```bash
#!/bin/bash
# scripts/deploy-cluster.sh
# Ejecutar en 192.168.0.32 después de actualizar el código

set -e

echo "=== Desplegando RENACER en modo cluster ==="

cd /var/www/html/renacer

# 1. Instalar dependencias si cambió package.json
cd auth && npm install --production && cd ..
cd analytics && npm install --production && cd ..

# 2. Reconstruir frontend si cambió
# cd front && npm install && npx quasar build && cd ..

# 3. Recargar con PM2 (zero-downtime si hay suficientes workers)
pm2 reload ecosystem.config.js --env production

# 4. Guardar configuración
pm2 save

# 5. Verificar
echo "=== Estado ==="
pm2 status

echo "=== Últimos logs ==="
pm2 logs --lines 10

echo "=== Listo ==="
```

Hacerlo ejecutable:
```bash
chmod +x /var/www/html/renacer/scripts/deploy-cluster.sh
```

---

## 12. Rollback

Si algo sale mal, revierte en orden inverso:

```bash
# 1. Restaurar ecosystem.config.js original
cp ecosystem.config.js.backup ecosystem.config.js

# 2. Recargar en fork mode
pm2 reload ecosystem.config.js --env production

# 3. Revertir cambios de Nginx (quitar upstream y volver a proxy_pass directo)
#    En 192.168.0.11, restaurar la configuración original de renacer.conf
sudo nginx -t && sudo systemctl reload nginx

# 4. Si ajustaste PostgreSQL, revertir max_connections
sudo nano /etc/postgresql/16/main/postgresql.conf
#    Restaurar el valor anterior
sudo systemctl restart postgresql
```

---

## 13. Monitorización post-despliegue

### Métricas a observar las primeras 48 horas

```bash
# Uso de CPU (cada worker debería usar ~20-30% en auth, ~15-25% en analytics)
pm2 monit

# Memoria RAM (cada worker auth ~80-120MB, analytics ~60-80MB)
pm2 status

# Conexiones PostgreSQL
watch -n 5 "sudo -u postgres psql -d renacer -c \"
  SELECT count(*) as total_connections
  FROM pg_stat_activity WHERE datname='renacer';
\""

# Requests por segundo (desde el proxy)
# En 192.168.0.11:
sudo tail -f /var/log/nginx/renacer_access.log | cut -d' ' -f1,4,7 | uniq -c
```

### Señales de alerta

| Síntoma | Causa probable | Solución |
|---|---|---|
| Un worker se reinicia constantemente | Memory leak o pico de tráfico | Aumentar `max_memory_restart` o reducir `instances` |
| Muchas conexiones PostgreSQL en idle | Pool sobredimensionado | Reducir `DB_POOL_MAX` en `.env.production` |
| WebSocket se desconecta frecuentemente | Sticky sessions mal configuradas | Revisar `ip_hash` en Nginx |
| CPU al 100% en todos los workers | Pool excesivo de workers | Reducir `instances` en `ecosystem.config.js` |
| Algunos endpoints fallan intermitentemente | Worker murió y PM2 lo reinició | Revisar logs con `pm2 logs --err` |

### Comando de diagnóstico rápido

```bash
# Ver todo en un solo vistazo
echo "=== PM2 ===" && pm2 status && echo "" && \
echo "=== PostgreSQL ===" && sudo -u postgres psql -d renacer -c "
  SELECT state, count(*) FROM pg_stat_activity
  WHERE datname='renacer' GROUP BY state;
" && echo "" && \
echo "=== Memoria ===" && free -h && echo "" && \
echo "=== CPU (últimos 5s) ===" && top -bn1 | head -5
```

---

## 14. Resumen de archivos modificados

| Archivo | Cambio | ¿Obligatorio? |
|---|---|---|
| `ecosystem.config.js` | Agregar `exec_mode: "cluster"` e `instances` | Sí |
| `auth/src/db.js` | Default `max: 50` → `max: 10` | Sí |
| `analytics/src/db.js` | Default `max: 50` → `max: 10` | Sí |
| `/etc/nginx/conf.d/renacer.conf` (proxy) | `upstream` + `ip_hash` para sticky sessions | Sí, para WebSocket |
| `scripts/deploy-cluster.sh` | Nuevo script de despliegue automatizado | Recomendado |
| `ecosystem.config.dev.js` | Nuevo archivo para pruebas locales | Recomendado |

---

## 15. Preguntas frecuentes

### ¿Puedo cambiar el número de instancias sin downtime?

Sí. Con `pm2 reload` (no `restart`), PM2 reinicia los workers uno por uno, esperando que cada uno termine sus requests antes de pasar al siguiente:

```bash
pm2 reload ecosystem.config.js --env production
```

### ¿Qué pasa si un worker falla?

PM2 lo reinicia automáticamente (~1 segundo). Durante ese tiempo, los otros workers siguen atendiendo. El usuario cuya request estaba en el worker fallido recibe un error 502/504 y debe reintentar.

### ¿Debo usar `max_memory_restart`?

Sí. Previene memory leaks silenciosos. Si un worker supera el límite, PM2 lo mata y lo reinicia. El valor depende de tu app: mide el consumo base con `pm2 monit` y pon un 50% arriba.

### ¿Puedo tener diferentes cantidades de instancias en desarrollo vs producción?

Sí. Usa el campo `instances` dentro de `env_development` y `env_production`:

```javascript
{
  name: "auth-service",
  exec_mode: "cluster",
  instances: 1,  // default
  env_development: { instances: 2 },
  env_production: { instances: 3 }
}
```

### ¿Cómo sé cuántas instancias están funcionando?

```bash
# Cuenta total de procesos PM2 (incluye todos los servicios)
pm2 status | find /c "online"

# Workers específicos de auth
pm2 status | grep auth
```
