/* ============================================================================
   MBU ADMIN — service worker
   Deliberately minimal. It makes the app installable to the home screen and
   keeps it working offline, but it NEVER caches car data — stock and enquiries
   always come fresh from the network.

   NETWORK FIRST, on purpose. The old version served the cached copy and only
   refreshed in the background, which meant a change pushed to the site didn't
   show on the phone until the app had been opened twice. Now the app always
   takes the live version when there's signal and falls back to the cached one
   when there isn't. A fraction slower to open, never out of date.

   ⚠️ Bump CACHE below whenever this file changes. Renaming the cache is what
   makes phones throw the old files away.
   ========================================================================== */

const CACHE = 'mbu-admin-v3';
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

  // Never touch anything from Supabase or Cloudinary — always live.
  if (url.hostname.includes('supabase') || url.hostname.includes('cloudinary')) return;

  // Only manage our own files. Fonts and anything else on another host go
  // straight to the network as normal.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      // No signal — fall back to whatever was saved last time.
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
