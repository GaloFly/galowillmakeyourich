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

/* TRES tickers, con escaleras REALES y ninguna cómoda — que ahí estuvo el fallo tres veces:

     · MRVL — la escalera completa, con uno pegado a cada plazo pedido.
     · RDDT — LA DE VERDAD, la que mandó Victor desde Moomoo el 19-ago-2026. Fíjate en dos cosas:
       tiene 302 días (17-jun-27) Y 394 (17-sep-27), o sea que a un año hay DOS... pero el de
       394 sale en Moomoo con la IV en blanco: EXISTE Y NO COTIZA. Va en `sinPrecio` para que la
       prueba reproduzca eso exactamente, porque es lo que hacía desaparecer el plazo largo.
     · PEQ — un valor pequeño de verdad sin nada pasados los seis meses.

   `sinPrecio` es la pieza clave: un puente falso que da precio de TODO no habría cazado esto
   jamás — igual que el que decía que sí a rangos de 120 días no cazó el fallo de la v4.97. */
const MUNDOS = {
  MRVL: { spot: 215.73, k0: 130, k1: 220, paso: 5,
          dtes: [8, 15, 29, 36, 43, 57, 64, 92, 120, 178, 211, 302, 394] },
  RDDT: { spot: 158.25, k0: 95, k1: 160, paso: 5, sinPrecio: [394],
          dtes: [30, 37, 44, 58, 93, 121, 149, 212, 302, 394, 520, 667, 758, 849] },
  PEQ: { spot: 42.5, k0: 20, k1: 42, paso: 2,
         dtes: [9, 16, 23, 30, 37, 44, 58, 93, 149] },
  /* el caso peor: a un año hay vencimiento y es el ÚNICO, y no cotiza. No se puede caer en
     otro, así que el plazo se queda sin grupo — y eso hay que DECIRLO, porque no es lo mismo
     que no haberlo: esto se arregla subiendo la delta, aquello no se arregla. */
  MUDO: { spot: 80, k0: 50, k1: 80, paso: 5, sinPrecio: [340],
          dtes: [16, 30, 44, 58, 93, 149, 340] },
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
      /* el vencimiento que existe pero no cotiza sencillamente no entra en la tabla de precios,
         que es justo lo que hace el servidor de verdad con el 17-sep-27 de RDDT */
      if ((m.sinPrecio || []).includes(m.dtes[i])) continue;
      opciones[codigo] = { codigo, ultimo: px, medio: px, bid: px - 0.1, ask: px + 0.1,
        volumen: 120, interes_abierto: 3400, iv: 83.7, delta,
        gamma: 0.01, theta: -0.05, vega: 0.2, fecha_dato: "2026-08-19 18:10:00" };
    }
  });
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let cadenas = [];
let RUTA_NUEVA = true;   /* el puente conoce /vencimientos */
let pidioVencimientos = 0;
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
  if (u.pathname === "/vencimientos") {
    /* un puente ANTERIOR a la v5.07 no conoce esta ruta: contesta 501 y la app tiene que
       seguir funcionando por el camino de las ventanas, no quedarse sin buscador */
    if (!RUTA_NUEVA) return route.fulfill({ status: 501, contentType: "application/json",
      body: JSON.stringify({ ok: false, sin_ruta: true, error: "Este OpenD no tiene get_option_expiration_date." }) });
    pidioVencimientos++;
    return J({ ok: true, vencimientos: (VTOS[tkr] || []).slice(), total: (VTOS[tkr] || []).length });
  }
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
[30, 45, 60, 90, 180].forEach((obj) => {
  const cerca = dtesEnPantalla.some((d) => Math.abs(d - obj) <= 20);
  ok(cerca, "hay un vencimiento cerca de los " + obj + " días");
});
ok(dtesEnPantalla.some((d) => d >= 302 && d <= 390),
  "y uno a un año, dentro de la ventana 302-390 (" + dtesEnPantalla.join(" · ") + ")");
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

/* una búsqueda entera en un contexto limpio, que es lo que hacen los tres escenarios de abajo */
const buscar = async (tkr, extra) => {
  cadenas = [];
  const c = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  for (const [re, h] of rutas) await c.route(re, h);
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(SEMILLA);
  if (extra) await p.addInitScript(extra);
  await p.goto(URL_APP, { waitUntil: "load" });
  await p.waitForTimeout(2400);
  for (const paso of PASOS(tkr)) { await p.evaluate(paso.f, paso.arg); await p.waitForTimeout(paso.ms); }
  const cab = await cabecerasDe(p);
  cab.forEach((x) => console.log("   ·", x));
  return { p, errs, cab, dtes: cab.map((x) => parseInt((x.match(/(\d+) días/) || [0, "0"])[1], 10)),
           texto: await p.evaluate(() => document.body.innerText), cadenas: cadenas.slice() };
};

/* ---------------------------------------------------------------------------
   CON UN PUENTE VIEJO, EL BUSCADOR SIGUE FUNCIONANDO (v5.07)

   La ruta /vencimientos es nueva. Los servidores que no se hayan reinstalado no la conocen y
   contestan 501 — y eso NO puede dejar a nadie sin buscador: se vuelve al camino de las
   ventanas, que es el de la v5.06 y funciona. Regla de la casa: los campos y rutas nuevos son
   opcionales, y si faltan la cosa se comporta como antes.
--------------------------------------------------------------------------- */
console.log("\n=== con un puente que no conoce la ruta nueva ===");
RUTA_NUEVA = false;
const V = await buscar("RDDT");
RUTA_NUEVA = true;
ok(V.dtes.length === 6, "salen los seis plazos igual (" + V.dtes.length + ")");
ok(V.dtes.includes(302), "incluido el de 302 días (" + V.dtes.join(" · ") + ")");
ok(V.cadenas.length === 3, "por el camino de antes: tres ventanas de cadena (" + V.cadenas.length + ")");
ok(!V.errs.length, "sin errores de JS " + JSON.stringify(V.errs.slice(0, 2)));

/* ---------------------------------------------------------------------------
   EL BORDE DE LA VENTANA NO PUEDE DEPENDER DE LA HORA (v5.06)

   El 17-jun-27 de RDDT cae a 302 días EXACTOS. Contando los días desde "ahora" en vez de desde
   medianoche, mide 301,5 por la mañana y 301,2 por la tarde: redondea a 302 o a 301 según cuándo
   busques, y con la ventana empezando ahí, el mismo contrato entraba o no entraba según la hora.

   Se busca a tres horas muy distintas del mismo día y se exige EL MISMO resultado. Sin reloj
   congelado esto no se puede comprobar: se le cambia la hora al navegador.
--------------------------------------------------------------------------- */
console.log("\n=== el mismo resultado a cualquier hora ===");
const aLaHora = async (hhmm) => {
  const c = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 },
    serviceWorkers: "block", timezoneId: "Europe/Madrid" });
  for (const [re, h] of rutas) await c.route(re, h);
  const p = await c.newPage();
  await p.addInitScript(SEMILLA);
  /* se adelanta el reloj del navegador a esa hora de HOY, sin tocar el día */
  await p.addInitScript((hm) => {
    const R = Date;
    const base = new R();
    const fijo = new R(R.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hm[0], hm[1])).getTime();
    const F = function (...a) { return a.length ? new R(...a) : new R(fijo); };
    F.now = () => fijo; F.parse = R.parse; F.UTC = R.UTC; F.prototype = R.prototype;
    window.Date = F;
  }, hhmm);
  await p.goto(URL_APP, { waitUntil: "load" });
  await p.waitForTimeout(2400);
  for (const paso of PASOS("RDDT")) { await p.evaluate(paso.f, paso.arg); await p.waitForTimeout(paso.ms); }
  const cab = await cabecerasDe(p);
  await c.close();
  return cab.map((x) => parseInt((x.match(/(\d+) días/) || [0, "0"])[1], 10)).join(" · ");
};
const aLas = {};
for (const hm of [[1, 0], [12, 30], [23, 30]]) aLas[hm[0]] = await aLaHora(hm);
Object.entries(aLas).forEach(([h, v]) => console.log("   a las " + h + "h:", v));
const distintos = new Set(Object.values(aLas));
ok(distintos.size === 1, "los mismos plazos a la 1h, a las 12:30 y a las 23:30 (" + distintos.size + " resultados distintos)");
ok(Object.values(aLas).every((v) => v.includes("302")), "y el de 302 días entra A LAS TRES HORAS, no según el redondeo");

/* ---------------------------------------------------------------------------
   EL CASO DE LAS CAPTURAS DEL 19-AGO-2026, EN DOS ACTOS

   Acto 1 (v5.01): *"no están saliendo las de 360 y en RDDT no más de 90"*. Se buscaba el plazo
   largo solo entre los días 348 y 375 y, al no encontrar, se RELLENABA el hueco con el
   vencimiento libre más cercano — el de 23 días. Salían seis grupos con pinta de ser los seis
   pedidos y dos eran cortos disfrazados.

   Acto 2 (v5.02): con el hueco ya vacío en vez de relleno, la app decía que RDDT "no tiene
   vencimientos cerca de 360 días". Victor: *"no es verdad, RDDT sí tiene LEAPS"*. Y las tiene:
   enero de 2027 y enero de 2028. Lo que no tiene es un vencimiento A 360 DÍAS — la ventana caía
   entre julio y septiembre de 2027, en el hueco entre los dos eneros. El plazo largo no es un
   número de días: es el tercer viernes de enero.
--------------------------------------------------------------------------- */
console.log("\n=== RDDT, con su escalera de Moomoo ===");
pidioVencimientos = 0;
const R = await buscar("RDDT");
ok(pidioVencimientos === 1, "se pregunta la escalera UNA vez en vez de adivinar dónde está (" + pidioVencimientos + ")");
ok(R.cadenas.length <= 3, "y las cadenas no suben de tres (" + R.cadenas.join(" · ") + " días)");
ok(R.dtes.length === 6, "salen los SEIS plazos (" + R.dtes.length + ")");
ok(R.dtes.includes(302), "y el largo es el de 302 días, que SÍ cotiza (" + R.dtes.join(" · ") + ")");
ok(!R.dtes.includes(394), "y NO el de 394, que existe pero tiene la IV en blanco en Moomoo");
ok(!R.dtes.some((d) => d < 25), "sin ningún vencimiento corto colado (" + R.dtes.join(" · ") + ")");
ok(R.dtes.includes(149), "y el de 180 cae en el de enero, a 149 días (" + R.dtes.join(" · ") + ")");
ok(!/no tiene vencimientos/.test(R.texto), "sin avisar de que falte nada, porque no falta nada");
ok(!R.errs.length, "sin errores de JS " + JSON.stringify(R.errs.slice(0, 2)));
await R.p.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /^[\u25be\u25b8]/.test((x.innerText || "").trim())); if (b) b.scrollIntoView({ block: "center" }); });
await R.p.waitForTimeout(300);
await R.p.screenshot({ path: D + "/puts-rddt.png" });

/* y el valor pequeño que de verdad no tiene nada largo: ahí el hueco sigue teniendo que
   quedarse vacío y decirse, que es lo que arregló la v5.02 */
console.log("\n=== PEQ: sin nada pasados los seis meses ===");
const P = await buscar("PEQ");
ok(P.dtes.length === 5, "salen CINCO grupos, no seis: no se inventa el que falta (" + P.dtes.length + ")");
ok(!P.dtes.some((d) => d < 25), "y NINGÚN vencimiento corto ocupa el sitio del que falta (" + P.dtes.join(" · ") + ")");
ok(/no tiene vencimientos cerca de 360 días/.test(P.texto), "y se dice cuál falta");
ok(!P.errs.length, "sin errores de JS " + JSON.stringify(P.errs.slice(0, 2)));

console.log("\n=== MUDO: el vencimiento existe pero no cotiza ===");
const M = await buscar("MUDO");
ok(M.dtes.length === 5, "el plazo largo no sale —no cotiza— y los otros cinco sí (" + M.dtes.length + ")");
ok(/existe, pero ninguna de sus puts tiene precio/.test(M.texto),
  "y se dice que EXISTE pero no cotiza — que no es lo mismo que no haberlo, y se arregla de otra forma");
ok(!/no tiene vencimientos cerca de 360/.test(M.texto), "sin decir que no lo hay, porque sí lo hay");
ok(!M.errs.length, "sin errores de JS " + JSON.stringify(M.errs.slice(0, 2)));

/* ---------------------------------------------------------------------------
   LA CIFRA DE LA CABECERA TIENE QUE SER LA MISMA QUE LA DE LA FILA (v5.03)

   Victor: *"RDDT solo da a 149 días que es el 0.03% que sale a la derecha?"*. No era el plazo:
   era la cifra. El ROI se guarda como FRACCIÓN (0,03 = 3%) y la cabecera de la v5.01 lo pintaba
   con un formateador que no multiplica por cien, así que TODAS las cabeceras salían divididas
   por 100. Un 3% se leía como 0,03%.

   La prueba de la v5.01 no lo cazó porque solo miraba que hubiera un "%" — y lo había. Se
   comprueba el VALOR, y contra la otra pantalla que ya enseña ese mismo número: si la cabecera y
   la fila del mismo contrato no dicen lo mismo, una de las dos miente.
--------------------------------------------------------------------------- */
console.log("\n=== la cabecera dice lo mismo que la fila ===");
const ctxB = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
for (const [re, h] of rutas) await ctxB.route(re, h);
const pb = await ctxB.newPage();
await pb.addInitScript(SEMILLA);
await pb.addInitScript(() => localStorage.setItem("bloques_comp_basis_v2", "roi"));
await pb.goto(URL_APP, { waitUntil: "load" });
await pb.waitForTimeout(2400);
for (const paso of PASOS("MRVL")) { await pb.evaluate(paso.f, paso.arg); await pb.waitForTimeout(paso.ms); }
const cabB = await cabecerasDe(pb);
const textoB = await pb.evaluate(() => document.body.innerText);
/* solo el grupo abierto tiene filas en pantalla, así que estos ROI son los suyos */
const roisFila = (textoB.match(/ROI \+?([\d.]+)%/g) || []).map((s) => parseFloat(s.replace(/[^\d.]/g, "")));
const cabAbierta = cabB.find((c) => c.startsWith("▾")) || "";
const pctCabecera = parseFloat((cabAbierta.match(/([\d.]+)%/) || [0, "0"])[1]);
console.log("  criterio ROI · cabecera abierta:", cabAbierta);
console.log("  ROI de sus filas:", roisFila.join(" · "));
ok(roisFila.length > 0, "el grupo abierto enseña el ROI de sus filas");
ok(Math.abs(pctCabecera - Math.max(...roisFila)) < 0.02,
  "la cabecera (" + pctCabecera + "%) es el mejor ROI de sus filas (" + Math.max(...roisFila) + "%), no una cifra en otra escala");
ok(pctCabecera > 0.5, "y no es un número cien veces más pequeño de lo que debe (" + pctCabecera + "%)");

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
