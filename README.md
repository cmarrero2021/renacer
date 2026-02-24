# Directorio de Revistas Científicas - ONCTI

Este proyecto es una plataforma completa para la gestión, consulta y visualización de revistas científicas venezolanas. Está compuesto por tres módulos principales: backend de autenticación/API (`auth`), backend público/API y archivos estáticos (`back`), y frontend SPA con Quasar (`front`).

---

## Tabla de Contenidos
- [Directorio de Revistas Científicas - ONCTI](#directorio-de-revistas-científicas---oncti)
  - [Tabla de Contenidos](#tabla-de-contenidos)
  - [Requisitos del Sistema](#requisitos-del-sistema)
  - [Estructura del Proyecto](#estructura-del-proyecto)
  - [Instalación y Configuración de la Base de Datos](#instalación-y-configuración-de-la-base-de-datos)
  - [Configuración de directorio/auth (API y autenticación)](#configuración-de-directorioauth-api-y-autenticación)
  - [Configuración de directorio/back (API pública y archivos estáticos)](#configuración-de-directorioback-api-pública-y-archivos-estáticos)
  - [Configuración de directorio/front (Frontend Quasar)](#configuración-de-directoriofront-frontend-quasar)
  - [Carga de Portadas](#carga-de-portadas)
  - [WebSocket y Notificaciones](#websocket-y-notificaciones)
  - [Variables de Entorno](#variables-de-entorno)
  - [Usuarios Demo y Datos de Prueba](#usuarios-demo-y-datos-de-prueba)
  - [Solución de Problemas Comunes](#solución-de-problemas-comunes)
  - [Ejecución como Servicio (Demonización) con PM2](#ejecución-como-servicio-demonización-con-pm2)
    - [Instalación de PM2 (global)](#instalación-de-pm2-global)
    - [Demonizar el backend de autenticación (`auth`)](#demonizar-el-backend-de-autenticación-auth)
    - [Demonizar el backend público (`back`)](#demonizar-el-backend-público-back)
    - [Comandos útiles de PM2](#comandos-útiles-de-pm2)
  - [Créditos y Licencia](#créditos-y-licencia)

---

## Requisitos del Sistema
- **Sistema operativo recomendado:** Debian 12
- **PostgreSQL:** 17
- **Node.js:** 20
- **Express:** 4.21
- **nginx** (para producción frontend)
- **npm** y **quasar-cli** (para desarrollo frontend)

---

## Estructura del Proyecto
```
directorio/
├── auth/      # Backend de autenticación y API protegida
├── back/      # Backend público, API y archivos estáticos
├── front/     # Frontend SPA Quasar
├── bd/        # Scripts SQL para la base de datos
```

---

## Instalación y Configuración de la Base de Datos
1. **Crear usuario y base de datos en PostgreSQL**
   - Usa credenciales personalizadas (ver archivos `.env` de cada módulo).
2. **Ejecutar el script principal**
   - Solo ejecuta `bd/20250419_api-revistas.sql` para crear tablas, triggers y canales de notificación.
3. **Configura los archivos `.env`**
   - `auth/.env` y `back/.env` deben contener los datos de conexión a la base de datos.

---

## Configuración de directorio/auth (API y autenticación)
1. Instala dependencias:
   ```bash
   cd directorio/auth
   npm install
   ```
2. Configura el archivo `.env` con los datos de conexión a la base de datos y otras variables necesarias.
3. Crea el usuario administrador ejecutando:
   ```bash
   node create-admin.js
   ```
4. Inicia el servidor:
   ```bash
   node src/index.js
   # o para desarrollo
   npx nodemon src/index.js
   ```
5. Endpoints principales:
   - `/auth/login`, `/auth/logout`, `/auth/revistas`, `/auth/users`, etc.
   - Rutas protegidas requieren autenticación y autorización.

---

## Configuración de directorio/back (API pública y archivos estáticos)
1. Instala dependencias:
   ```bash
   cd directorio/back
   npm install
   ```
2. Configura el archivo `.env` con los datos de conexión a la base de datos.
3. Crea manualmente la carpeta para portadas:
   ```bash
   mkdir -p public/portadas
   ```
4. Inicia el servidor:
   ```bash
   node index.js
   # o el comando correspondiente
   ```
5. Explicación de rutas públicas y lógica de Node.js.

---

## Configuración de directorio/front (Frontend Quasar)
1. Instala dependencias:
   ```bash
   cd directorio/front
   npm install
   ```
2. Configura los archivos de entorno:
   - `.env.development` para desarrollo
   - `.env.production` para producción
   - Personaliza las URLs de los endpoints según el entorno
3. Para desarrollo:
   ```bash
   quasar dev
   ```
4. Para producción:
   ```bash
   quasar build
   # El contenido generado en dist/spa debe ser servido por nginx
   ```
5. Ejemplo de configuración de proxy inverso nginx:
   ```nginx
   server {
     listen 80;
     server_name tu_dominio.com;
     root /ruta/a/directorio/front/dist/spa;
     location / {
       try_files $uri $uri/ /index.html;
     }
     location /auth/ {
       proxy_pass http://localhost:3001/auth/;
     }
     location /portadas/ {
       proxy_pass http://localhost:3000/portadas/;
     }
   }
   ```

---

## Carga de Portadas
- Crea manualmente la carpeta `back/public/portadas`.
- El tamaño máximo recomendado para las imágenes es **2 MB**.

---

## WebSocket y Notificaciones
- No es necesario abrir puertos adicionales.
- Los triggers y canales de PostgreSQL se crean automáticamente al ejecutar el script SQL.

---

## Variables de Entorno
- **auth/.env** y **back/.env**: datos de conexión a la base de datos, JWT, etc.
- **front/.env.development** y **front/.env.production**: URLs de endpoints, rutas de imágenes, etc.
- Ejemplo de variables:
  ```env
  # auth/.env
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=usuario
  DB_PASSWORD=clave
  DB_DATABASE=directorio
  JWT_SECRET=tu_clave_secreta
  # ...

  # back/.env
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=usuario
  DB_PASSWORD=clave
  DB_DATABASE=directorio
  # ...

  # front/.env.development
  VITE_API_URL=http://localhost:3000/
  VITE_REVISTA_URL=http://localhost:3001/auth/revistas/
  VITE_IMAGE_BASE_URL=http://localhost:3000/portadas/
  # ...
  ```

---

## Usuarios Demo y Datos de Prueba
- Puedes crear un usuario admin ejecutando `node create-admin.js` en `auth`.
- Se pueden cargar datos de ejemplo en la base de datos usando el script SQL o insertando manualmente.

---

## Solución de Problemas Comunes
- **Error de conexión a la base de datos:** Verifica credenciales y que el servicio esté activo.
- **Imágenes no se cargan:** Asegúrate de que la carpeta `public/portadas` existe y tiene permisos adecuados.
- **Problemas de CORS:** Revisa la configuración de nginx y los headers en el backend.
- **Variables de entorno incorrectas:** Verifica que todos los archivos `.env` estén correctamente configurados.

---

## Ejecución como Servicio (Demonización) con PM2

Para producción, se recomienda usar [PM2](https://pm2.keymetrics.io/) para demonizar y gestionar los procesos de Node.js.

### Instalación de PM2 (global)
```bash
npm install -g pm2
```

### Demonizar el backend de autenticación (`auth`)
```bash
cd directorio/auth
pm install # si no lo has hecho
pm run build # si aplica
pm2 start src/index.js --name directorio-auth
```

### Demonizar el backend público (`back`)
```bash
cd directorio/back
npm install # si no lo has hecho
pm run build # si aplica
pm2 start index.js --name directorio-back
```

### Comandos útiles de PM2
- Ver procesos: `pm2 ls`
- Ver logs: `pm2 logs directorio-auth`
- Reiniciar: `pm2 restart directorio-auth`
- Detener: `pm2 stop directorio-auth`
- Eliminar: `pm2 delete directorio-auth`
- Guardar configuración para reinicio automático:
  ```bash
  pm2 save
  pm2 startup
  ```

---

## Créditos y Licencia
- Autor: cmarrero2021
- Licencia: MIT (o la que corresponda)

---

¿Dudas, sugerencias o problemas? Contacta al autor o abre un issue en el repositorio.
