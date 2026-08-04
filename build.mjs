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
let page = html.slice(0, start) + '<script src="./app.js"></script>' + html.slice(end + "</script>".length);

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

/* ---- 3. service worker: red primero, caché como respaldo ----
 * Con red se comporta como hoy (siempre lo último, y el auto-update sigue funcionando);
 * sin red sirve la última copia buena. Solo cachea los archivos de la propia app — las
 * peticiones con ?_cachebust del auto-update pasan de largo sin ensuciar la caché. */
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
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && PATHS.has(clean.pathname)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(clean.href, copy));
      }
      return res;
    }).catch(() => caches.match(clean.href)
      .then((hit) => hit || caches.match("./index.html")))
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
for (const f of icons) await copyFile(f, OUT + "/" + f);
for (const f of ["react.production.min.js", "react-dom.production.min.js"])
  await copyFile("vendor/" + f, OUT + "/vendor/" + f);

console.log("build " + version + " ok — app v" + appVersion + ", index " + page.length + " B, app.js " + compiled.code.length + " B, iconos: " + icons.join(", "));
