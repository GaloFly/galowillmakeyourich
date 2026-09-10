/* ---------------------------------------------------------------------------
   LAS HOJAS DE CERRAR / ROLAR / EDITAR SALEN CENTRADAS (v5.17)

   Victor: *"cuando cierras o editas posiciones la pantalla que sale no está centrada, hay que
   buscarla haciendo scrolling, súper mala experiencia; debería salir centrada y fácil de rellenar"*.

   Y era literal. Medido antes del arreglo, con la pantalla del iPhone en 390×664:

     · el velo de la hoja —`position: fixed` con `inset: 0`, que debería medir la pantalla— medía
       **1212 px de alto y empezaba en −7**;
     · la hoja, centrada dentro de ESO, arrancaba a media página y sus campos caían por debajo del
       borde inferior;
     · y la barra de navegación y el botón + se pintaban POR ENCIMA de la hoja.

   La causa es una regla de CSS que no perdona: un elemento con `transform` —aunque sea
   `translateX(0px)`, que no es lo mismo que `none`— o con `will-change: transform` pasa a ser el
   marco de referencia de todos sus descendientes `position: fixed`. El contenedor que permite
   deslizar entre bloques lo llevaba puesto siempre, y estas hojas se pintan dentro de la fila de la
   posición, o sea dentro de él.

   Por eso esta prueba NO comprueba "que se vea la hoja" —eso pasaba también con el fallo— sino las
   dos medidas que lo delatan:

     1. el velo mide EXACTAMENTE la pantalla;
     2. la hoja cabe entera dentro de ella, sin tener que hacer scroll;
     3. y lo que se toca en el centro de la hoja ES la hoja, no la barra de abajo.

     node pruebas/hojas-centradas.mjs
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
const PUERTO = 8343;
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

/* Tres posiciones en el MISMO bloque, para poder abrir todas las hojas: una opción con un roll
   hecho (cerrar · rolar · editar la cadena), una acción con lotes y dividendo (lotes · dividendos)
   y un vertical (la hoja de pata). Y unas cuantas más de relleno, porque el fallo NECESITA que la
   lista sea más alta que la pantalla: con una sola posición el marco de referencia equivocado medía
   casi lo mismo que el viewport y la hoja salía casi centrada por casualidad. */
const RELLENO = [3, 4, 5, 6, 7].map((i) => ({
  id: "r" + i, tkr: "REL" + i, block: 2, tipo: "Long Stock", nat: "ACC", qty: "10", entry: "100",
  bep: "100", last: "110", entryDate: "2026-02-01", broker: "IBKR", comision: "0",
}));
const POS = [
  { id: "o1", tkr: "TMDX", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100", strike: "70",
    expiry: "2026-12-18", prima: "4.00", last: "76", entryDate: "2026-06-01", broker: "IBKR", comision: "1",
    rollChain: [{ date: "2026-07-10", prevStrike: "70", prevExpiry: "2026-09-18", prevPrima: "3.00",
      buybackCost: "1.00", newCredit: "4.00", comision: "2" }] },
  { id: "a1", tkr: "NVDA", block: 2, tipo: "Long Stock", nat: "ACC", qty: "60", entry: "100", bep: "100",
    last: "130", entryDate: "2026-02-01", broker: "IBKR", comision: "0",
    lots: [{ id: "l1", date: "2026-02-01", qty: "60", price: "100" }],
    dividends: [{ id: "dv1", date: "2026-08-05", amount: "50", ret: "0", fee: "0" }] },
  { id: "v1", tkr: "SPY", block: 2, tipo: "Spread", nat: "DEF", right: "P", qty: "100", expiry: "2026-12-18",
    sK: "560", sP: "4.20", lK: "550", lP: "1.80", pnl: "310", last: "565", entryDate: "2026-08-01",
    broker: "IBKR", comision: "2" },
  ...RELLENO,
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 100, dp: 0, pc: 100, h: 100 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "portfolio");
}, POS);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B2/.test(x.innerText || "")); if (b) b.click(); });
await page.waitForTimeout(800);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

const pulsar = async (re, espera) => {
  const hecho = await page.evaluate((patron) => {
    const rx = new RegExp(patron);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.innerText || "") && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  }, re);
  await page.waitForTimeout(espera || 700);
  return hecho;
};
/* cierra CUALQUIER hoja que quede abierta, de la de más arriba hacia abajo. Pulsar "el ✕" a secas
   no vale: si quedan dos hojas apiladas se pulsa el de la de abajo y la de arriba se queda tapando
   —pasó, y la comprobación del centro lo cazó—. */
const cerrarTodo = async () => {
  for (let i = 0; i < 5; i++) {
    const quedan = await page.evaluate(() => {
      const velos = Array.from(document.querySelectorAll("div")).filter((e) => {
        const cs = getComputedStyle(e);
        return cs.position === "fixed" && (Number(cs.zIndex) || 0) >= 50 && e.getBoundingClientRect().height > 100;
      });
      if (!velos.length) return 0;
      velos.sort((a, b) => (Number(getComputedStyle(b).zIndex) || 0) - (Number(getComputedStyle(a).zIndex) || 0));
      const x = Array.from(velos[0].querySelectorAll("button")).find((b) => /^(✕|×)$/.test((b.innerText || "").trim()));
      if (x) x.click(); else velos[0].click();
      return velos.length;
    });
    await page.waitForTimeout(450);
    if (!quedan) return;
  }
};
const abrirFila = async (tkr) => {
  await cerrarTodo();
  await page.evaluate((t) => {
    const c = Array.from(document.querySelectorAll("div")).filter((e) => (e.textContent || "").indexOf(t) >= 0 && getComputedStyle(e).cursor === "pointer");
    c.sort((a, b) => (b.innerText || "").length - (a.innerText || "").length);
    if (c[0]) c[0].click();
  }, tkr);
  await page.waitForTimeout(700);
};

/* La medida. `rotulo` identifica la hoja por su título; de ahí se sube al velo (el ancestro
   `position: fixed`) y se comparan sus medidas con las de la pantalla. */
const medir = (rotulo) => page.evaluate((pat) => {
  const rx = new RegExp(pat);
  /* se busca EL VELO, no el rótulo: el elemento `position: fixed` de más arriba en el apilado que
     contenga ese texto. Subir desde el rótulo hasta el primer ancestro fijo se equivoca de hoja
     cuando queda otra abierta debajo — y entonces se mide una pantalla que no es la que se abrió. */
  const velos = Array.from(document.querySelectorAll("div")).filter((e) => {
    const cs = getComputedStyle(e);
    return cs.position === "fixed" && cs.display !== "none" && rx.test(e.innerText || "");
  });
  if (!velos.length) return { falta: true };
  velos.sort((a, b) => (Number(getComputedStyle(b).zIndex) || 0) - (Number(getComputedStyle(a).zIndex) || 0));
  const velo = velos[0];
  const panel = velo.firstElementChild;
  if (!panel || !rx.test(panel.innerText || "")) return { sinVelo: true };
  const rv = velo.getBoundingClientRect(), rp = panel.getBoundingClientRect();
  /* qué hay de verdad en el centro de la hoja: con el fallo, ahí estaba la barra de navegación */
  const enElCentro = document.elementFromPoint(Math.round(rp.left + rp.width / 2), Math.round(rp.top + rp.height / 2));
  return {
    vh: innerHeight, vw: innerWidth, scrollY: window.scrollY,
    velo: { top: Math.round(rv.top), left: Math.round(rv.left), h: Math.round(rv.height), w: Math.round(rv.width) },
    panel: { top: Math.round(rp.top), bottom: Math.round(rp.bottom), h: Math.round(rp.height) },
    centroEsLaHoja: !!(enElCentro && panel.contains(enElCentro)),
  };
}, rotulo);

const comprobar = async (nombre, rotulo) => {
  const m = await medir(rotulo);
  if (m.falta) { ok(false, nombre + ": no encuentro la hoja en pantalla"); return; }
  if (m.sinVelo) { ok(false, nombre + ": el velo de más arriba no contiene la hoja"); return; }
  console.log("  · " + nombre + " → pantalla " + m.vw + "×" + m.vh + " · velo " + m.velo.w + "×" + m.velo.h + " en (" + m.velo.left + "," + m.velo.top + ") · hoja " + m.panel.top + "→" + m.panel.bottom);
  ok(m.velo.top === 0 && m.velo.left === 0 && m.velo.h === m.vh && m.velo.w === m.vw,
    nombre + ": el velo mide la PANTALLA entera (" + m.velo.w + "×" + m.velo.h + " vs " + m.vw + "×" + m.vh + ")");
  ok(m.panel.top >= 0 && m.panel.bottom <= m.vh,
    nombre + ": la hoja cabe entera sin hacer scroll (" + m.panel.top + "→" + m.panel.bottom + " de " + m.vh + ")");
  ok(m.centroEsLaHoja, nombre + ": y en su centro se toca la hoja, no lo que hay detrás");
};

console.log("=== la hoja de acciones de la posición ===");
await abrirFila("TMDX");
await comprobar("Acciones de la posición", "Borra la posición");

console.log("\n=== cerrar una opción ===");
ok(await pulsar("^Cerrar posición"), "se pulsa «Cerrar posición»");
await comprobar("Cerrar opción", "Cerrar TMDX");
await cerrarTodo();

console.log("\n=== rolar ===");
await abrirFila("TMDX");
ok(await pulsar("^Rolar"), "se pulsa «Rolar»");
await comprobar("Rolar", "Rolar TMDX");
await cerrarTodo();

console.log("\n=== editar aperturas, rolls y cierre ===");
await abrirFila("TMDX");
ok(await pulsar("^Editar\\b"), "se pulsa «Editar»");
ok(await pulsar("Editar aperturas, rolls y cierre"), "y «Editar aperturas, rolls y cierre»");
await comprobar("Cadena de rolls", "Editar TMDX");
await cerrarTodo();

console.log("\n=== lotes de una acción ===");
await abrirFila("NVDA");
ok(await pulsar("^Editar\\b"), "se pulsa «Editar»");
ok(await pulsar("^Lotes\\b"), "y «Lotes»");
await comprobar("Lotes", "Lotes de NVDA");
await cerrarTodo();

console.log("\n=== dividendos ===");
await abrirFila("NVDA");
ok(await pulsar("^Editar\\b"), "se pulsa «Editar»");
ok(await pulsar("^Dividendos\\b"), "y «Dividendos»");
await comprobar("Dividendos", "Dividendos de NVDA");
await cerrarTodo();

console.log("\n=== cerrar una acción (camino distinto al de la opción) ===");
await abrirFila("NVDA");
ok(await pulsar("^Cerrar posición"), "se pulsa «Cerrar posición»");
await comprobar("Cerrar acción", "Cerrar NVDA");
await cerrarTodo();

console.log("\n=== el asistente de nueva posición ===");
ok(await page.evaluate(() => { const b = document.querySelector('[aria-label="Nueva posición"]'); if (!b) return false; b.click(); return true; }), "se pulsa el botón +");
await page.waitForTimeout(900);
await comprobar("Nueva posición", "Nueva posición");

/* ---------------------------------------------------------------------------
   Y LA OTRA MITAD: el `transform` que se ha quitado es el que MUEVE el contenido al deslizar entre
   bloques. Quitarlo del todo también "arreglaría" el centrado — y rompería el gesto sin que nadie
   se enterara hasta que Victor lo probara. Así que se comprueba que el gesto sigue vivo: un
   deslizamiento de derecha a izquierda tiene que cambiar de bloque, y al acabar el transform tiene
   que volver a `none` (si se quedara puesto, el fallo del centrado volvería solo).
--------------------------------------------------------------------------- */
console.log("\n=== deslizar entre bloques sigue funcionando ===");
await cerrarTodo();
const bloqueActivo = () => page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^B\d/.test((x.innerText || "").trim()) && getComputedStyle(x).color === "rgb(255, 255, 255)");
  return b ? (b.innerText || "").trim().split(" ")[0] : "?";
});
const antes = await bloqueActivo();
/* el gesto va en DOS tandas con una pausa en medio: React repinta de forma diferida, así que leer
   el transform en el mismo bloque que despacha los toques devuelve el de ANTES — y la comprobación
   pasaría siempre diciendo "none". Comprobado: así medía none con el gesto funcionando. */
await page.evaluate(() => {
  window.__cont = document.querySelector('[style*="pan-y"]');
  window.__tf0 = getComputedStyle(window.__cont).transform;
  window.__toque = (tipo, x) => {
    const t = new Touch({ identifier: 1, target: window.__cont, clientX: x, clientY: 400 });
    window.__cont.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === "touchend" ? [] : [t], targetTouches: tipo === "touchend" ? [] : [t], changedTouches: [t] }));
  };
  window.__toque("touchstart", 330);
  [300, 250, 190, 130, 80].forEach((x) => window.__toque("touchmove", x));
});
await page.waitForTimeout(250);
const gesto = await page.evaluate(() => ({ antesTf: window.__tf0, enMedio: getComputedStyle(window.__cont).transform }));
await page.evaluate(() => window.__toque("touchend", 80));
await page.waitForTimeout(1200);
const despues = await bloqueActivo();
console.log("  bloque " + antes + " → " + despues + " · transform en reposo: " + (gesto.antesTf || "?") + " · durante el gesto: " + (gesto.enMedio || "?"));
ok(gesto.antesTf === "none", "en reposo el contenedor NO lleva transform (es lo que rompía el centrado)");
ok(gesto.enMedio && gesto.enMedio !== "none", "pero al arrastrar SÍ lo lleva, o el gesto no movería nada (" + gesto.enMedio + ")");
ok(antes !== despues, "y el deslizamiento cambia de bloque (" + antes + " → " + despues + ")");
const finTf = await page.evaluate(() => getComputedStyle(document.querySelector('[style*="pan-y"]')).transform);
ok(finTf === "none", "al acabar vuelve a quitarse, así que el centrado no se rompe otra vez (" + finTf + ")");

await page.screenshot({ path: D + "/hojas-centradas.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
