// Service Worker mínimo — habilita instalación PWA
const CACHE = "mvdprime-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: siempre intenta red, cae a caché solo si falla
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Solo cachear recursos del mismo origen
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
