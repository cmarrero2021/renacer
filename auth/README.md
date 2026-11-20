# directorio-auth
Backend de seguridad protegido por usuario/clave

## Correo en desarrollo (MailDev)

En desarrollo los correos NO se envían a un servidor real: los captura [MailDev](https://github.com/maildev/maildev),
un SMTP falso con interfaz web.

1. Iniciar MailDev (deja el SMTP en el puerto `1025` y la UI en el `1080`):

   ```bash
   npm run maildev
   ```

2. Abrir la bandeja en: <http://localhost:1080>

3. Arrancar la API normalmente. El `.env.development` ya apunta a
   `EMAIL_HOST=localhost`, `EMAIL_PORT=1025`. Cualquier correo enviado con
   `sendEmail` (códigos de recuperación, etc.) aparecerá en la bandeja de MailDev.

Las credenciales SMTP reales (`correo.minaamp.gob.ve`) quedan comentadas en
`.env.development` para cuando se necesite enviar correo de verdad.
