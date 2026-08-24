// Service Worker — caches the page + satellite tiles for offline field use.
// Strategy: cache-first for tiles (fast + offline), network-first for the page itself.
const CACHE_NAME = 'fen-field-v1';
const PAGE_CACHE = 'fen-page-v1';

// Pre-cache the main page on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then(cache =>
      cache.addAll(['./', './index.html'])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== PAGE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Tile requests — cache-first (once downloaded, always available offline)
  if (url.includes('arcgisonline.com/') || url.includes('tile.openstreetmap.org/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response('', {status: 408}));
        })
      )
    );
    return;
  }

  // Page / other resources — network-first, fall back to cache
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(PAGE_CACHE).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
