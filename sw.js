/* generado por build.mjs — versión e6b413a1ce68 (app v5.13) */
const CACHE = "bloques-e6b413a1ce68";
const ASSETS = ["./","./index.html","./app.js","./manifest.webmanifest","./vendor/react.production.min.js","./vendor/react-dom.production.min.js","./icon-512.png","./apple-touch-icon.png","./apple-touch-icon-precomposed.png"];
const PATHS = new Set(ASSETS.map((a) => new URL(a, self.location).pathname));
/* v4.81 — LA REDIRECCIÓN. Victor, con la app en blanco en Cloudflare y funcionando en GitHub:
   "Response served by service worker has redirections".

   Ese es el fallo entero y explica la diferencia entre los dos sitios. Un service worker NO PUEDE
   devolver una respuesta que venga de una redirección: el navegador la rechaza por seguridad y la
   página se queda en blanco. Y Cloudflare Pages **redirige** las direcciones acabadas en .html a la
   versión sin extensión (/index.html → /), cosa que GitHub Pages no hace. Por eso la misma app,
   con los mismos archivos, va en un sitio y en el otro no.

   Peor todavía: cache.put TAMBIÉN rechaza una respuesta redirigida, así que la instalación entera
   fallaba y el service worker nuevo no llegaba a instalarse nunca. De ahí que no se arreglara solo
   por más versiones que publicara: el que mandaba seguía siendo el viejo, y el viejo no podía
   cambiarse a sí mismo.

   sinRedir reconstruye la respuesta a partir de su cuerpo: es la misma respuesta pero ya sin la
   marca de "vengo de una redirección", que es lo único que molesta. */
const sinRedir = (res) => (res && res.redirected
  ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
  : res);
self.addEventListener("install", (e) => {
  /* uno a uno y tolerante: que un archivo suelto no pueda tumbar la instalación entera y dejar
     al service worker viejo mandando para siempre */
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) =>
    fetch(new Request(a, { cache: "no-cache" }))
      .then((r) => (r && r.ok ? c.put(new URL(a, self.location).href, sinRedir(r)) : null))
      .catch(() => null)
  ))).then(() => self.skipWaiting()));
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
    fresh.then((original) => {
      const res = sinRedir(original);
      if (res && res.ok && PATHS.has(clean.pathname)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(clean.href, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(clean.href).then((hit) => {
      if (hit) return hit;
      /* v4.79 — PANTALLA EN BLANCO. Antes, si algo fallaba y no estaba en la caché, se devolvía
         index.html PARA CUALQUIER COSA. Aplicado a app.js eso significa que el navegador recibía
         HTML donde esperaba JavaScript, reventaba al primer "<" y la app se quedaba en blanco sin
         una palabra. Justo lo que le pasó a Victor tras una actualización: el index nuevo pide un
         app.js con hash nuevo, un instante sin red, y a la caché aún no había llegado.
         El respaldo de index.html es para NAVEGACIONES y solo para eso. Para un script es mejor
         un error honesto: así el arranque del index lo detecta y lo dice. */
      if (req.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }))
  );
});
