/* ============================================================================
   MBU ADMIN — service worker
   Deliberately minimal. It makes the app installable to the home screen and
   caches the shell so it opens instantly, but it NEVER caches car data —
   stock and enquiries always come fresh from the network.
   ========================================================================== */

const CACHE = 'mbu-admin-v1';
const SHELL = [
  './',
  './index.html',
  './admin.css',
  './app.js',
  './manifest.json',
  '../assets/js/config.js',
  '../assets/img/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache anything from Supabase or Cloudinary — always live.
  if (url.hostname.includes('supabase') || url.hostname.includes('cloudinary')) return;

  // Shell files: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
