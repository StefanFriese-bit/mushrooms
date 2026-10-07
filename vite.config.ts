import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import brand from './src/brand.json' with { type: 'json' };
import scanSettings from './content/model/scan-settings.json' with { type: 'json' };

// Files from packages that must sit beside the app at a fixed address, served by the dev server and written into the
// build: the model runner's engines (onnxruntime-web WebAssembly, /ort/…) and the map's worker (MapLibre's worker
// module and the shared module it imports, /maplibre/…; given .js names, which every host serves as JavaScript).
type Vendored = { to: string; from: string; type: string; edit?: (text: string) => string };
const NM = fileURLToPath(new URL('./node_modules/', import.meta.url));
const VENDORED: Vendored[] = [
  { to: 'ort/ort-wasm-simd-threaded.wasm', from: 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', type: 'application/wasm' },
  { to: 'ort/ort-wasm-simd-threaded.asyncify.wasm', from: 'onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', type: 'application/wasm' },
  { to: 'maplibre/maplibre-gl-worker.js', from: 'maplibre-gl/dist/maplibre-gl-worker.mjs', type: 'text/javascript',
    edit: (t) => t.replace('from"./maplibre-gl-shared.mjs"', 'from"./maplibre-gl-shared.js"') },
  { to: 'maplibre/maplibre-gl-shared.js', from: 'maplibre-gl/dist/maplibre-gl-shared.mjs', type: 'text/javascript' },
];
const readVendored = (v: Vendored): string | Buffer => {
  if (!v.edit) return readFileSync(NM + v.from);
  const text = readFileSync(NM + v.from, 'utf8');
  const out = v.edit(text);
  if (out === text) throw new Error(`${v.from}: the expected text to change was not found (a new package version?)`);
  return out;
};
const vendored: Plugin = {
  name: 'vendored-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const v = VENDORED.find((x) => (req.url ?? '').split('?')[0].endsWith(`/${x.to}`));
      if (!v) return next();
      res.setHeader('Content-Type', v.type);
      res.end(readVendored(v));
    });
  },
  generateBundle() {
    for (const v of VENDORED) this.emitFile({ type: 'asset', fileName: v.to, source: readVendored(v) });
  },
};

// The scan's model file and its engine are stored when the app is first opened (spec 4.3), so the scan works in a wood
// with no signal — only the model the test chose; the other models (speed test only) are fetched when asked for.
const SCAN = scanSettings as { passed: boolean; file?: string };
const OFFLINE_SCAN = SCAN.passed && SCAN.file ? [SCAN.file, 'ort/ort-wasm-simd-threaded.wasm'] : [];

export default defineConfig({
  base: '/mushrooms/',
  // Older iPhones too: newer JavaScript is rewritten for Safari 14 (iOS 14). A pattern Safari 14 cannot read (look-behind)
  // is refused by tests/old-safari.test.ts.
  build: { target: ['es2020', 'safari14'] },
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    preact(),
    vendored,
    // %APP_NAME% / %APP_SHORT_NAME% in index.html come from src/brand.json, so the name is changed in one place.
    { name: 'brand-html', transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', brand.name).replaceAll('%APP_SHORT_NAME%', brand.shortName) },
    VitePWA({
      // Our own service worker (src/sw/sw.ts): it reports download progress and waits for his Restart (src/update.ts).
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: brand.name,
        short_name: brand.shortName,
        description: 'A UK mushroom field guide.',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,ico,webmanifest}', ...OFFLINE_SCAN],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
    }),
  ],
});
