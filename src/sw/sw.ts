/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { addPlugins, cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { progressStep, type SwMessage } from './messages';

// The app's service worker (vite-plugin-pwa, injectManifest). It keeps the whole app — guide, photos, the scan model —
// on the phone (spec 4.3), and it never takes over by itself: a new version downloads in the background, says how far
// it has got, then waits until he taps "Restart" (src/update.ts). The automatic take-over of 06/10 never happened at
// all: the generated worker had no skipWaiting(), so a new version waited until every window was closed — on an
// iPhone, a home-screen app is rarely really closed.
declare let self: ServiceWorkerGlobalScope;

const MANIFEST = self.__WB_MANIFEST;
// Files, not list entries: the icons and the web manifest are listed twice (the file pattern and the plugin's own icon
// list both add them) and Workbox stores each once, so 1,591 entries are 1,584 files.
const TOTAL = new Set(MANIFEST.map((e) => (typeof e === 'string' ? e : e.url))).size;

async function tell(message: SwMessage) {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) client.postMessage(message);
}

// Every file of an install passes exactly one of these: already stored (a file this version shares with the last, or
// one an interrupted install had already saved — those are never fetched again) or stored now.
let done = 0;
let told = -1;
const counted = async (event: ExtendableEvent | undefined) => {
  if (event?.type !== 'install') return;
  done++;
  const step = progressStep(done, TOTAL);
  if (step !== told) { told = step; await tell({ type: 'PRECACHE_PROGRESS', done, total: TOTAL }); }
};
addPlugins([{
  cachedResponseWillBeUsed: async ({ event, cachedResponse }) => {
    if (cachedResponse) await counted(event as ExtendableEvent | undefined);
    return cachedResponse ?? null;
  },
  cacheDidUpdate: async ({ event }) => { await counted(event as ExtendableEvent | undefined); },
}]);
self.addEventListener('install', () => { done = 0; told = -1; });

precacheAndRoute(MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
// Map areas he has looked at stay on the phone (spec 7): OpenFreeMap's style, tiles, fonts and icons, kept after the
// first view, up to a limit; never fetched in bulk.
registerRoute(({ url }) => url.origin === 'https://tiles.openfreemap.org', new CacheFirst({
  cacheName: 'map-viewed',
  plugins: [new ExpirationPlugin({ maxEntries: 6000, maxAgeSeconds: 120 * 24 * 3600 }), new CacheableResponsePlugin({ statuses: [200] })],
}), 'GET');

self.addEventListener('message', (event) => {
  if ((event.data as SwMessage | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// The worker this one replaces may be the OLD kind (before 07/10/2026): its page has no Restart button, so a new version
// would wait for ever. Every worker of the new kind leaves a mark when it takes over; with no mark on the phone, this one
// takes over by itself as soon as it is complete — once (the old page then reloads itself into the new app).
const MARK = 'update-protocol-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.has(MARK).then((marked) => { if (!marked) return self.skipWaiting(); }));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.open(MARK).then(() => undefined));
});
// The first time (nothing on the phone yet) the new worker controls the open page at once, so the app works without
// signal straight away; an update only gets here after he tapped Restart.
clientsClaim();
