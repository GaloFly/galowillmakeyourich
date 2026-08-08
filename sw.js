/* generado por build.mjs — versión 2207306333b7 (app v4.44) */
const CACHE = "bloques-2207306333b7";
const ASSETS = ["./","./index.html","./app.js","./manifest.webmanifest","./vendor/react.production.min.js","./vendor/react-dom.production.min.js","./icon-512.png","./apple-touch-icon.png","./apple-touch-icon-precomposed.png"];
const PATHS = new Set(ASSETS.map((a) => new URL(a, self.location).pathname));
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: "no-cache" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  const clean = new URL(req.url); clean.search = "";
  /* mode:"navigate" no se puede re-construir con init — para el documento se pide por URL */
  const fresh = req.mode === "navigate"
    ? fetch(clean.href, { cache: "no-cache" })
    : fetch(req, { cache: "no-cache" });
  e.respondWith(
    fresh.then((res) => {
      if (res && res.ok && PATHS.has(clean.pathname)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(clean.href, copy));
      }
      return res;
    }).catch(() => caches.match(clean.href)
      .then((hit) => hit || caches.match("./index.html")))
  );
});
