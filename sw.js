// Offline cache for the SPI app. Bump VERSION whenever any file changes.
const VERSION = "spi-v3";
const FILES = [
  "./", "index.html", "app.css", "app.js", "gens.js", "content.js", "manifest.webmanifest",
  "vendor/phosphor/regular.css", "vendor/phosphor/fill.css", "vendor/phosphor/Phosphor.woff2", "vendor/phosphor/Phosphor-Fill.woff2",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (revalidating past the HTTP cache) so updates arrive when online; the cache answers when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
