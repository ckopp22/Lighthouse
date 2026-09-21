// Caches the app shell so the game works offline once visited/installed.
// Bump CACHE_VERSION whenever a cached file changes, or returning visitors
// keep seeing the old files.
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'lighthouse-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'data/config.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' skips the browser's HTTP cache. Static hosts like GitHub
    // Pages serve files with max-age=600, so without it a fresh deploy could be
    // precached as a mix of old and new files and stay that way.
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first, falling back to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
