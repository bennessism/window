const CACHE_NAME = 'window-v9';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './touch-layout.js',
  './manifest.webmanifest',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

const WEATHER_RAW_BASE = 'https://raw.githubusercontent.com/bennessism/window/main/';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const weatherMarker = '/weather/';
  const weatherIndex = url.pathname.indexOf(weatherMarker);
  if (weatherIndex !== -1) {
    const weatherPath = url.pathname.slice(weatherIndex + 1);
    const rawUrl = `${WEATHER_RAW_BASE}${weatherPath}?ts=${Date.now()}`;
    event.respondWith(
      fetch(rawUrl, { cache: 'no-store' }).catch(() => fetch(request, { cache: 'no-store' }))
    );
    return;
  }

  const networkFirst = request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/style.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/touch-layout.js') ||
    url.pathname.endsWith('/room-links.json') ||
    url.pathname.endsWith('/room-frame.json');

  if (networkFirst) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
