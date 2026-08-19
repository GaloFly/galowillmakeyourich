/* ---------------------------------------------------------------------------
   BUSCADOR DE PUTS — seis plazos y los vencimientos plegados (v5.01)

   Victor: *"que aparezcan los diferentes DTE colapsados y que saque también a 90 DTE, 180, 360"*.

   Lo que se comprueba, y por qué cada cosa:

     · SEIS plazos, no tres. Con los de antes (30/45/60) no se veía si compensa irse lejos.
     · TRES peticiones de cadena, no una ni seis. El puente sirve 90 días por llamada —Futu manda
       30 y el puente agrupa tres, contra un cupo de la cuenta ENTERA—, así que pedir 360 días de
       una vez lo rechaza (es el fallo que se publicó en la v4.97) y pedir una por plazo gastaría
       el doble de lo necesario. Se agrupan en las mínimas ventanas de 90.
     · Los vencimientos PLEGADOS, con la mejor cifra de cada uno EN LA CABECERA. Si la cabecera no
       la enseñara habría que abrir los seis para compararlos, y plegarlos no serviría de nada.

     node pruebas/buscador-puts.mjs
--------------------------------------------------------------------------- */
import { createServer } from "http";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const cargarPlaywright = async () => {
  try { return await import("playwright"); } catch (e) {}
  try {
    const global = execSync("npm root -g", { encoding: "utf8" }).trim();
    return await import(pathToFileURL(path.join(global, "playwright", "index.mjs")).href);
  } catch (e) {}
  console.error("Falta Playwright. Instálalo con:  npm i -g playwright");
  process.exit(1);
};
const { chromium, devices } = await cargarPlaywright();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(AQUI, "..", "dist");
const D = process.env.SALIDA || "/tmp";
const PUERTO = 8324;
const TIPO = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css", ".svg": "image/svg+xml" };
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("No hay dist/ compilado. Ejecuta primero: npm run build");
  process.exit(1);
}
const servidor = createServer((req, res) => {
  const u = decodeURIComponent((req.url || "/").split("?")[0]);
  const f = path.join(DIST, u === "/" ? "/index.html" : u);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "Content-Type": TIPO[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => servidor.listen(PUERTO, r));
const URL_APP = "http://localhost:" + PUERTO + "/index.html";

const dentroDe = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* DOS tickers, porque la escalera de vencimientos no es igual en todos y ahí estuvo el fallo:
     · MRVL — la escalera COMPLETA, con uno pegado a cada plazo pedido, hasta el año.
     · RDDT — la escalera REAL de la mayoría: semanales cerca, mensuales unos meses, y NADA
       a un año. Es el caso de las capturas de Victor del 19-ago-2026. */
const MUNDOS = {
  MRVL: { spot: 215.73, k0: 130, k1: 220, paso: 5,
          dtes: [8, 15, 29, 36, 43, 57, 64, 92, 120, 178, 211, 360] },
  RDDT: { spot: 158.25, k0: 95, k1: 160, paso: 5,
          dtes: [9, 16, 23, 30, 37, 44, 58, 93, 149, 212] },
};
const contratos = {}, opciones = {}, VTOS = {};
Object.entries(MUNDOS).forEach(([tkr, m]) => {
  VTOS[tkr] = m.dtes.map(dentroDe);
  contratos[tkr] = [];
  VTOS[tkr].forEach((v, i) => {
    for (let k = m.k0; k <= m.k1; k += m.paso) {
      const codigo = "US." + tkr + v.slice(2).replace(/-/g, "") + "P" + k * 1000;
      contratos[tkr].push({ codigo, tipo: "PUT", strike: k, vencimiento: v });
      const otm = (m.spot - k) / m.spot;
      /* delta que se hace menos negativa cuanto más lejos está el strike, y prima que crece con el plazo */
      const delta = -Math.max(0.02, 0.5 - otm * 2.2);
      const px = Math.max(0.2, m.spot * 0.09 * Math.sqrt(m.dtes[i] / 365) * Math.exp(-3.4 * otm));
      opciones[codigo] = { codigo, ultimo: px, medio: px, bid: px - 0.1, ask: px + 0.1,
        volumen: 120, interes_abierto: 3400, iv: 83.7, delta,
        gamma: 0.01, theta: -0.05, vega: 0.2, fecha_dato: "2026-08-19 18:10:00" };
    }
  });
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let cadenas = [];
const deCodigo = (c) => String(c || "").replace("US.", "").split(",")[0];
const finnhub = (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 100, dp: 0, pc: 100, h: 100 }) });
const puente = (route) => {
  const u = new URL(route.request().url());
  const J = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
  const tkr = deCodigo(u.searchParams.get("codigo") || u.searchParams.get("codigos"));
  const m = MUNDOS[tkr];
  if (u.pathname === "/cotiza") {
    if (!m) return J({ ok: true, cotizaciones: {} });
    return J({ ok: true, cotizaciones: { ["US." + tkr]: { ultimo: m.spot, cierre_anterior: m.spot * 0.98 } } });
  }
  if (u.pathname === "/subyacente") return J({ ok: true, subyacente: { codigo: "US." + tkr, nombre: tkr, iv: 83.71, hv_30d: 89.74, iv_rank: 57.2 } });
  if (u.pathname === "/cadena") {
    const desde = u.searchParams.get("desde"), hasta = u.searchParams.get("hasta");
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000);
    cadenas.push(dias);
    /* EL PUENTE FALSO, TAN ESTRICTO COMO EL DE VERDAD: más de 90 días se rechaza */
    if (dias > 90) return route.fulfill({ status: 400, contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "El rango es demasiado largo: como mucho 90 días." }) });
    const dentro = (VTOS[tkr] || []).filter((v) => v >= desde && v <= hasta);
    return J({ ok: true, contratos: (contratos[tkr] || []).filter((c) => dentro.includes(c.vencimiento)),
               total: (contratos[tkr] || []).length, vencimientos: dentro });
  }
  if (u.pathname === "/opciones") return J({ ok: true, opciones, pedidos: 0, de_cache: 0, sin_datos: [] });
  return J({ ok: true });
};
const rutas = [[/finnhub\.io/, finnhub], [/puente\.alphavext\.com/, puente]];

const SEMILLA = () => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "120000", margin: "46000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "comparador");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
};
/* los mismos pasos en las dos anchuras: cerrar el aviso, pestaña Puts, teclear el ticker, Buscar */
const PASOS = (tkr) => [
  { ms: 300, f: () => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); } },
  { ms: 600, f: () => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Puts"); if (b) b.click(); } },
  { ms: 300, arg: tkr, f: (t) => { const i = Array.from(document.querySelectorAll("input")).find((x) => /NVDA|Ticker/.test(x.placeholder || "")); if (i) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, t); i.dispatchEvent(new Event("input", { bubbles: true })); } } },
  { ms: 3500, f: () => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Buscar/.test(x.textContent || "") && x.offsetParent !== null); if (b) b.click(); } },
];
const cabecerasDe = (p) => p.evaluate(() => Array.from(document.querySelectorAll("button"))
  .filter((b) => /^[▾▸]/.test((b.innerText || "").trim()))
  .map((b) => (b.innerText || "").replace(/\n/g, " ").trim()));

const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
for (const [re, h] of rutas) await ctx.route(re, h);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript(SEMILLA);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2400);
for (const paso of PASOS("MRVL")) { await page.evaluate(paso.f, paso.arg); await page.waitForTimeout(paso.ms); }

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
console.log("=== lo que cuesta la búsqueda ===");
console.log("  peticiones de cadena, en días:", cadenas.join(" · "));
ok(cadenas.length === 3, "TRES peticiones de cadena para seis plazos (" + cadenas.length + ")");
ok(cadenas.every((d) => d <= 90), "y ninguna se pasa de los 90 días que admite el puente");
ok(Math.max(...cadenas) > 60, "la primera agrupa varios plazos en vez de pedir uno por uno (" + Math.max(...cadenas) + " días)");

/* los plazos se leen de las CABECERAS, no del texto de la pantalla: la propia tarjeta explica
   en su descripción a qué plazos busca, y ese "60 días" contaría como si fuera un grupo */
const cabeceras = await cabecerasDe(page);

console.log("\n=== los seis plazos ===");
const dtesEnPantalla = cabeceras.map((c) => parseInt((c.match(/(\d+) días/) || [0, "0"])[1], 10));
console.log("  plazos que salen:", dtesEnPantalla.join(" · "));
[30, 45, 60, 90, 180, 360].forEach((obj) => {
  const cerca = dtesEnPantalla.some((d) => Math.abs(d - obj) <= 20);
  ok(cerca, "hay un vencimiento cerca de los " + obj + " días");
});
ok(dtesEnPantalla.length === 6, "y son SEIS grupos, uno por plazo pedido (" + dtesEnPantalla.length + ")");

console.log("\n=== plegados, pero legibles ===");
cabeceras.forEach((c) => console.log("   ·", c));
ok(cabeceras.length === 6, "seis cabeceras plegables (" + cabeceras.length + ")");
ok(cabeceras.filter((c) => c.startsWith("▾")).length === 1, "solo la primera abierta: entrar y ver seis títulos vacíos tampoco sirve");
ok(cabeceras.filter((c) => c.startsWith("▸")).length === 5, "y las otras cinco plegadas");
ok(cabeceras.every((c) => /%/.test(c)), "TODAS enseñan su mejor cifra sin abrirlas — si no, habría que abrir las seis para comparar");
ok(cabeceras.every((c) => /P\d/.test(c)), "y con el strike de esa mejor, que es lo que se compara");

/* LA vista que pidió Victor: los seis plazos plegados y comparables de un vistazo */
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^▾/.test((x.innerText || "").trim()));
  if (b) { b.click(); b.scrollIntoView({ block: "center" }); }
});
await page.waitForTimeout(500);
await page.screenshot({ path: D + "/puts-plegados.png" });
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^▸/.test((x.innerText || "").trim()));
  if (b) b.click();
});
await page.waitForTimeout(400);

/* abrir uno plegado tiene que enseñar sus filas */
const antes = (await page.evaluate(() => document.body.innerText)).length;
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).filter((x) => /^▸/.test((x.innerText || "").trim()))[0];
  if (b) b.click();
});
await page.waitForTimeout(500);
const despues = (await page.evaluate(() => document.body.innerText)).length;
ok(despues > antes + 100, "y al tocar una plegada se abre de verdad (" + antes + " → " + despues + " caracteres)");

/* la captura, con los grupos a la vista: medir no basta, hay que MIRAR el dibujo */
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^[▾▸]/.test((x.innerText || "").trim()));
  if (b) b.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(400);
await page.screenshot({ path: D + "/puts-plazos.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

/* ---------------------------------------------------------------------------
   EL CASO DE LAS CAPTURAS DEL 19-AGO-2026 (v5.01, arreglado en la v5.02)

   Victor: *"no están saliendo las de 360 y en RDDT no más de 90"*. RDDT tiene semanales cerca,
   mensuales unos meses y NADA a un año — que es la escalera normal, no una rareza.

   La v5.01 hacía dos cosas mal con eso, y la segunda era la grave:
     1. buscaba el de 360 solo entre los días 348 y 375, donde casi nunca hay vencimiento;
     2. y como no encontraba, RELLENABA ese hueco con el vencimiento libre más cercano — que era
        el de 23 días. En pantalla salían seis grupos, parecían los seis plazos pedidos, y dos de
        ellos eran vencimientos cortos disfrazados. Ese es el fallo que hay que no repetir jamás:
        una lista corta y honesta es mejor que una completa y falsa.
--------------------------------------------------------------------------- */
console.log("\n=== RDDT: sin vencimientos a un año ===");
cadenas = [];
const ctxR = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
for (const [re, h] of rutas) await ctxR.route(re, h);
const pr = await ctxR.newPage();
const erroresR = [];
pr.on("pageerror", (e) => erroresR.push(e.message));
await pr.addInitScript(SEMILLA);
await pr.goto(URL_APP, { waitUntil: "load" });
await pr.waitForTimeout(2400);
for (const paso of PASOS("RDDT")) { await pr.evaluate(paso.f, paso.arg); await pr.waitForTimeout(paso.ms); }
const cabR = await cabecerasDe(pr);
cabR.forEach((c) => console.log("   ·", c));
const dtesR = cabR.map((c) => parseInt((c.match(/(\d+) días/) || [0, "0"])[1], 10));
ok(cadenas.length === 3, "sigue costando TRES cadenas aunque falte un plazo (" + cadenas.length + ")");
ok(dtesR.length === 5, "salen CINCO grupos, no seis: el de 360 no existe y no se inventa (" + dtesR.length + ")");
ok(!dtesR.some((d) => d < 25), "y NINGÚN vencimiento corto ocupa el sitio del que falta (" + dtesR.join(" · ") + ")");
ok(dtesR.some((d) => Math.abs(d - 180) <= 44), "el de 180 SÍ sale ahora, con la holgura ancha (" + dtesR.join(" · ") + ")");
const textoR = await pr.evaluate(() => document.body.innerText);
ok(/no tiene vencimientos cerca de 360 días/.test(textoR), "y se DICE en pantalla cuál falta, en vez de que desaparezca en silencio");
ok(!erroresR.length, "sin errores de JS " + JSON.stringify(erroresR.slice(0, 2)));
await pr.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /^[▾▸]/.test((x.innerText || "").trim())); if (b) b.scrollIntoView({ block: "center" }); });
await pr.waitForTimeout(300);
await pr.screenshot({ path: D + "/puts-rddt.png" });

/* v5.00 se fue entera en desbordes horizontales, y la cabecera nueva mete cuatro cosas en una
   línea. En el iPhone más estrecho que usa nadie (320) no se puede salir NI UN pixel. Contexto
   aparte y no setViewportSize: la app re-ancla el viewport al arrancar y mediría el de antes. */
console.log("\n=== y que quepa en un iPhone estrecho ===");
const ctx2 = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 320, height: 700 },
  screen: { width: 320, height: 700 }, serviceWorkers: "block" });
for (const [re, h] of rutas) await ctx2.route(re, h);
const p2 = await ctx2.newPage();
await p2.addInitScript(SEMILLA);
await p2.goto(URL_APP, { waitUntil: "load" });
await p2.waitForTimeout(2400);
for (const paso of PASOS("MRVL")) { await p2.evaluate(paso.f, paso.arg); await p2.waitForTimeout(paso.ms); }
const fuera = await p2.evaluate(() => {
  const w = document.documentElement.clientWidth;
  /* los carruseles que se deslizan a propósito no cuentan: ahí salirse es la gracia */
  const enCarrusel = (e) => { for (let a = e; a; a = a.parentElement) {
    const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  return Array.from(document.querySelectorAll("body *"))
    .filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > w + 1 && !enCarrusel(e))
    .map((e) => (e.tagName + " " + Math.round(e.getBoundingClientRect().right) + "px: " + (e.innerText || "").slice(0, 40)).replace(/\n/g, " "));
});
fuera.slice(0, 5).forEach((f) => console.log("   ·", f));
ok(!fuera.length, "a 320 px NADA se sale de la pantalla (" + fuera.length + " elementos fuera)");
await p2.screenshot({ path: D + "/puts-320.png" });

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
