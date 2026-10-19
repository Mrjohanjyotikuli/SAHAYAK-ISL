
const CACHE = 'sahayak-shell-v17-stats';
const SHELL = ['/', '/index.html', '/studio.html', '/config.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('sahayak-shell-') && key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    request.method !== 'GET'
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    const cacheKey = url.pathname === '/' ? '/' : url.pathname;
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE).then(async cache => {
              await cache.put(cacheKey, response.clone());
              if (url.pathname === '/') await cache.put('/index.html', response.clone());
              if (url.pathname === '/index.html') await cache.put('/', response.clone());
            });
          }
          return response;
        })
        .catch(async () => (await caches.match(cacheKey)) || caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
  );
});
