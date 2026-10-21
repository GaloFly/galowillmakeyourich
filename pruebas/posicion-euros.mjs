/* ---------------------------------------------------------------------------
   POSICIONES EN EUROS (v5.30)

   Victor, con Teleperformance (TEP, cotiza en París): *"tengo un BEP de 89,73 € y el precio actual
   es de 75,98 €, y mira lo que sale. Deberían salir las referencias en euros, y ver la conversión de
   la posición y las primas cobradas en dólares"*. Y eligió: lo cobrado, al cambio DEL DÍA en que se
   cobró (como IBKR); lo que vale, al de hoy.

   La cartera de la prueba, con un tipo de cambio simulado que cambia según el día:

     NVDA  100 acc · BEP $100 · último $130                         (dólares, de control)
     TEP    50 acc · BEP 89,73 € · último 75,98 €                    (euros)
     TEP   put 70 € vendida el 1-oct a 3,00 €, comisión 3 €          (euros)

     tipo EUR→USD:  1-sep 1,10 · 30-sep 1,06 · 1-oct 1,05 · 16-oct 1,07 · 20-oct 1,08 (= hoy)

   Las cuentas que tienen que salir:
     TEP acciones  valor 50 × 75,98 = 3.799 €     → × 1,08 = $4.102,92
                   P&L  50 × (75,98 − 89,73) = −687,50 € → × 1,08 = −$742,50
     TEP put       prima 3,00 × 100 − 3 = 297 € el 1-oct → × 1,05 (de ESE día) = +$311,85
                   (al de hoy serían $320,76: si sale eso, se está usando el cambio equivocado)
     MKT VL        13.000 + 4.102,92 + (valor escrito de la put, −150 € × 1,08 = −162) = $16.940,92

     node pruebas/posicion-euros.mjs
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
const PUERTO = 8358;
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

const SERIE = { "2026-09-01": 1.10, "2026-09-30": 1.06, "2026-10-01": 1.05, "2026-10-16": 1.07, "2026-10-20": 1.08 };
const HOY_FX = 1.08;
const NVDA = { id: "nvda", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
  entryDate: "2026-02-01", broker: "IBKR", comision: "0" };
const TEP = { id: "tep", tkr: "TEP", moneda: "EUR", block: 1, tipo: "Long Stock", nat: "ACC", qty: "50", bep: "89.73", last: "75.98",
  entryDate: "2026-09-01", broker: "IBKR", comision: "0" };
const TEPPUT = { id: "tepput", tkr: "TEP", moneda: "EUR", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
  strike: "70", expiry: "2026-12-18", prima: "3", entryDate: "2026-10-01", broker: "IBKR", comision: "3", mktValue: "-150", last: "75.98" };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const abrir = async (pos, { fxOk = true, vista = "portfolio" } = {}) => {
  const pedidos = { finnhub: [], fx: 0 };
  const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  /* Finnhub: para "TEP" contesta con el precio de OTRA empresa americana — si la app lo pidiera y lo
     escribiera, TEP pasaría a valer 5,50 */
  await ctx.route(/finnhub\.io/, (r) => {
    const sym = (r.request().url().match(/[?&]symbol=([^&]+)/) || [])[1] || "";
    pedidos.finnhub.push(decodeURIComponent(sym));
    const c = sym === "TEP" ? 5.5 : 130;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c, dp: 0, pc: c, h: c }) });
  });
  await ctx.route(/frankfurter|er-api/, (r) => {
    pedidos.fx++;
    if (!fxOk) return r.fulfill({ status: 500, body: "caído" });
    const m = r.request().url().match(/(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/);
    const rates = {};
    Object.keys(SERIE).forEach((d) => { if (!m || (d >= m[1] && d <= m[2])) rates[d] = { USD: SERIE[d] }; });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ amount: 1, base: "EUR", rates }) });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(({ p, v }) => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify(p));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "0", margin: "1000" } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", v);
    localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
  }, { p: pos, v: vista });
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(3200);
  return { ctx, page, errs, pedidos };
};

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const r2 = (v) => Math.round(v * 100) / 100;

const a = await abrir([NVDA, TEP, TEPPUT]);
const pg = a.page;

/* ---------------------------------------------------------------------------
   1. EL MOTOR, leído del compilado.
--------------------------------------------------------------------------- */
console.log("=== las cuentas de cada posición ===");
const fx = await pg.evaluate(() => {
  const vivas = JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]");
  const g = (id) => vivas.find((x) => x.id === id);
  const r = (v) => Math.round(v * 100) / 100;
  const tep = g("tep"), put = g("tepput"), nvda = g("nvda");
  return {
    hoy: FX_EURUSD.hoy, ok: fxHayTipo(),
    dom: fxDiaPos(put, "2026-10-04"), sep: fxDiaPos(tep, "2026-09-01"), usd: fxDiaPos(nvda, "2026-10-04"),
    tepLast: tep.last, tepMktNat: r(effMktNat(tep)), tepMkt: r(effMkt(tep)), tepPnlNat: r(effPnlNat(tep)), tepPnl: r(effPnl(tep)),
    nvdaMkt: r(effMkt(nvda)), nvdaPnl: r(effPnl(nvda)), putMkt: r(effMkt(put)),
  };
});
console.log("  tipo de hoy " + fx.hoy + " · TEP vale " + fx.tepMktNat + " € = $" + fx.tepMkt + " · P&L " + fx.tepPnlNat + " € = $" + fx.tepPnl);
ok(fx.ok && fx.hoy === HOY_FX, "el tipo de hoy es el último de la serie del BCE: " + HOY_FX);
ok(fx.dom === 1.05, "un domingo (4-oct) usa el último día hábil anterior (1-oct, 1,05) — sale " + fx.dom);
ok(fx.usd === 1, "una posición en dólares no se convierte: factor 1");
ok(fx.tepLast === "75.98", "el 🔄 Precios NO pisó el último de TEP con el de otra empresa americana (sale " + fx.tepLast + ")");
ok(fx.tepMktNat === 3799 && fx.tepMkt === 4102.92, "TEP vale 3.799 € dentro de la posición y $4.102,92 hacia fuera");
ok(fx.tepPnlNat === -687.5 && fx.tepPnl === -742.5, "su P&L, −687,50 € y −$742,50");
ok(fx.nvdaMkt === 13000 && fx.nvdaPnl === 3000, "NVDA (en dólares) como siempre: $13.000 y +$3.000");
ok(fx.putMkt === -162, "y la put, su valor escrito −150 € = −$162");
ok(!a.pedidos.finnhub.includes("TEP") && a.pedidos.finnhub.includes("NVDA"), "a Finnhub solo se le pregunta por NVDA, nunca por TEP (pedidos: " + JSON.stringify(a.pedidos.finnhub) + ")");

/* ---------------------------------------------------------------------------
   2. EN PANTALLA: la cabecera (en dólares, diciendo el cambio) y la fila (en euros).
--------------------------------------------------------------------------- */
console.log("\n=== la cabecera de la cuenta ===");
const cab = await pg.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/VALOR MERCADO\s*\n\s*(-?)\$([\d,]+)/);
  return { mkt: m ? (m[1] ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN, linea: (t.match(/En euros:[^\n]*/) || [""])[0] };
});
console.log("  MKT VL $" + cab.mkt + " · " + cab.linea);
ok(cab.mkt === 16941, "MKT VL = 13.000 + 4.102,92 − 162 = $16.941 (sale $" + cab.mkt + ")");
ok(/En euros: TEP/.test(cab.linea) && /1 € = \$1\.0800/.test(cab.linea), "y dice qué está en euros y a qué cambio: 1 € = $1.0800");

console.log("\n=== la fila de TEP ===");
await pg.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B1/.test(x.innerText || "")); if (b) b.click(); });
await pg.waitForTimeout(800);
/* el P&L de las filas viene oculto de fábrica: se enciende */
await pg.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Ver P&L"); if (b) b.click(); });
await pg.waitForTimeout(600);
const fila = await pg.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => { const t = (e.innerText || "").trim(); return /^TEP/.test(t) && /Long Stock/.test(t) && /BEP/.test(t) && !/Short Put/.test(t); });
  c.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
  return c[0] ? c[0].innerText.replace(/\n+/g, " · ") : "";
});
console.log("  " + fila.slice(0, 260));
ok(/BEP · €89\.73/.test(fila), "BEP en euros: €89.73");
ok(/ÚLTIMO · €75\.98/.test(fila), "último en euros: €75.98");
ok(/-\$743/.test(fila), "el P&L en dólares (lo que suma en la cuenta): −$743");
ok(/P&L en euros -688 €/.test(fila), "y al lado, en euros: −688 €");
await pg.evaluate(() => { const e = Array.from(document.querySelectorAll("div")).find((x) => /^P&L en euros/.test((x.innerText || "").trim())); if (e) e.scrollIntoView({ block: "center" }); });
await pg.waitForTimeout(300);
await pg.screenshot({ path: D + "/posicion-euros-fila.png" });

/* ---------------------------------------------------------------------------
   3. MOVIMIENTOS: la prima, al cambio DE SU DÍA.
--------------------------------------------------------------------------- */
console.log("\n=== Movimientos · Primas ===");
const ir = async (t) => { await pg.evaluate((s) => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === s); if (b) b.click(); }, t); await pg.waitForTimeout(800); };
await ir("Movimientos");
await ir("Primas");
const acum = await pg.evaluate(() => { const m = document.body.innerText.match(/TOTAL ACUM\.\n[^\n]*\n([+-])\$([\d,]+)/); return m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN; });
console.log("  total acumulado de Primas $" + acum + "  (297 € × 1,05 del 1-oct = $311,85; al cambio de hoy serían $320,76)");
ok(acum === 312, "la prima de la put entra al cambio de SU día: +$312, no +$321 (sale $" + acum + ")");
/* y el detalle del movimiento enseña la cifra original y el cambio usado */
const detalle = await pg.evaluate(() => new Promise((res) => {
  const abrir = (re) => { const e = Array.from(document.querySelectorAll("div")).filter((x) => re.test((x.innerText || "").trim()) && getComputedStyle(x).cursor === "pointer").sort((p, q) => (p.innerText || "").length - (q.innerText || "").length)[0]; if (e) e.click(); };
  abrir(/^TOTAL 2026/);
  setTimeout(() => { abrir(/^TOTAL OCT 2026/); setTimeout(() => {
    const f = Array.from(document.querySelectorAll("div")).filter((x) => /TEP/.test(x.innerText || "") && /\+\$312/.test(x.innerText || "") && getComputedStyle(x).cursor === "pointer").sort((p, q) => (p.innerText || "").length - (q.innerText || "").length)[0];
    if (f) f.click();
    setTimeout(() => res((document.body.innerText.match(/En euros \+[^\n]*/) || [""])[0]), 700);
  }, 700); }, 700);
}));
console.log("  " + detalle);
ok(/En euros \+297 €/.test(detalle) && /1 € = \$1\.0500/.test(detalle), "al abrirla: en euros +297 €, al cambio de ese día 1,0500");
await pg.screenshot({ path: D + "/posicion-euros.png" });
ok(!a.errs.length, "sin errores de JS " + JSON.stringify(a.errs.slice(0, 2)));
await a.ctx.close();

/* ---------------------------------------------------------------------------
   4. SIN TIPO DE CAMBIO: se dice, no se calla.
--------------------------------------------------------------------------- */
console.log("\n=== si no llega el tipo de cambio ===");
const b = await abrir([NVDA, TEP], { fxOk: false });
const sinFx = await b.page.evaluate(() => ({ linea: (document.body.innerText.match(/En euros:[^\n]*/) || [""])[0], mkt: Math.round(effMkt(JSON.parse(localStorage.getItem("bloques_pos_v5")).find((x) => x.id === "tep"))) }));
console.log("  " + sinFx.linea + " · TEP cuenta $" + sinFx.mkt);
ok(/sin tipo de cambio/.test(sinFx.linea), "la cabecera lo dice en ámbar: sin tipo de cambio todavía");
ok(sinFx.mkt === 3799, "y mientras tanto cuenta 1 € = $1 (3.799), dicho en pantalla — no un número inventado callado");
await b.ctx.close();

/* ---------------------------------------------------------------------------
   5. CONTROL: una cartera solo en dólares no pide tipo de cambio ni cambia nada.
--------------------------------------------------------------------------- */
console.log("\n=== una cartera sin euros, como siempre ===");
const c = await abrir([NVDA]);
const soloUsd = await c.page.evaluate(() => /En euros:/.test(document.body.innerText));
ok(!soloUsd, "sin posiciones en euros no aparece ninguna línea de euros");
ok(c.pedidos.fx === 0, "ni se pide el tipo de cambio (pedidos: " + c.pedidos.fx + ")");
await c.ctx.close();

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
