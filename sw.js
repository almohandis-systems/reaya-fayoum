const BRAND_VERSION = 'raaya-neutral-20261123-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  // Always ask the network for current branding; do not create a stale asset cache.
  event.respondWith(fetch(event.request, {cache: 'no-cache'}).catch(() => caches.match(event.request)));
});
