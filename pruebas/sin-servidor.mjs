/* ---------------------------------------------------------------------------
   RED DE SEGURIDAD PARA QUIEN NO TIENE SERVIDOR PROPIO

   Victor (13-ago-2026): *"esto a la gente que no tenga el servidor le va a afectar… si vamos a
   estar tocando cómo se graban los iron condors y ellos no tienen acceso a esto, les va a salir
   todo mal, ¿no? ¿cómo podemos hacer para evitarlo?"*

   Esta prueba carga una cartera de ejemplo (pruebas/datos-amigo.mjs) SIN configurar el servidor,
   lee todas las cifras de la pantalla y las compara con una línea base guardada. Si alguna se
   mueve un solo céntimo, falla y NO se publica.

   También comprueba lo otro que le preocupaba: que la app **no llame** al puente ni una sola vez
   cuando no hay servidor configurado.

     npm run prueba            → comprueba contra la línea base
     npm run prueba -- --fijar → REESCRIBE la línea base (acto deliberado; explicarlo en el CHANGELOG)

   Requiere `dist/` compilado (npm run build) y sirve esa carpeta él solo.
--------------------------------------------------------------------------- */
import { createServer } from "http";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { POSICIONES, CUENTAS, COTIZACIONES, HOY } from "./datos-amigo.mjs";

/* Playwright NO se añade a las dependencias del proyecto a propósito: `npm ci` lo instalaría en
   cada compilación de Cloudflare y de GitHub Actions —más de 100 MB— solo para no usarlo nunca.
   Esta prueba se ejecuta a mano antes de publicar, así que se busca donde esté instalado. */
const cargarPlaywright = async () => {
  try { return await import("playwright"); } catch (e) {}
  try {
    const global = execSync("npm root -g", { encoding: "utf8" }).trim();
    return await import(pathToFileURL(path.join(global, "playwright", "index.mjs")).href);
  } catch (e) {}
  console.error("Falta Playwright. Instálalo con:  npm i -g playwright");
  console.error("(a propósito no es dependencia del proyecto: haría más lenta cada compilación)");
  process.exit(1);
};
const { chromium, devices } = await cargarPlaywright();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");
const DIST = path.join(RAIZ, "dist");
const BASE = path.join(AQUI, "linea-base.json");
const FIJAR = process.argv.includes("--fijar");
const PUERTO = 8321;

const TIPO = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css", ".svg": "image/svg+xml" };

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("No hay dist/ compilado. Ejecuta primero: npm run build");
  process.exit(1);
}

/* servidor de ficheros mínimo para dist/ */
const servidor = createServer((req, res) => {
  const u = decodeURIComponent((req.url || "/").split("?")[0]);
  const f = path.join(DIST, u === "/" ? "/index.html" : u);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": TIPO[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => servidor.listen(PUERTO, r));

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await navegador.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });

const llamadasAlPuente = [];
const errores = [];

/* Finnhub simulado con precios fijos */
await ctx.route(/finnhub\.io/, (route) => {
  const s = new URL(route.request().url()).searchParams.get("symbol");
  const px = COTIZACIONES[s];
  if (px == null) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 0 }) });
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ c: px, dp: 0, pc: px, h: px, l: px, o: px }) });
});
/* CUALQUIER llamada a un puente queda registrada: aquí no debería haber ninguna */
await ctx.route(/puente\.|\/opcion|\/cotiza|\/cadena|\/salud/, (route) => {
  llamadasAlPuente.push(route.request().url());
  route.abort("connectionrefused");
});

const page = await ctx.newPage();
page.on("pageerror", (e) => errores.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource/.test(m.text())) errores.push("consola: " + m.text()); });

await page.addInitScript(([pos, acc, hoy]) => {
  /* reloj congelado: hay cifras que dependen de los días a vencimiento y la prueba tiene que dar
     lo mismo hoy que dentro de seis meses */
  const FIJO = new Date(hoy).getTime();
  const Real = Date;
  function Congelada(...a) { return a.length ? new Real(...a) : new Real(FIJO); }
  Congelada.prototype = Real.prototype;
  Congelada.now = () => FIJO;
  Congelada.parse = Real.parse;
  Congelada.UTC = Real.UTC;
  window.Date = Congelada;

  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify(acc));
  localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
  localStorage.setItem("bloques_show_pnl", "1");
  /* SIN bloques_puente_v1 a propósito: este usuario no tiene servidor */
}, [POSICIONES, CUENTAS, HOY]);

await page.goto(`http://localhost:${PUERTO}/index.html`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(3500); /* deja terminar la descarga automática de precios */

/* --------- captura de cifras ---------
   Se capturan TODOS los importes y porcentajes de cada pestaña, en el orden en que salen. Es un
   retrato numérico de la pantalla: inmune a que cambie un texto ("Riesgo plausible" → otra cosa),
   pero sensible a que se mueva un solo número, que es justo lo que hay que vigilar.
   Se guardan además las etiquetas del P&L de cada fila (auto / REAL / MANUAL): si una posición
   pasara a decir REAL sin servidor, eso sería el fallo más grave posible y aquí saltaría. */
const cifras = {};
const retrato = () => page.evaluate(() => {
  const t = document.body.innerText;
  return {
    numeros: (t.match(/[+-]?\$[\d.,]+|[+-]?[\d.,]+%/g) || []).join(" "),
    etiquetas: (t.match(/P&L(?: · (?:REAL|MANUAL))?(?=\n)/g) || []).join(" · "),
    lineas: t.split("\n").filter((x) => /^[A-Z]{1,5}$/.test(x.trim())).join(","),
  };
});

const pestanas = [[/^Resumen$/, "resumen"], [/B0 · Liquidez/, "B0"], [/B1 · Core/, "B1"],
                  [/B2 · Income/, "B2"], [/B3 · High Risk/, "B3"], [/^Exposición$/, "exposicion"]];
const vistos = new Set();
for (const [etiqueta, clave] of pestanas) {
  const tab = page.getByText(etiqueta).first();
  if (!(await tab.count())) { cifras["pestaña." + clave] = "(NO ENCONTRADA)"; continue; }
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await page.waitForTimeout(800);
  const r = await retrato();
  cifras["pestaña." + clave + ".importes"] = r.numeros;
  cifras["pestaña." + clave + ".etiquetasPnL"] = r.etiquetas;
  cifras["pestaña." + clave + ".tickers"] = r.lineas;
  /* control de que las pestañas de verdad enseñan cosas distintas: si dos dieran exactamente lo
     mismo, la prueba estaría midiendo la misma pantalla cuatro veces y no valdría para nada */
  if (vistos.has(r.numeros) && r.numeros) cifras["pestaña." + clave + ".AVISO"] = "idéntica a otra pestaña — la prueba no está navegando";
  vistos.add(r.numeros);
}

await page.screenshot({ path: path.join(AQUI, "ultima-ejecucion.png") });
await navegador.close();
servidor.close();

/* --------- comparación --------- */
let fallos = 0;

if (FIJAR) {
  fs.writeFileSync(BASE, JSON.stringify(cifras, null, 2) + "\n");
  console.log(`Línea base REESCRITA con ${Object.keys(cifras).length} cifras → pruebas/linea-base.json`);
  console.log("Explica en el CHANGELOG por qué cambió, o nadie sabrá si fue a propósito.\n");
  Object.entries(cifras).forEach(([k, v]) => console.log(`  ${k.padEnd(38)} ${v}`));
} else if (!fs.existsSync(BASE)) {
  console.error("No hay línea base. Créala con: npm run prueba -- --fijar");
  process.exit(1);
} else {
  const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
  const claves = [...new Set([...Object.keys(base), ...Object.keys(cifras)])].sort();
  for (const k of claves) {
    const antes = base[k], ahora = cifras[k];
    if (String(antes) === String(ahora)) continue;
    fallos++;
    console.log(`  ✗ ${k}`);
    console.log(`      línea base: ${antes === undefined ? "(no existía)" : antes}`);
    console.log(`      ahora:      ${ahora === undefined ? "(ha desaparecido)" : ahora}`);
  }
  console.log("");
  if (fallos) {
    console.log(`FALLA: ${fallos} de ${claves.length} cifras se han movido para un usuario SIN servidor propio.`);
    console.log("Si el cambio es a propósito: npm run prueba -- --fijar, y explícalo en el CHANGELOG.");
  } else {
    console.log(`OK: las ${claves.length} cifras salen idénticas para un usuario sin servidor propio.`);
  }
}

if (llamadasAlPuente.length) {
  console.log(`\n✗ La app llamó ${llamadasAlPuente.length} vez/veces a un servidor SIN tenerlo configurado:`);
  llamadasAlPuente.slice(0, 5).forEach((u) => console.log("    " + u));
  fallos++;
}
if (errores.length) {
  console.log("\n✗ Errores en la consola del navegador:");
  errores.slice(0, 5).forEach((e) => console.log("    " + e));
  fallos++;
}

process.exit(FIJAR ? 0 : fallos ? 1 : 0);
