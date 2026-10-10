// Installable, online-only Window PWA. Never save or serve offline copies.
const OLD_CACHE_PREFIX = 'window-v';
const WEATHER_RAW_BASE = 'https://raw.githubusercontent.com/bennessism/window/main/';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(OLD_CACHE_PREFIX)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Preserve the existing weather-data route, but always fetch online.
  if (url.origin === self.location.origin && url.pathname.includes('/weather/')) {
    const weatherPath = url.pathname.slice(url.pathname.indexOf('/weather/') + 1);
    const rawUrl = WEATHER_RAW_BASE + weatherPath + '?ts=' + Date.now();
    event.respondWith(fetch(rawUrl, { cache: 'no-store' }).catch(() => fetch(request, { cache: 'no-store' })));
    return;
  }
  event.respondWith(fetch(request, { cache: 'no-store' }));
});
