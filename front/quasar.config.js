/* eslint-env node */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { configure } from "quasar/wrappers";

export default configure(function (ctx) {
  return {
    // app boot file (/src/boot)
    boot: ["i18n", "axios", "auth", "pinia"],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ["app.scss"],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      "ionicons-v4",
      "mdi-v7",
      "fontawesome-v6",
      "eva-icons",
      "themify",
      "line-awesome",
      "roboto-font",
      "material-icons",
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ["es2019", "edge88", "firefox78", "chrome87", "safari13.1"],
        node: "node20",
        publicPath: ctx.mode.spa ? "/" : "./",
      },

      vueRouterMode: "hash",
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      port: 9110,
      open: true,
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      config: {},
      plugins: ["Notify", "Dialog", "LocalStorage"],
    },

    animations: [],

    sourceFiles: {
      router: "src/router/index",
    },

    ssr: {
      pwa: false,
      prodPort: 3000,
      middlewares: ["render"],
    },

    pwa: {
      workboxMode: "generateSW",
      injectPwaMetaTags: true,
      swFilename: "sw.js",
      manifestFilename: "manifest.json",
      useCredentialsForManifestTag: false,
    },

    cordova: {},
    capacitor: { hideSplashscreen: true },

    electron: {
      inspectPort: 5858,
      bundler: "packager",
      packager: {},
      builder: { appId: "auth-management" },
    },

    bex: {
      contentScripts: ["my-content-script"],
    },
  };
});
