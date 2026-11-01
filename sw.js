/* Montra TMS service worker — release 2.2.1 */
const APP_VERSION = '2.2.1';
const CACHE_NAME = 'montra-tms-shell-' + APP_VERSION;
const APP_SHELL = [
  './', './index.html', './manifest.json',
  './assets/montra-logo.svg', './assets/montra-logo.png',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/montra-rhino-tipper.jpg', './assets/montra-rhino-trailer.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('montra-tms-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Always try the network first for navigations so GitHub Pages deployments update promptly.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
      return response;
    }).catch(() => caches.match('./index.html').then(cached => cached || Response.error())));
    return;
  }

  // Cache-first for static assets, with background refresh when online.
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    });
    return cached || network.catch(() => Response.error());
  }));
});
