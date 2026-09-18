/* ---------------------------------------------------------------------------
   UN PMCC SIN CORTA TAMBIÉN VENCE (v5.26)

   Victor, con la v5.25 ya funcionando: *"funciona, pero los vencimientos, no aparecen vencimientos.
   Fíjate que solo hay vencimientos hasta 2027"* — teniendo dos LEAPS de ASTS de 2028 en cartera.

   Vencimientos agrupaba por `p.expiry`, y un PMCC al que le recompraron o expiró la corta NO tiene:
   se le vacían strike y vencimiento a propósito desde la v3.46. Lo único que le queda es la call
   comprada, con su vencimiento propio años más lejos. Resultado: esas posiciones **no salían en
   Vencimientos en absoluto** — ni en la lista, ni en el conteo, ni en el riesgo total. Una posición
   que desaparece no se distingue de una que no existe.

   Lo que se comprueba:

     · el PMCC sin corta aparece bajo el vencimiento de SU pata larga, con su riesgo;
     · y con el strike de la larga, no con un hueco (la fila ponía solo "C");
     · el riesgo total y el conteo de operaciones lo incluyen — y UNA sola vez, no dos;
     · un PMCC que SÍ tiene corta sigue exactamente donde estaba: bajo la fecha de su corta;
     · y el semáforo lo juzga como lo que es, una call COMPRADA: en peligro por debajo del BEP.
       Con la regla de las cortas saldría verde justo cuando la call se va a cero.

     node pruebas/vencimiento-pata-larga.mjs
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
const PUERTO = 8356;
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

/* ---------------------------------------------------------------------------
   Tres posiciones, con los números escritos:

     ASTS short put 63, vence 23 oct 2026 · riesgo = strike × 100 − prima × 100 = 6.300 − 820 = 5.480
     ASTS PMCC SIN corta, long call 70 del 21 ene 2028 · riesgo = débito neto = 32,50 × 100 = 3.250
     ASTS PMCC CON corta 95 del 21 ene 2027, long 60 del 21 ene 2028 · riesgo = 27,35 × 100 = 2.735

   O sea: tres fechas distintas, y la de 2028 es la que no salía.
--------------------------------------------------------------------------- */
const VTO_LARGA = "2028-01-21", VTO_CORTA = "2027-01-21", VTO_PUT = "2026-10-23";
const R_PUT = 5480, R_SIN = 3250, R_CON = 2735;
const POS = [
  { id: "put", tkr: "ASTS", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
    strike: "63", expiry: VTO_PUT, prima: "8.20", entryDate: "2026-08-01", broker: "IBKR",
    comision: "0", last: "58.55" },
  /* PMCC al que le recompraron la corta: strike y vencimiento vacíos, solo le queda la larga */
  { id: "sin", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "",
    expiry: "", prima: "2.31", noShort: true, entryDate: "2026-08-12", broker: "IBKR", comision: "0",
    pnlModo: "MANUAL", pnl: "0", mktValue: "", last: "58.55", riesgo: String(R_SIN),
    long: { strike: "70", expiry: VTO_LARGA, prima: "34.81", comision: "" },
    rollChain: [{ date: "2026-09-05", prevStrike: "80", prevExpiry: "2026-09-18", prevPrima: "4.50",
      buybackCost: 2.19, newCredit: 0, comision: 0, soloRecompra: true }] },
  /* PMCC entero: su fecha sigue siendo la de la corta */
  { id: "con", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "95",
    expiry: VTO_CORTA, prima: "8", entryDate: "2026-08-12", broker: "IBKR", comision: "0",
    pnlModo: "MANUAL", pnl: "0", mktValue: "", last: "58.55", riesgo: String(R_CON),
    long: { strike: "60", expiry: VTO_LARGA, prima: "35.35", comision: "" }, rollChain: [] },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 58.55, dp: 0, pc: 58.55, h: 58.55 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "-5000", margin: "3000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "vencimientos");
}, POS);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(800);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* ---------------------------------------------------------------------------
   1. LA FECHA BAJO LA QUE VIVE CADA POSICIÓN, leída del compilado.
--------------------------------------------------------------------------- */
console.log("=== ¿bajo qué vencimiento vive cada una? ===");
const hay = await page.evaluate(() => ["vencimientoDe", "soloPataLarga", "vencDanger"]
  .every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const fechas = await page.evaluate((pos) => {
  const out = {};
  pos.forEach((p) => { out[p.id] = { venc: vencimientoDe(p), sola: soloPataLarga(p) }; });
  return out;
}, POS);
Object.keys(fechas).forEach((k) => console.log("  " + k.padEnd(4) + " → " + (fechas[k].venc || "(ninguno)") + (fechas[k].sola ? "  (solo pata larga)" : "")));
ok(fechas.sin.venc === VTO_LARGA && fechas.sin.sola, "el PMCC sin corta vive bajo el vencimiento de su larga: " + VTO_LARGA);
ok(fechas.con.venc === VTO_CORTA && !fechas.con.sola, "el PMCC entero sigue bajo la fecha de su CORTA: " + VTO_CORTA + " (no la de 2028)");
ok(fechas.put.venc === VTO_PUT, "y la short put, donde siempre");

/* ---------------------------------------------------------------------------
   2. EL SEMÁFORO: una call COMPRADA no está a salvo por estar bajo su strike.
--------------------------------------------------------------------------- */
console.log("\n=== el semáforo juzga la larga como larga ===");
/* el BEP de esa fila es el de la v5.27: strike de la larga 70 + débito neto 32,50 = 102,50 */
const sem = await page.evaluate(() => ({
  /* ASTS a 58,55: por debajo del break-even Y por debajo del strike — hoy expiraría sin valor */
  sola: vencDanger({ tipo: "PMCC", solaLarga: true, right: "C", strike: "70", bep: "102.5", last: "58.55" }),
  /* por encima del break-even: en ganancia */
  solaBien: vencDanger({ tipo: "PMCC", solaLarga: true, right: "C", strike: "70", bep: "102.5", last: "110" }),
  /* el control que importa: entre el strike y el BEP (105 > 70) la regla de las CORTAS diría
     "peligro" y la de las largas "todavía en pérdida". Son cosas distintas y no pueden confundirse. */
  entreMedias: vencDanger({ tipo: "PMCC", solaLarga: true, right: "C", strike: "70", bep: "102.5", last: "90" }),
  /* y una call CORTA de verdad: peligro por encima del strike, como siempre */
  corta: vencDanger({ tipo: "PMCC", right: "C", strike: "95", bep: "27.35", last: "98" }),
}));
console.log("  larga con ASTS 58,55 → " + sem.sola + "   ·   con 110 → " + sem.solaBien + "   ·   con 90 (sobre el strike, bajo el BEP) → " + sem.entreMedias + "   ·   corta con 98 (strike 95) → " + sem.corta);
ok(sem.sola === true, "la call comprada con ASTS a 58,55 y BEP 102,5 SÍ está en pérdida (hoy expiraría sin valor)");
ok(sem.solaBien === false, "por encima del break-even, no (sale " + sem.solaBien + ")");
ok(sem.entreMedias === true, "y entre el strike y el BEP sigue en pérdida — no se juzga por el strike");
ok(sem.corta === true, "una corta sigue juzgándose por su strike (sale " + sem.corta + ")");

/* ---------------------------------------------------------------------------
   3. EN PANTALLA: las tres fechas, el conteo y el riesgo total.
--------------------------------------------------------------------------- */
console.log("\n=== en la pantalla de Vencimientos ===");
console.log("  riesgo total esperado = " + R_PUT + " + " + R_SIN + " + " + R_CON + " = " + (R_PUT + R_SIN + R_CON));
const v = await page.evaluate(() => {
  const t = document.body.innerText;
  const num = (re) => { const m = t.match(re); return m ? Number(m[1].replace(/,/g, "")) : NaN; };
  return {
    ops: num(/(\d+) operaciones/),
    peligro: num(/(\d+) en peligro/),
    total: num(/\$([\d,]+)\s*\n\s*Riesgo total/),
    fechas: (t.match(/\d{1,2} [A-Z]{3} 20\d\d/g) || []),
    tiene2028: /21 JAN 2028/.test(t),
    lineas: (t.match(/\d{1,2} [A-Z]{3} 20\d\d[\s\S]{0,40}?riesgo/g) || []).map((s) => s.replace(/\n+/g, " ")),
  };
});
v.lineas.forEach((l) => console.log("  " + l));
console.log("  operaciones: " + v.ops + " · riesgo total: $" + v.total);
ok(v.tiene2028, "la fecha de 2028 APARECE (antes no salía ninguna)");
ok(v.ops === 3, "las tres posiciones se cuentan (sale " + v.ops + ")");
ok(v.total === R_PUT + R_SIN + R_CON, "y el riesgo total las suma UNA vez cada una: $" + (R_PUT + R_SIN + R_CON) + " (sale $" + v.total + ")");
ok(v.fechas.length === 3, "hay tres filas de vencimiento, una por fecha (salen " + v.fechas.length + ")");
/* con ASTS a 58,55: la short put 63 (asignable) y la call comprada de 70 (hoy expiraría sin valor).
   El PMCC entero no: su corta es la 95 y el precio está muy por debajo. */
console.log("  en peligro: " + v.peligro);
ok(v.peligro === 2, "cuenta 2 en peligro: la put asignable y la call comprada bajo su BEP (sale " + v.peligro + ")");

/* ---------------------------------------------------------------------------
   4. Y LA FILA DICE QUÉ CONTRATO ES: el strike de la larga, no un hueco.
--------------------------------------------------------------------------- */
console.log("\n=== y la fila dice qué contrato vence ===");
await page.evaluate(() => {
  const f = Array.from(document.querySelectorAll("div")).filter((e) => /21 JAN 2028/.test(e.textContent || "") && (e.textContent || "").length < 200 && getComputedStyle(e).cursor === "pointer")
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
  if (f) f.click();
});
await page.waitForTimeout(600);
const fila = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf("21 JAN 2028");
  return i >= 0 ? t.slice(i, i + 170).replace(/\n+/g, " · ") : "(no se ve)";
});
console.log("  " + fila);
ok(/70C/.test(fila), "se etiqueta con el strike de la larga (70C), no con un hueco");
ok(!/·\s*C\s*·/.test(fila.replace(/70C/g, "")), "y no queda una 'C' suelta sin strike");

/* ---------------------------------------------------------------------------
   5. v5.27 — EL BEP ES UN PRECIO, NO UN DÉBITO.
   Victor, viendo "70C · Últ $58.27 · BEP $32.5" en la misma línea: *"el BEP de las opciones largas
   no es lo mismo que el strike price, no está relacionado; habría que sumar prima pagada más
   strike, ¿no?"*. Exacto: ahí había un DÉBITO NETO pegado a un precio, y compararlos no significa
   nada. Con solo la larga, el break-even es strike + débito: 70 + 32,50 = 102,50.
--------------------------------------------------------------------------- */
console.log("\n=== el BEP que sale junto al 'Últ' es un PRECIO ===");
const beps = await page.evaluate((pos) => {
  const sin = pos.find((p) => p.id === "sin"), con = pos.find((p) => p.id === "con");
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  return { solo: r(bepPmccSolo(sin)), debito: r(effBep(sin)), conCorta: r(bepPmccSolo(con)) };
}, POS);
console.log("  PMCC sin corta → BEP " + beps.solo + " (débito neto " + beps.debito + ")   ·   PMCC entero → " + beps.conCorta);
ok(beps.solo === 102.5, "BEP = strike 70 + débito neto 32,50 = 102,50 (sale " + beps.solo + ")");
ok(beps.debito === 32.5, "y el débito neto sigue siendo 32,50 — el número de coste no se toca");
ok(!isFinite(beps.conCorta) || beps.conCorta === null,
  "con la corta viva NO se inventa un BEP: no hay uno simple (sale " + beps.conCorta + ")");
console.log("  " + fila);
ok(/BEP \$102\.5/.test(fila), "en la fila sale BEP $102.5, no $32.5 (fila: " + fila.slice(0, 90) + ")");
ok(!/BEP \$32\.5/.test(fila), "y ya no se llama BEP a un débito");
/* y la fila del PMCC entero llama al suyo por su nombre */
await page.evaluate(() => {
  const f = Array.from(document.querySelectorAll("div")).filter((e) => /21 JAN 2027/.test(e.textContent || "") && (e.textContent || "").length < 200 && getComputedStyle(e).cursor === "pointer")
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
  if (f) f.click();
});
await page.waitForTimeout(600);
const fila2027 = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf("21 JAN 2027");
  return i >= 0 ? t.slice(i, i + 150).replace(/\n+/g, " · ") : "(no se ve)";
});
console.log("  " + fila2027);
ok(/Débito \$27\.35/.test(fila2027), "el PMCC entero enseña su débito neto LLAMADO débito (fila: " + fila2027.slice(0, 90) + ")");
ok(!/BEP/.test(fila2027), "y ahí no aparece la palabra BEP");
await page.screenshot({ path: D + "/vencimiento-pata-larga.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
