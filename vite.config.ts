import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import brand from './src/brand.json' with { type: 'json' };

// The model runner's engines (onnxruntime-web WebAssembly files) served beside the app as /ort/<file>, fetched only
// when a page runs a model — never precached on every install.
const ORT_FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.asyncify.wasm'];
const ORT_DIR = fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/', import.meta.url));
const ortWasm: Plugin = {
  name: 'ort-wasm',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = /\/ort\/([\w.-]+\.wasm)$/.exec(req.url ?? '');
      if (!m || !ORT_FILES.includes(m[1])) return next();
      res.setHeader('Content-Type', 'application/wasm');
      res.end(readFileSync(ORT_DIR + m[1]));
    });
  },
  generateBundle() {
    for (const f of ORT_FILES) this.emitFile({ type: 'asset', fileName: `ort/${f}`, source: readFileSync(ORT_DIR + f) });
  },
};

export default defineConfig({
  base: '/mushrooms/',
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    preact(),
    ortWasm,
    // %APP_NAME% / %APP_SHORT_NAME% in index.html come from src/brand.json, so the name is changed in one place.
    { name: 'brand-html', transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', brand.name).replaceAll('%APP_SHORT_NAME%', brand.shortName) },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: `${brand.name} (test version)`,
        short_name: brand.shortName,
        description: 'A UK mushroom guide. Test version: not for identifying mushrooms.',
        theme_color: '#2f3a2f',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/mushrooms/',
        scope: '/mushrooms/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
