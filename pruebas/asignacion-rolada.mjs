/* ---------------------------------------------------------------------------
   UNA PUT ROLADA Y ASIGNADA NO PUEDE DAR BENEFICIO EL DÍA DE LA ASIGNACIÓN (v5.28)

   Victor: *"me han asignado ORCL a 190, está en 129, y en MTM me sale como profit — no puede ser"*.

   La v5.19 traspasaba al coste de las acciones TODO lo realizado por la cadena de rolls. Las
   recompras de cada roll ya se habían apuntado como pérdidas en sus meses, así que el día de la
   asignación el MTM las devolvía: cierre de la última put (+) menos traspaso de la cadena neta (−)
   = el importe de todas esas recompras, en positivo. Un beneficio inventado con la acción hundida.

   Ahora, como en Hacienda y en IBKR: cada roll es una operación cerrada y su resultado se queda en
   su mes. A las acciones solo pasa la prima de la put que de verdad ejercieron, la última.

   La cadena de esta prueba tiene la forma de la de Victor (2 contratos, strike 190, la última put
   vendida a 50,64), con tres rolls en vez de siete para que las cuentas se lean a mano:

     apertura  vende a  7,37
     roll 1    recompra 18,83 · vende a 24,33  →  −(18,83 − 7,37)  × 200 = −2.292
     roll 2    recompra 45,47 · vende a 46,77  →  −(45,47 − 24,33) × 200 = −4.228
     roll 3    recompra 49,64 · vende a 50,64  →  −(49,64 − 46,77) × 200 =   −574
                                                             rolls:      −7.094
     asignada a 190: la última put (50,64 × 200 = 10.128) pasa al coste → 190 − 50,64 = $139,36
     prima neta de toda la cadena (Primas): 15,17 × 200 = +3.034

   La prueba de que no se cuenta nada dos veces ni se pierde nada es la CAJA. Con ORCL a 129:
     +3.034 primas − 38.000 compra (190 × 200) + 25.800 que valen hoy = −9.166
   y eso tiene que ser lo mismo que: rolls (−7.094) + acciones desde 139,36 ((129 − 139,36) × 200).

     node pruebas/asignacion-rolada.mjs
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
const PUERTO = 8357;
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

const STRIKE = 190, ACCS = 200, HOY = 129;
const PRIMA_TOTAL = 3034;                    /* 15,17 × 200 */
const ROLLS = -7094;                         /* las tres recompras, realizadas en su día */
const ULTIMA = 10128;                        /* 50,64 × 200: la put que ejercieron */
const COSTE = 139.36;                        /* 190 − 50,64 */
const COSTE_VIEJO = 174.83;                  /* 190 − 3.034/200: la regla de la v5.19 */
const CAJA = PRIMA_TOTAL - STRIKE * ACCS + HOY * ACCS;   /* −9.166 */

const PUT = { id: "orcl", tkr: "ORCL", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: String(ACCS),
  strike: String(STRIKE), expiry: "2026-11-20", prima: "15.17", last: String(HOY),
  entryDate: "2026-01-09", broker: "IBKR", comision: "0",
  rollChain: [
    { date: "2026-04-10", prevStrike: "190", prevExpiry: "2026-04-17", prevPrima: "7.37", buybackCost: 18.83, newCredit: 24.33, comision: 0, ivr: "", note: "" },
    { date: "2026-07-10", prevStrike: "190", prevExpiry: "2026-07-17", prevPrima: "12.87", buybackCost: 45.47, newCredit: 46.77, comision: 0, ivr: "", note: "" },
    { date: "2026-09-11", prevStrike: "190", prevExpiry: "2026-09-18", prevPrima: "14.17", buybackCost: 49.64, newCredit: 50.64, comision: 0, ivr: "", note: "" },
  ] };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const abrir = async (pos) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: HOY, dp: 0, pc: HOY, h: HOY }) }));
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((p) => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify(p));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", "portfolio");
    /* con key de precios la app descarga sola al arrancar (v5.05): así las acciones creadas por la
       asignación tienen precio tras recargar, y el resumen de Asignadas puede valorarlas */
    localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
  }, pos);
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
};

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const r2 = (v) => Math.round(v * 100) / 100;

const { ctx, page, errs } = await abrir([PUT]);
const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]"));
const ir = async (t) => {
  await page.evaluate((s) => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === s); if (b) b.click(); }, t);
  await page.waitForTimeout(800);
};
const pulsar = async (re) => {
  const hecho = await page.evaluate((pat) => {
    const rx = new RegExp(pat);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.innerText || "") && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  }, re);
  await page.waitForTimeout(900);
  return hecho;
};
const pulsarEn = async (cajaRe, botonRe) => {
  const hecho = await page.evaluate(({ c, b }) => {
    const rc = new RegExp(c), rb = new RegExp(b);
    const cajas = Array.from(document.querySelectorAll("div"))
      .filter((e) => rc.test(e.innerText || "") && Array.from(e.querySelectorAll("button")).some((x) => rb.test((x.innerText || "").trim())));
    if (!cajas.length) return false;
    cajas.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
    Array.from(cajas[0].querySelectorAll("button")).find((x) => rb.test((x.innerText || "").trim())).click();
    return true;
  }, { c: cajaRe, b: botonRe });
  await page.waitForTimeout(700);
  return hecho;
};
const abrirFicha = async (tkr, tipo) => {
  await page.evaluate(({ t, ti }) => {
    const c = Array.from(document.querySelectorAll("div")).filter((e) => {
      const x = e.textContent || "";
      return x.indexOf(t) >= 0 && (!ti || x.indexOf(ti) >= 0) && getComputedStyle(e).cursor === "pointer";
    });
    c.sort((a, b) => (b.innerText || "").length - (a.innerText || "").length);
    if (c[0]) c[0].click();
  }, { t: tkr, ti: tipo });
  await page.waitForTimeout(700);
};
const leerTotal = (re) => page.evaluate((pat) => {
  const m = document.body.innerText.match(new RegExp(pat));
  return m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN;
}, re);

/* ---------------------------------------------------------------------------
   0. LOS DERIVADORES AUTÓNOMOS, leídos del compilado. Lección de la v5.19: medir solo la pantalla
      no basta, porque hay un segundo camino de cálculo (ficha, Histórico) que puede quedarse atrás.
--------------------------------------------------------------------------- */
console.log("=== la cuenta, en las funciones de la app ===");
const hay = await page.evaluate(() => ["traspasoAsignada", "mtmBrutoOfPos", "mtmSumOfPos", "realizedOf", "primaSumOfPos", "costeAsignadaPendiente"]
  .every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const fx = await page.evaluate((put) => {
  const r = (v) => Math.round(v * 100) / 100;
  const asig = { ...put, closed: true, closeDate: "2026-10-15", closePrice: "0", closeComision: "0", exercised: true };
  /* control: la MISMA put sin rolls (apertura 50,64) — ahí las reglas vieja y nueva coinciden */
  const sola = { ...put, prima: "50.64", rollChain: [], closed: true, closeDate: "2026-10-15", closePrice: "0", closeComision: "0", exercised: true };
  return { traspaso: r(traspasoAsignada(asig)), bruto: r(mtmBrutoOfPos(asig)), mtm: r(mtmSumOfPos(asig)),
    real: r(realizedOf(asig)), primas: r(primaSumOfPos(asig)),
    solaTraspaso: r(traspasoAsignada(sola)), solaBruto: r(mtmBrutoOfPos(sola)), solaMtm: r(mtmSumOfPos(sola)) };
}, PUT);
console.log("  traspaso al coste $" + fx.traspaso + " · MTM que se queda en la put $" + fx.mtm + " · Primas $" + fx.primas);
ok(fx.traspaso === ULTIMA, "al coste pasa SOLO la última put, la ejercida: $" + ULTIMA + " (sale $" + fx.traspaso + ")");
ok(fx.mtm === ROLLS && fx.real === ROLLS, "y en MTM se quedan las recompras de los rolls, realizadas en su día: $" + ROLLS + " (sale $" + fx.mtm + ")");
ok(fx.primas === PRIMA_TOTAL, "Primas no cambia: sigue siendo el cobro neto de la cadena, $" + PRIMA_TOTAL);
ok(r2(fx.traspaso + fx.mtm) === fx.bruto, "y entre las dos cosas suman todo lo realizado, ni un céntimo más ni menos");
ok(fx.solaTraspaso === fx.solaBruto && fx.solaMtm === 0, "control: sin rolls todo pasa al coste y la put queda a 0 — igual que en la v5.19");

/* ---------------------------------------------------------------------------
   1. ASIGNAR DESDE LA APP: lo que dice antes de confirmar, y el coste que guarda.
--------------------------------------------------------------------------- */
console.log("\n=== al pulsar «Me han ejercido» ===");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B2/.test(x.innerText || "")); if (b) b.click(); });
await page.waitForTimeout(800);
await abrirFicha("ORCL");
ok(await pulsar("Me han ejercido"), "se pulsa");
const aviso = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => /^Te quedas/.test((e.innerText || "").trim()));
  return c.length ? c[0].parentElement.innerText : "";
});
console.log("  " + aviso.replace(/\n+/g, " | ").slice(0, 330));
ok(aviso.indexOf("$" + COSTE) >= 0, "coste $" + COSTE + " = 190 − 50,64, no $" + COSTE_VIEJO);
ok(/3 rolls anteriores/.test(aviso) && /-\$7,094/.test(aviso), "y dice que los 3 rolls anteriores (−$7,094) no se tocan");
ok(await pulsarEn("A QUÉ BLOQUE VAN", "^B1"), "se eligen B1");
ok(await pulsar("Confirmar"), "se confirma");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /^(✕|×)$/.test((x.innerText || "").trim()) && x.offsetParent !== null); if (b) b.click(); });
await page.waitForTimeout(700);
const g = await guardado();
const acc = g.find((x) => x.assignedFrom === "orcl");
console.log("  acciones creadas: qty=" + (acc && acc.qty) + " bep=" + (acc && acc.bep));
ok(acc && Math.abs(Number(acc.bep) - COSTE) < 0.005, "las acciones se guardan a $" + COSTE + " (sale " + (acc && acc.bep) + ")");

/* ---------------------------------------------------------------------------
   2. MTM: el mes de la asignación ya no gana nada.
--------------------------------------------------------------------------- */
console.log("\n=== en MTM ===");
await ir("Movimientos");
await ir("MTM");
/* el año arranca plegado: se despliega para ver los meses. Cada fila es "TOTAL MES AÑO · $x · ±$y";
   la primera cifra es otra columna, por eso se exige el signo para leer el resultado. */
await page.evaluate(() => { const e = Array.from(document.querySelectorAll("div")).filter((x) => /^TOTAL 20\d\d/.test((x.innerText || "").trim()) && getComputedStyle(x).cursor === "pointer").sort((a, b) => (a.innerText || "").length - (b.innerText || "").length)[0]; if (e) e.click(); });
await page.waitForTimeout(800);
const mesAsig = new Date().toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase().slice(0, 3);
const anio = new Date().getFullYear();
const mtmMes = await leerTotal("TOTAL " + mesAsig + " " + anio + "\\n[^\\n]*\\n([+-])\\$([\\d,]+)");
const mtmAbr = await leerTotal("TOTAL ABR 2026\\n[^\\n]*\\n([+-])\\$([\\d,]+)");
const mtmAcum = await leerTotal("TOTAL ACUM\\.\\n[^\\n]*\\n([+-])\\$([\\d,]+)");
console.log("  abril (roll 1) → $" + mtmAbr + " · mes de la asignación (" + mesAsig + " " + anio + ") → $" + mtmMes + " · acumulado → $" + mtmAcum);
ok(mtmAbr === -2292, "las recompras se quedan en su mes: abril −$2,292 (sale $" + mtmAbr + ")");
ok(mtmMes === 0, "el mes de la asignación suma $0 — antes salía +$7,094 de \"beneficio\" (sale $" + mtmMes + ")");
ok(mtmAcum === ROLLS, "el acumulado son las recompras de los rolls, $" + ROLLS + " (sale $" + mtmAcum + ")");

/* las acciones recién creadas no tienen precio hasta la siguiente descarga: se recarga */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(3600);

/* ---------------------------------------------------------------------------
   3. Y LA CADENA ENTERA, EN EL RESUMEN DE ASIGNADAS, ES LA CAJA.
--------------------------------------------------------------------------- */
console.log("\n=== el resumen «🔗 Asignadas» cuadra con la caja ===");
console.log("  +3.034 primas − 38.000 compra + 25.800 que valen hoy = $" + CAJA);
await ir("Movimientos");
await ir("Histórico");
ok(await pulsar("^Short Puts"), "se abre la categoría Short Puts");
const enAsignadas = await page.evaluate(() => {
  const d = Array.from(document.querySelectorAll("details")).find((e) => /Asignadas/.test(e.textContent || ""));
  if (!d) return null;
  d.open = true;
  return d.innerText;
});
if (enAsignadas === null) ok(false, "no encuentro el resumen de asignadas");
else {
  console.log("  " + enAsignadas.replace(/\n+/g, " | ").slice(0, 260));
  ok(/-\$9,166/.test(enAsignadas), "la cadena vale −$9,166, la caja: rolls −7.094 + acciones (129 − 139,36) × 200");
  ok(/Rolls -\$7,094 ya realizados/.test(enAsignadas), "y dice qué parte son los rolls, ya realizados");
}
ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
await ctx.close();

/* ---------------------------------------------------------------------------
   4. LAS ACCIONES QUE YA SE CREARON CON LA REGLA VIEJA: se OFRECE corregirlas, no se impone.
--------------------------------------------------------------------------- */
console.log("\n=== el ORCL de Victor, asignado ANTES de este arreglo ===");
const putVieja = { ...PUT, closed: true, closeDate: "2026-10-15", closePrice: "0", closeComision: "0", exercised: true };
const accVieja = { id: "accorcl", block: 1, broker: "IBKR", tkr: "ORCL", tipo: "Long Stock", nat: "ACC", strike: "", right: "P",
  expiry: "", qty: String(ACCS), bep: String(COSTE_VIEJO), prima: "", comision: "", last: String(HOY), mktValue: "",
  riesgo: "", factor: "1", margen: "", margenPct: "100", margenModo: "PCT", mktModo: "AUTO", pnlModo: "AUTO", pnl: "",
  entryDate: "2026-10-15", rollChain: [], closed: false, assignedFrom: "orcl", entryNote: "Asignada desde put ORCL · coste base = BEP $174.83" };
const b = await abrir([putVieja, accVieja]);
const verB1 = async (pg) => {
  await pg.evaluate(() => { const x = Array.from(document.querySelectorAll("button")).find((y) => /B1/.test(y.innerText || "")); if (x) x.click(); });
  await pg.waitForTimeout(800);
  return pg.evaluate(() => document.body.innerText);
};
const t1 = await verB1(b.page);
const banner = (t1.match(/El coste de estas acciones[^\n]*/) || [""])[0];
console.log("  " + banner.slice(0, 200));
ok(/\$174\.83/.test(banner) && /\$139\.36/.test(banner), "se avisa: el coste guardado es $174.83 y debería ser $139.36");
ok(/Corregir a \$139\.36/.test(t1), "con un botón para corregirlo");
await b.page.evaluate(() => { const e = Array.from(document.querySelectorAll("div")).find((x) => /^El coste de estas acciones/.test((x.innerText || "").trim())); if (e) e.scrollIntoView({ block: "center" }); });
await b.page.waitForTimeout(500);
await b.page.screenshot({ path: D + "/asignacion-rolada-aviso.png" });
await b.page.evaluate(() => { const x = Array.from(document.querySelectorAll("button")).find((y) => /^Corregir a/.test((y.innerText || "").trim())); if (x) x.click(); });
await b.page.waitForTimeout(900);
await b.page.reload({ waitUntil: "load" });
await b.page.waitForTimeout(2600);
const tras = await b.page.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]").find((x) => x.id === "accorcl"));
console.log("  tras pulsarlo y recargar → bep " + (tras && tras.bep));
ok(tras && Math.abs(Number(tras.bep) - COSTE) < 0.005, "el coste queda en $" + COSTE + " y sobrevive a recargar");
const t1b = await verB1(b.page);
ok(!/Corregir a/.test(t1b), "y el aviso desaparece: ya no hay nada que corregir");
ok(!b.errs.length, "sin errores de JS " + JSON.stringify(b.errs.slice(0, 2)));
await b.page.screenshot({ path: D + "/asignacion-rolada.png" });
await b.ctx.close();

/* controles: lo que NO debe ofrecerse nunca */
console.log("\n=== y no se ofrece cuando no toca ===");
const c = await abrir([putVieja, { ...accVieja, bep: "150" }]);
ok(!/Corregir a/.test(await verB1(c.page)), "si el coste lo cambiaste tú a mano ($150), no se toca ni se sugiere");
await c.ctx.close();
const sinRolls = { ...putVieja, prima: "50.64", rollChain: [] };
const d = await abrir([sinRolls, { ...accVieja, bep: String(COSTE) }]);
ok(!/Corregir a/.test(await verB1(d.page)), "sin rolls tampoco: las dos reglas dan lo mismo");
await d.ctx.close();

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
