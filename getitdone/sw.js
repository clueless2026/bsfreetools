const CACHE_NAME = 'getitdone-v1';
const ASSETS = [
  'index.html',
  'manifest.json'
];

// Install: Cache the essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate: Clean up old caches if version changes
self.addEventListener('activate', (event) => {
  event.cliam();
});

// Fetch: Serve from cache if offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});