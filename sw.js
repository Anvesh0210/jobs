/* HEALNEXIA service worker: makes the site and app work offline and installable.
 * - Precaches the whole (small, static) app on install.
 * - Pages: network first, falling back to the cached copy when offline.
 * - Assets: served from cache, refreshed in the background (stale-while-revalidate).
 * Only same-origin GET requests are handled; nothing is sent anywhere. */
const VERSION = 'hx-2026-11-04-4';

// Keep in sync with the public files. tests/unit/pwa.test.js fails if any are missing.
const PRECACHE = [
  './',
  'index.html',
  'app.html',
  'manifest.webmanifest',
  'assets/site.css',
  'assets/app.css',
  'assets/fonts/figtree-latin-wght-normal.woff2',
  'assets/fonts/figtree-latin-ext-wght-normal.woff2',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'site/main.js',
  'src/main.js',
  'src/lib/html.js',
  'src/lib/clock.js',
  'src/lib/text.js',
  'src/lib/pwa.js',
  'src/data/seed.js',
  'src/domain/actions.js',
  'src/domain/messages.js',
  'src/domain/worklist.js',
  'src/infra/schema.js',
  'src/infra/storage.js',
  'src/app/store.js',
  'src/app/services.js',
  'src/ui/app.js',
  'src/ui/components.js',
  'src/ui/views/patient.js',
  'src/ui/views/provider.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hx-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(request, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => store(request, response))
        .catch(async () => (await caches.match(request, { ignoreSearch: true })) || caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => store(request, response)).catch(() => cached);
      return cached || network;
    })
  );
});
