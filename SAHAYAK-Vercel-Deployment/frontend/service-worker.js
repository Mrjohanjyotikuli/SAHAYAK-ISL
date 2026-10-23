const CACHE = 'sahayak-pwa-shell-v2';
const SHELL = [
  '/pwa.js',
  '/',
  '/index.html',
  '/studio.html',
  '/config.js',
  '/legang-ai.js',
  '/legang-ai.css',
  '/manifest.webmanifest',
  '/assets/sahayak.png',
  '/assets/pwa-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (_) {
        // A missing optional asset should not prevent the PWA shell from installing.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      (key.startsWith('sahayak-shell-') || key.startsWith('sahayak-pwa-')) &&
      key !== CACHE
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept cross-origin requests or the API. Predictions and translations need
  // the live backend and must not be served from stale cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(url.pathname, response.clone());
          if (url.pathname === '/') await cache.put('/index.html', response.clone());
          if (url.pathname === '/index.html') await cache.put('/', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(url.pathname)) ||
          (await caches.match('/index.html')) ||
          new Response('SAHAYAK is offline. Open the app after the first successful visit to cache its interface.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
