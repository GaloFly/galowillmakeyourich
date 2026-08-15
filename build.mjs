/* Build: convierte el index.html editable (JSX + scripts de CDN) en una app rápida y
 * con modo sin conexión, dentro de dist/.
 *
 * El archivo fuente sigue siendo el de siempre — un index.html con su bloque
 * <script type="text/babel">, editable a mano. Este script:
 *   1. compila ese JSX UNA vez, aquí, para que el teléfono no descargue Babel (~3 MB)
 *      ni traduzca 12.000 líneas en cada arranque;
 *   2. cambia los tags de cdnjs por copias locales en ./vendor — sin depender de webs ajenas;
 *   3. inyecta manifest + service worker para que la app instalada abra en modo avión;
 *   4. deja en el HTML compilado el marcador `const APP_VERSION = "x"` que el script de
 *      auto-actualización busca con regex — sin él, ninguna actualización se detectaría
 *      nunca, porque la constante real ahora vive en app.js.
 *
 * Uso: node build.mjs  →  escribe dist/  (no editar dist/ a mano: se regenera entero)
 */
import { transformAsync } from "@babel/core";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, rm, access } from "node:fs/promises";

const SRC = "index.html";
const OUT = "dist";

const html = await readFile(SRC, "utf8");

/* ---- 1. extraer el bloque JSX y compilarlo ---- */
const OPEN = '<script type="text/babel" data-presets="react">';
const start = html.indexOf(OPEN);
if (start < 0) throw new Error("no hay bloque text/babel en " + SRC);
const bodyStart = start + OPEN.length;
const end = html.indexOf("</script>", bodyStart);
if (end < 0) throw new Error("el bloque text/babel no se cierra");
const jsx = html.slice(bodyStart, end);

const verMatch = jsx.match(/const APP_VERSION = "([^"]+)"/);
if (!verMatch) throw new Error("no encuentro APP_VERSION en el fuente — el auto-update lo necesita");
const appVersion = verMatch[1];

const compiled = await transformAsync(jsx, {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  babelrc: false,
  configFile: false,
  compact: false,          /* legible: que los números de línea de un crash signifiquen algo */
  sourceMaps: false,
});
if (/<\/script/i.test(compiled.code)) throw new Error("el JS compilado contiene </script>");

/* ---- 2. reescribir la página alrededor ---- */
/* app.js se referencia con su hash (?v=…): GitHub Pages cachea hasta 10 min, y sin esto un index.html
 * recién desplegado podía cargar el app.js VIEJO de la caché — la app seguía corriendo la versión
 * anterior aunque el HTML ya fuera el nuevo, y la actualización parecía no aplicarse nunca. */
const jsHash = createHash("sha256").update(compiled.code).digest("hex").slice(0, 10);
let page = html.slice(0, start) + '<script src="./app.js?v=' + jsHash + '"></script>' + html.slice(end + "</script>".length);

page = page
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react\/[^"]*"[^>]*><\/script>/,
    '<script src="./vendor/react.production.min.js"></script>')
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react-dom\/[^"]*"[^>]*><\/script>/,
    '<script src="./vendor/react-dom.production.min.js"></script>')
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]*"[^>]*><\/script>\n?/,
    "");
if (page.includes("cdnjs.cloudflare.com")) throw new Error("sobrevivió un tag de CDN");

/* el marcador de versión para el auto-update (busca este texto en el HTML descargado) */
page = page.replace("</head>",
  '<link rel="manifest" href="./manifest.webmanifest">\n' +
  '<!-- const APP_VERSION = "' + appVersion + '" (marcador para el auto-update; la constante real está en app.js) -->\n' +
  "</head>");

const version = createHash("sha256").update(compiled.code).update(page).digest("hex").slice(0, 12);
page = page.replace("</body>",
  "<script>\n" +
  'if ("serviceWorker" in navigator) { navigator.serviceWorker.register("./sw.js").catch(function () {}); }\n' +
  "</script>\n</body>");

/* ---- 3. service worker: red primero (SIN caché HTTP), caché propia como respaldo ----
 * Con red se comporta como hoy (siempre lo último, y el auto-update sigue funcionando);
 * sin red sirve la última copia buena. Solo cachea los archivos de la propia app — las
 * peticiones con ?_cachebust del auto-update pasan de largo sin ensuciar la caché.
 *
 * v4.05 — cache:"no-cache" en TODOS los fetch del SW. Sin esto, fetch(req) podía responder
 * desde la caché HTTP del navegador (GitHub Pages manda max-age=600): tras actualizar, cada
 * apertura volvía a arrancar con el index.html VIEJO guardado para "./" (la actualización
 * navega a una URL con parámetros, así que la entrada "./" nunca se renovaba) y la app
 * re-ofrecía la misma versión una y otra vez. no-cache revalida contra el servidor (304 si
 * no cambió: barato) y solo cae a la caché propia del SW cuando de verdad no hay red. */
const iconCandidates = ["icon-512.png", "favicon.png", "apple-touch-icon.png", "apple-touch-icon-precomposed.png"];
const icons = [];
for (const f of iconCandidates) { try { await access(f); icons.push(f); } catch (e) {} }

const ASSETS = ["./", "./index.html", "./app.js", "./manifest.webmanifest",
  "./vendor/react.production.min.js", "./vendor/react-dom.production.min.js",
  ...icons.map((f) => "./" + f)];
const sw = `/* generado por build.mjs — versión ${version} (app v${appVersion}) */
const CACHE = "bloques-${version}";
const ASSETS = ${JSON.stringify(ASSETS)};
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
`;

const manifest = {
  name: "Portfolio + Comparador",
  short_name: "Portfolio",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#EEE9E0",
  theme_color: "#EEE9E0",
  icons: [
    { src: "./icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "./apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ].filter((i) => icons.includes(i.src.slice(2))),
};

/* ---- 4. escribir dist/ ---- */
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT + "/vendor", { recursive: true });
await writeFile(OUT + "/index.html", page);
await writeFile(OUT + "/app.js", compiled.code);
await writeFile(OUT + "/sw.js", sw);
await writeFile(OUT + "/manifest.webmanifest", JSON.stringify(manifest, null, 2));

/* v4.79 — PÁGINA DE RESCATE, en su propia dirección: /rescate.html
   Cuando la app no arranca, el cartel de arranque del index no sirve de nada si lo que no llega es
   el propio index. Esta página es una salida que NO depende de la app: no carga app.js, no usa
   React, no tiene dependencias. Hace dos cosas:
     · dice qué versión está sirviendo el servidor AHORA (pidiendo el index con un cachebuster),
       que es lo que distingue "no ha llegado la actualización" de "mi teléfono tiene basura";
     · repara: desregistra el service worker y borra sus cachés. NUNCA toca localStorage, que es
       donde viven las posiciones.
   Va aparte del index a propósito: si el index está envenenado en la caché, esta URL nunca lo
   estuvo. */
const rescate = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Reparar la app</title></head>
<body style="font:600 15px/1.55 -apple-system,system-ui,sans-serif;color:#1a1d24;background:#fff;margin:0">
<div style="max-width:520px;margin:0 auto;padding:26px 22px">
  <div style="font-size:20px;font-weight:800;margin-bottom:10px">Reparar la app</div>
  <div style="color:#5b6472;margin-bottom:18px">Tus posiciones <b>siguen en el teléfono</b>. Esto solo cambia los archivos del programa: no toca tus datos ni tu copia de seguridad.</div>
  <div id="estado" style="background:#f2f4f7;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:13.5;color:#5b6472">Comprobando qué versión sirve el servidor…</div>
  <button id="rep" style="width:100%;border:none;border-radius:12px;padding:14px 0;font:800 15px -apple-system,system-ui,sans-serif;background:#1BA34C;color:#fff;margin-bottom:9px">Reparar y abrir la app</button>
  <a href="./" style="display:block;text-align:center;border-radius:12px;padding:14px 0;font:800 15px -apple-system,system-ui,sans-serif;background:#eceff3;color:#1a1d24;text-decoration:none">Solo abrir la app</a>
  <div id="log" style="font:600 12px/1.5 ui-monospace,Menlo,monospace;color:#8A93A6;margin-top:16px;word-break:break-all"></div>
</div>
<script>
var est = document.getElementById("estado"), log = document.getElementById("log");
function di(t) { log.textContent += t + "\\n"; }
fetch("./index.html?nc=" + Date.now(), { cache: "no-store" }).then(function (r) {
  return r.text().then(function (t) {
    var m = t.match(/APP_VERSION = "([0-9.]+)"/);
    est.textContent = r.ok
      ? (m ? "El servidor está sirviendo la versión " + m[1] + ". Esta app espera la " + ${JSON.stringify(appVersion)} + "."
           : "El servidor contesta pero lo que manda no parece la app (" + t.length + " caracteres).")
      : "El servidor contesta con un error " + r.status + ".";
  });
}).catch(function (e) { est.textContent = "No se ha podido hablar con el servidor: " + e.message; });
document.getElementById("rep").onclick = function () {
  var p = Promise.resolve();
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    p = navigator.serviceWorker.getRegistrations().then(function (rs) {
      di("service workers encontrados: " + rs.length);
      return Promise.all(rs.map(function (r) { return r.unregister(); }));
    });
  }
  p.then(function () {
    if (window.caches && caches.keys) return caches.keys().then(function (k) {
      di("cachés borradas: " + k.length);
      return Promise.all(k.map(function (x) { return caches.delete(x); }));
    });
  }).then(function () {
    di("listo, abriendo la app…");
    setTimeout(function () { location.href = "./?reparada=" + Date.now(); }, 700);
  }).catch(function (e) { di("error: " + e.message); });
};
</script></body></html>`;
await writeFile(OUT + "/rescate.html", rescate);

/* v4.82 — QUITAR LA REDIRECCIÓN DESDE EL SERVIDOR.
   El arreglo del service worker de la v4.81 es el correcto, pero llega tarde a un teléfono que ya
   está encerrado: el que manda ahí es el service worker VIEJO, la navegación muere antes de ejecutar
   nada, y sin ejecutar nada no hay quien pida el service worker nuevo. El bucle se cierra solo.

   Así que se corta por el otro lado: si Cloudflare deja de redirigir, el service worker viejo deja
   de recibir respuestas redirigidas y todo vuelve a funcionar sin que el teléfono tenga que hacer
   nada. `_redirects` con código 200 no es una redirección sino un servir-en-el-sitio, que es
   justo lo que hace falta.

   GitHub Pages ignora este archivo (nunca redirigió), así que no le afecta. */
await writeFile(OUT + "/_redirects", [
  "# Cloudflare Pages redirige por su cuenta /algo.html -> /algo (301), y un service worker NO",
  "# puede devolver una respuesta redirigida: el navegador la rechaza y la app se queda en blanco.",
  "# Con 200 se sirve el contenido en su sitio, sin redirección de por medio.",
  "/index.html    /            200",
  "/rescate.html  /rescate     200",
  "",
].join("\n"));
for (const f of icons) await copyFile(f, OUT + "/" + f);
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  await copyFile("vendor/" + f, OUT + "/vendor/" + f);

console.log("build " + version + " ok — app v" + appVersion + ", index " + page.length + " B, app.js " + compiled.code.length + " B, iconos: " + icons.join(", "));
