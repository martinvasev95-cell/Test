// Minimal offline cache for the Daily Check-In app: network-first for
// same-origin GET requests, falling back to the cache only when the network
// fetch fails (i.e. you're offline). This is deliberately NOT
// stale-while-revalidate — that strategy always serves the cached copy
// first, which meant a redeploy could take two full closes-and-reopens (or
// never, if the app was only ever backgrounded) to actually show up.
// Network-first means you get today's version whenever you have signal, and
// the cached one only as a fallback with no connection. Bump CACHE_NAME on
// a future change to this file to force old caches out (the activate
// handler clears anything with a different name).
const CACHE_NAME = 'daily-checkin-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
