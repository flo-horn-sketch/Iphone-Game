// Offline-Speicher für Luftlinie.
//
// Der Ladebildschirm (airline/airline-laden.js) legt beim Start alle Dateien aus dateien.json in den
// Cache "luftlinie-dateien". Dieser Service Worker liefert sie von dort aus, auch ohne Internet.
// Nur version.json und dateien.json kommen immer frisch aus dem Netz.
const CACHE = "luftlinie-dateien";
const SCHRIFT = "luftlinie-schrift";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const basis = new URL(self.registration.scope);

  if (url.origin === basis.origin && url.pathname.startsWith(basis.pathname)) {
    let rel = decodeURIComponent(url.pathname.slice(basis.pathname.length));
    if (rel === "version.json" || rel === "dateien.json") return;      // immer aus dem Netz
    if (url.searchParams.has("laden")) return;                          // der Ladebildschirm holt frisch vom Server
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const treffer = await cache.match(new URL(rel, basis).href, { ignoreSearch: true });
      if (treffer) return treffer;
      return fetch(req);
    })());
    return;
  }

  // Schrift von Google: einmal holen, danach aus dem Speicher.
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(SCHRIFT);
      const treffer = await cache.match(req);
      if (treffer) return treffer;
      try {
        const antwort = await fetch(req);
        if (antwort.ok || antwort.type === "opaque") cache.put(req, antwort.clone());
        return antwort;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
