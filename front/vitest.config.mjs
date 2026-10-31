import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// Configuración de Vitest para las pruebas de front/test/.
//
// NOTA: en esta máquina npm no puede instalar paquetes en esta carpeta
// (Google Drive → errores EBADF). Las pruebas se ejecutan hoy desde un
// entorno local con este mismo contenido; ver front/test/README.md.
// Si algún día se instalan las devDependencies aquí (vitest,
// @vitejs/plugin-vue, jsdom, @vue/test-utils), este archivo funcionará tal cual
// con: npm run test:unit
export default defineConfig({
    plugins: [vue()],
    resolve: {
        dedupe: ['vue'],
        alias: {
            vue: fileURLToPath(new URL('./node_modules/vue', import.meta.url)),
            '@vue': fileURLToPath(new URL('./node_modules/@vue', import.meta.url)),
            quasar: fileURLToPath(new URL('./node_modules/quasar/dist/quasar.client.js', import.meta.url)),
            src: fileURLToPath(new URL('./src', import.meta.url)),
            pages: fileURLToPath(new URL('./src/pages', import.meta.url)),
            components: fileURLToPath(new URL('./src/components', import.meta.url)),
            layouts: fileURLToPath(new URL('./src/layouts', import.meta.url)),
            boot: fileURLToPath(new URL('./src/boot', import.meta.url)),
            assets: fileURLToPath(new URL('./src/assets', import.meta.url)),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['test/**/*.spec.js'],
        server: {
            deps: {
                optimizer: { web: { enabled: false } },
                inline: ['@vue/test-utils'],
            },
        },
    },
});
