# Pruebas de CentroFormPage (fusión POBLACIÓN Y CAPACIDAD)

Suite: `centro-form-page.spec.js` — monta la página en modo edición del **centro 336**
con stores y servicios mockeados, y verifica la fusión de los tabs CAPACIDAD + POBLACIÓN.

## Cobertura (18 pruebas)

1. **Estructura de 7 secciones**: 7 tabs con numeración correcta (sin "2. Capacidad"
   ni "3. Población" separados), etiqueta "Progreso General: X de 7", 7 divisiones
   en la barra, 7 chips.
2. **Semáforo**: 3 rojas / 3 naranjas / 1 verde (última verde solo con las 7 guardadas).
3. **Tab fusionado**: 2 `q-expansion-item` desplegados por defecto, Capacidad primero
   y Población después, una sola barra combinada de campos (5/5), badges según estado.
4. **Guardado conjunto**: "Guardar Población y Capacidad" llama a
   `fichasService.saveCapacidad` y luego a `addPoblacion` (orden verificado),
   marca la sección, notifica y actualiza el progreso 5→6 de 7.
   "Guardar y Siguiente" además avanza a Infraestructura.
   Si `saveCapacidad` falla, no se guarda población ni se marca la sección.
5. **Select de categoría**: usa `option-value="value"` (regresión del typo `valu`
   que enviaba el objeto completo y causaba error 500 por `varchar(30)`).
6. **Residentes actuales calculados**: el campo es de solo lectura y refleja el
   acumulado (femenino + masculino) de las filas del Registro de Población;
   los registros guardados se hidratan al entrar en edición. Si el acumulado
   excede la Capacidad Total de Residentes se muestra un banner rojo, se
   bloquean GUARDAR, GUARDAR Y SIGUIENTE y la navegación a otras secciones.

## Cómo ejecutarlas

`npm no puede instalar paquetes en esta carpeta` (Google Drive produce errores
EBADF al extraer miles de archivos). Por eso el toolchain de pruebas vive fuera
del proyecto, en `C:\Users\usuar\AppData\Local\Temp\opencode\rencam-testenv`, con
un `vitest.config.mjs` cuyo `root` apunta a este proyecto:

```bash
cd C:\Users\usuar\AppData\Local\Temp\opencode\rencam-testenv
npx vitest run
```

Requisitos del entorno local (ya instalados):
`vitest@5`, `@vitejs/plugin-vue@6`, `jsdom@29`, `vue@3.5.16` (misma versión que el
proyecto), `@vue/server-renderer@3.5.16`.

Además, `@vue/test-utils` fue **copiado manualmente** a
`front/node_modules/@vue/test-utils`: si se instala solo en el entorno externo,
su `require('vue')` resolvería a otro Vue y duplicaría el runtime
(síntoma: "resolveComponent can only be used in render()").

## Nota sobre hidratación de población (resuelta)

En modo edición las filas de población guardadas **se hidratan** desde
`ficha.poblacion` al montar (modalidad, categoría, femenino, masculino y fecha de
corte). "Residentes actuales" es un campo calculado de solo lectura que suma
esos registros y se mantiene sincronizado en el modelo para el guardado.
