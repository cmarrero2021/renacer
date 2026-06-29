# Instrucciones de Despliegue - RENACER (Debian 12)

A continuación se detallan los pasos para desplegar la aplicación en tu servidor (`192.168.0.32`) y configurar el proxy inverso (`192.168.0.11`).

---

## Parte 1: Servidor de Aplicaciones (192.168.0.32)

### 1. Preparar el código en la carpeta destino
Copia el contenido de este proyecto a la carpeta `/var/www/html/renacer/`.

### 2. Instalar dependencias y recompilar
```bash
cd /var/www/html/renacer/auth
npm install --production

cd /var/www/html/renacer/front
npm install
npx quasar build
```
*(Esto compilará el frontend SPA utilizando las variables de entorno de `.env.production` que configuramos).*

### 3. Iniciar el Backend con PM2
```bash
cd /var/www/html/renacer
pm2 start ecosystem.config.js --env production
pm2 save
```
*(El backend quedará levantado en el puerto `4110`).*

### 4. Configurar Nginx Local (Servidor de archivos estáticos)
Crea y edita el archivo de virtualhost:
```bash
sudo nano /etc/nginx/sites-available/renacer
```

Pega la siguiente configuración:
```nginx
server {
    listen 9110;
    server_name renacer.minaamp.gob.ve;

    # Apuntamos a la carpeta principal del front
    root /var/www/html/renacer/front;
    index index.html;

    # Fallback para history mode del vue-router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Caché estático
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Habilita el sitio y reinicia Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/renacer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Parte 2: Proxy Inverso (192.168.0.11)

### 1. Configurar Nginx proxy pass
Crea o edita el archivo de configuración para `renacer.minaamp.gob.ve`:
```bash
sudo nano /etc/nginx/conf.d/renacer.conf
# (O dentro del archivo donde ya tienes los otros virtualhosts)
```

Pega esta configuración completa:
```nginx
# ============================================
# HTTP - renacer.minaamp.gob.ve (Para inicializar Certbot)
# ============================================
server {
    listen 80;
    server_name renacer.minaamp.gob.ve;

    # 1. API - Auth
    location /auth/ {
        proxy_pass http://192.168.0.32:4110;
        proxy_http_version 1.1;

        # Headers para que Express (trust proxy) reconozca la IP real (Rate Limit)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }

    # 2. API - Analytics
    location /analytics/ {
        proxy_pass http://192.168.0.32:4120;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }

    # 3. Frontend SPA
    location / {
        proxy_pass http://192.168.0.32:9110;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }

    # 4. WebSocket
    location /ws {
        proxy_pass http://192.168.0.32:4110;
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

    # Logs
    access_log /var/log/nginx/renacer_access.log;
    error_log /var/log/nginx/renacer_error.log;
}
```

> **IMPORTANTE:** Guarda el archivo y reinicia Nginx (`sudo nginx -t && sudo systemctl reload nginx`). Notarás que NO hemos incluido las líneas `listen 443 ssl` ni las rutas de los certificados todavía. Esto es necesario para que Nginx arranque correctamente *antes* de generar el certificado.

### 2. Generar Certificado SSL (Certbot)
Ahora que Nginx está corriendo sin errores con el subdominio en el puerto 80, ejecuta Certbot:

```bash
sudo certbot --nginx -d renacer.minaamp.gob.ve
```

> [!IMPORTANT]
> Si Certbot **NO** te pregunta por la redirección (`Redirect HTTP to HTTPS`), deberás configurar el bloque del puerto 80 manualmente para asegurar que el sitio siempre cargue por HTTPS:
> 
> ```nginx
> server {
>     listen 80;
>     server_name renacer.minaamp.gob.ve;
>     return 301 https://$host$request_uri;
> }
> ```

Para garantizar la autorenovación con un hook a Nginx, abre crontab:
```bash
sudo crontab -e
```
Y verifica que tienes una línea como esta:
```cron
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### 3. Reiniciar Nginx en Proxy
Para que todo tome efecto:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Verificación Final
1. Entra a `https://renacer.minaamp.gob.ve` desde un navegador (debe cargar el App).
2. Entra a `https://renacer.minaamp.gob.ve/auth/list-endpoints` (debe retornar un JSON con los endpoints del backend).
3. Entra a `https://renacer.minaamp.gob.ve/login` e intenta ingresar (los logs del backend en 192.168.0.32 deben registrar tu IP real gracias a `trust proxy`).
