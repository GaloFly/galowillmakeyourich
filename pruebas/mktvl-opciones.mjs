/* ---------------------------------------------------------------------------
   EL VALOR DE MERCADO DE LAS OPCIONES (v5.20)

   Victor, comparando su app contra IBKR con el filtro puesto en su bróker: *"no estoy de acuerdo,
   mira, solo filtrando IBKR no cuadran MKT VL, NLV y EL"*. Tenía razón, y cuadraba al céntimo por
   una sola causa:

       MKT VL   app 141.931  ·  IBKR 155.111  →  −13.180
         · las opciones sin su valor real ....... 12.013
         · precios de acciones con retraso ......  1.167
       NLV y EL: la misma diferencia + 912 de cash escrito de más, porque
       NLV = MKT VL + cash  y  EL = NLV − Margin.

   El valor de mercado de una ACCIÓN se calculaba solo. El de una opción era un campo manual que no
   se actualizaba nunca, ni al pulsar 🔄 Precios — aunque desde la v4.51 la app ya pregunta al
   servidor lo que vale cada contrato y lo usa para el P&L.

   Lo que se comprueba aquí, que es lo que puede salir mal de verdad:

     · el valor de una CORTA es negativo (es una deuda: así la enseña el bróker) y el de una LARGA
       positivo — si el signo se invirtiera, el MKT VL se movería el doble y en el sentido contrario;
     · una posición de varias patas vale la suma de las suyas, con su signo;
     · NLV y EL se mueven con él, que es lo que Victor veía descuadrado;
     · los dos candados de la v4.51 siguen puestos: sin servidor no se usa NI UNA marca, y si falta
       la de UNA pata no se usa ninguna (ni medio real, ni medio inventado);
     · y se dice en pantalla de dónde sale el número y a cuántas opciones cubre.

     node pruebas/mktvl-opciones.mjs
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
const PUERTO = 8349;
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
   Tres posiciones con las cuentas escritas, tomadas del ORCL y los IBIT reales de Victor.

   ORCL · short put 190, 2 contratos, cotizando a 40,02 por acción
       lo que costaría cerrarla = 40,02 × 200 = $8.004  →  vale −$8.004   (IBKR: −8.005)
   IBIT · long call 39, 1 contrato, cotizando a 47,29
       cerrarla te DARÍA 47,29 × 100                    →  vale +$4.729   (IBKR: 4.729)
   SPY  · credit spread 560/550, 1 contrato: corta a 4,10 y larga a 1,60
       cerrarlo cuesta (4,10 − 1,60) × 100 = $250       →  vale   −$250

   MKT VL de las opciones = −8.004 + 4.729 − 250 = −$3.525
   Y con 100 acciones de NVDA a $130 = $13.000 →  MKT VL total = $9.475
--------------------------------------------------------------------------- */
const MK = { ORCL: 40.02, IBIT: 47.29, SPY_S: 4.10, SPY_L: 1.60 };
const r2x = (v) => Math.round(v * 100) / 100;
const VAL_ORCL = r2x(-MK.ORCL * 200);                       /* −8.004 */
const VAL_IBIT = r2x(MK.IBIT * 100);                        /*  4.729 */
const VAL_SPY = r2x(-(MK.SPY_S - MK.SPY_L) * 100);          /*   −250 */
const VAL_ACC = 130 * 100;                             /* 13.000 */
const MKTVL = VAL_ACC + VAL_ORCL + VAL_IBIT + VAL_SPY; /*  9.475 */
const CASH = -5000, MARGIN = 3000;
const NLV = MKTVL + CASH;                              /*  4.475 */
const EL = NLV - MARGIN;                               /*  1.475 */

/* los códigos de Futu que la app pide al servidor: US.TICKER + AAMMDD + P|C + strike×1000 */
const MARCAS = {
  orcl: { "US.ORCL261016P190000": MK.ORCL },
  ibit: { "US.IBIT271217C39000": MK.IBIT },
  spy: { "US.SPY261218P560000": MK.SPY_S, "US.SPY261218P550000": MK.SPY_L },
};
const POS = [
  { id: "acc", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
    entryDate: "2026-02-01", broker: "IBKR", comision: "0" },
  { id: "orcl", tkr: "ORCL", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "200", strike: "190",
    expiry: "2026-10-16", prima: "43.72", entryDate: "2026-06-01", broker: "IBKR", comision: "0", optMarks: MARCAS.orcl },
  { id: "ibit", tkr: "IBIT", block: 2, tipo: "Long Call", nat: "DEB", right: "C", qty: "100", strike: "39",
    expiry: "2027-12-17", prima: "49.91", entryDate: "2026-06-01", broker: "IBKR", comision: "0", optMarks: MARCAS.ibit },
  { id: "spy", tkr: "SPY", block: 3, tipo: "Spread", nat: "DEF", right: "P", qty: "100", expiry: "2026-12-18",
    sK: "560", sP: "4.20", lK: "550", lP: "1.80", entryDate: "2026-08-01", broker: "IBKR", comision: "0", optMarks: MARCAS.spy },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
await ctx.route(/puente\.alphavext\.com/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
const sembrar = (conPuente) => page.addInitScript(({ pos, cash, margin, puente }) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "portfolio");
  if (puente) localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
}, { pos: POS, cash: CASH, margin: MARGIN, puente: conPuente });

await sembrar(true);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(500);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------------------------------------------------------------------------
   1. LA FUNCIÓN, leída del COMPILADO. Es donde vive el signo, que es lo que puede salir al revés.
--------------------------------------------------------------------------- */
console.log("=== el valor de cada posición, y su SIGNO ===");
const hay = await page.evaluate(() => ["mktRealOpcion", "effMkt", "mktEsReal"].every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const vals = await page.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const out = {};
  pos.forEach((p) => { out[p.id] = { real: r(mktRealOpcion(p)), eff: r(effMkt(p)), esReal: mktEsReal(p) }; });
  return out;
}, POS);
console.log("  ORCL short put → " + vals.orcl.eff + "   (esperado " + VAL_ORCL + ")");
console.log("  IBIT long call → " + vals.ibit.eff + "   (esperado " + VAL_IBIT + ")");
console.log("  SPY  spread    → " + vals.spy.eff + "   (esperado " + VAL_SPY + ")");
ok(vals.orcl.eff === r2(VAL_ORCL), "una CORTA vale en contra: −40,02 × 200 = " + VAL_ORCL + " (sale " + vals.orcl.eff + ")");
ok(vals.ibit.eff === r2(VAL_IBIT), "una LARGA vale a favor: +47,29 × 100 = " + VAL_IBIT + " (sale " + vals.ibit.eff + ")");
ok(vals.spy.eff === r2(VAL_SPY), "y un spread, la suma de sus patas: −(4,10 − 1,60) × 100 = " + VAL_SPY + " (sale " + vals.spy.eff + ")");
ok(vals.orcl.esReal && vals.ibit.esReal && vals.spy.esReal, "las tres se marcan como valor REAL");
/* el control que impide el fallo más tonto: que el signo esté invertido y nadie lo note */
ok(vals.orcl.eff < 0 && vals.ibit.eff > 0, "la corta en negativo y la larga en positivo, no al revés");

console.log("\n=== los dos candados de la v4.51 siguen puestos ===");
const candados = await page.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const spy = pos.find((p) => p.id === "spy");
  /* al spread se le quita la marca de UNA pata: o están todas, o no se usa ninguna */
  const coja = { ...spy, optMarks: { "US.SPY261218P560000": 4.10 }, mktValue: "-999" };
  /* y una con el interruptor en Manual: manda lo escrito */
  const manual = { ...spy, mktModo: "MANUAL", mktValue: "-777" };
  return { coja: r(effMkt(coja)), cojaReal: mktEsReal(coja), manual: r(effMkt(manual)), manualReal: mktEsReal(manual) };
}, POS);
console.log("  spread al que le falta una pata → " + candados.coja + "  ·  con el interruptor en Manual → " + candados.manual);
ok(candados.coja === -999 && candados.cojaReal === false,
  "si falta la marca de UNA pata no se usa ninguna: cae al valor escrito (sale " + candados.coja + ")");
ok(candados.manual === -777 && candados.manualReal === false,
  "y en Manual manda lo que escribas, aunque haya precios (sale " + candados.manual + ")");

/* ---------------------------------------------------------------------------
   2. LOS TRES NÚMEROS QUE VICTOR VEÍA DESCUADRADOS
--------------------------------------------------------------------------- */
/* y el control que MÁS falta hacía: una estructura que la app no sabe descomponer (Iron Condor,
   Calendar suelto) no vale cero — conserva lo que escribiste. Sin esta comprobación, el primer
   intento de este arreglo les ponía 0 y les restaba su valor del MKT VL en silencio. */
const sinPatas = await page.evaluate(() => {
  const ic = { id: "ic", tkr: "SPX", block: 3, tipo: "Iron Condor", nat: "DEF", qty: "100",
    expiry: "2026-12-18", mktValue: "-1234", optMarks: { "US.SPX261218P560000": 4.1 } };
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  return { patas: patasDePosicion(ic).length, real: r(mktRealOpcion(ic)), eff: r(effMkt(ic)), esReal: mktEsReal(ic) };
});
console.log("  Iron Condor (sin patas descritas) → patas " + sinPatas.patas + " · valor " + sinPatas.eff);
ok(sinPatas.patas === 0, "la app no sabe descomponer un Iron Condor (sigue siendo manual, como siempre)");
ok(sinPatas.real === null, "y por eso NO le inventa un valor real");
ok(sinPatas.eff === -1234 && sinPatas.esReal === false, "conserva el valor que escribiste: -1234 (sale " + sinPatas.eff + ")");

console.log("\n=== MKT VL · NLV · EL, en pantalla ===");
console.log("  acciones 13.000 + ORCL −8.004 + IBIT +4.729 + SPY −250 = MKT VL " + MKTVL);
console.log("  NLV = MKT VL + cash (−5.000) = " + NLV + "   ·   EL = NLV − margin (3.000) = " + EL);
const leer = () => page.evaluate(() => {
  const t = document.body.innerText;
  const num = (re) => { const m = t.match(re); return m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN; };
  return {
    mkt: num(/VALOR MERCADO\s*\n\s*(-?)\$([\d,]+)/),
    nlv: num(/VALOR DE LA CUENTA[\s\S]{0,60}?(-?)\$([\d,]+)/),
    el: num(/(-?)\$([\d,]+)\s*\n\s*Excess Liq/),
    cobertura: (t.match(/[^\n]*opciones con precio real[^\n]*/) || [""])[0],
  };
});
/* el Excess Liq vive en la tarjeta de cuenta, que arranca PLEGADA: sin desplegarla la lectura
   devolvía NaN y parecía un fallo de la app. */
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll("span, div")).find((e) => (e.innerText || "").trim() === "▼");
  if (t) t.click();
});
await page.waitForTimeout(700);
const v = await leer();
console.log("  en pantalla → MKT VL $" + v.mkt + " · NLV $" + v.nlv + " · EL $" + v.el);
ok(v.mkt === MKTVL, "MKT VL = $" + MKTVL + " (sale $" + v.mkt + ")");
ok(v.nlv === NLV, "NLV = $" + NLV + " (sale $" + v.nlv + ")");
ok(v.el === EL, "Excess Liq = $" + EL + " (sale $" + v.el + ")");

console.log("\n=== y se dice de dónde sale, cubra a todas o no ===");
console.log("  " + (v.cobertura || "(no dice nada)"));
ok(/3 opciones con precio real|Tus 3 opciones/.test(v.cobertura), "la cabecera dice a cuántas opciones cubre");

/* ---------------------------------------------------------------------------
   2b. v5.21 — DECIR CUÁLES FALTAN, NO SOLO CUÁNTAS.
   Victor, tras la v5.20: *"sigue igual"*. Y no era verdad del todo — el MKT VL había subido 2.218 y
   el aviso ya decía "6 de tus 11 opciones con precio real · 5 sin precio todavía". Pero con un "5"
   no se puede hacer nada: no sabes dónde mirar. Y los dos motivos posibles se arreglan de forma
   distinta: a unas les falta pulsar 🔄 Precios, y a otras les falta un DATO (a un PMCC sin el
   vencimiento de su pata larga la app no sabe qué contrato pedir, por muchas veces que pulses).
--------------------------------------------------------------------------- */
console.log("\n=== y dice CUÁLES faltan, separando los dos motivos ===");
const POS2 = [
  POS[0], POS[1],                                   /* NVDA acción · ORCL con precio */
  { ...POS[2], id: "ibit2", optMarks: {} },         /* IBIT: describible, pero sin precio → 🔄 Precios */
  { id: "pmcc", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "70",
    expiry: "2027-01-21", prima: "8", long: { strike: "60" }, entryDate: "2026-06-01", broker: "IBKR" },
];  /* al PMCC le falta el VENCIMIENTO de la pata larga: no hay contrato que pedir */
const ctx3 = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx3.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
await ctx3.route(/puente\.alphavext\.com/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
const p3 = await ctx3.newPage();
await p3.addInitScript(({ pos, cash, margin }) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "portfolio");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
}, { pos: POS2, cash: CASH, margin: MARGIN });
await p3.goto(URL_APP, { waitUntil: "load" });
await p3.waitForTimeout(2600);
await p3.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await p3.waitForTimeout(600);
const aviso = await p3.evaluate(() => {
  const t = document.body.innerText;
  return { cab: (t.match(/[^\n]*opciones con precio real[^\n]*/) || [""])[0],
    falta: (t.match(/Sin precio todavía:[^\n]*/) || [""])[0],
    roto: (t.match(/A [^\n]*no se le puede pedir precio[^\n]*/) || [""])[0] };
});
console.log("  " + aviso.cab);
console.log("  " + aviso.falta);
console.log("  " + aviso.roto.slice(0, 150));
ok(/1 de tus 3 opciones/.test(aviso.cab), "la cabecera cuenta bien: 1 de 3 (sale: " + aviso.cab + ")");
ok(/IBIT/.test(aviso.falta) && /Precios/.test(aviso.falta), "NOMBRA la que solo necesita un refresco, y dice qué pulsar");
ok(/ASTS/.test(aviso.roto), "y NOMBRA la que no se puede pedir por falta de datos");
ok(!/ASTS/.test(aviso.falta), "sin mezclarlas: al PMCC roto no se le arregla pulsando 🔄 Precios");
ok(/vencimiento|strike|prima/i.test(aviso.roto), "y dice QUÉ dato falta, para poder ir a completarlo");
await ctx3.close();

/* ---------------------------------------------------------------------------
   3. SIN SERVIDOR: NI UNA MARCA. La red de seguridad de los dos amigos de Victor.
--------------------------------------------------------------------------- */
console.log("\n=== sin servidor propio, todo como antes de la v4.51 ===");
const ctx2 = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx2.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
const p2 = await ctx2.newPage();
const errores2 = [];
p2.on("pageerror", (e) => errores2.push(e.message));
await p2.addInitScript(({ pos, cash, margin }) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "portfolio");
}, { pos: POS, cash: CASH, margin: MARGIN });
await p2.goto(URL_APP, { waitUntil: "load" });
await p2.waitForTimeout(2600);
await p2.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await p2.waitForTimeout(500);
const sinPuente = await p2.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const o = pos.find((x) => x.id === "orcl");
  const t = document.body.innerText;
  const m = t.match(/VALOR MERCADO\s*\n\s*(-?)\$([\d,]+)/);
  return { orcl: r(effMkt(o)), esReal: mktEsReal(o), mkt: m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN,
    dice: /opciones con precio real/.test(t) };
}, POS);
console.log("  ORCL → " + sinPuente.orcl + " (era " + VAL_ORCL + " con servidor) · MKT VL $" + sinPuente.mkt);
ok(sinPuente.orcl === 0 && sinPuente.esReal === false, "sin servidor NO se usa ni una marca, aunque estén guardadas (sale " + sinPuente.orcl + ")");
ok(sinPuente.mkt === VAL_ACC, "y el MKT VL vuelve a ser solo el de las acciones: $" + VAL_ACC + " (sale $" + sinPuente.mkt + ")");
ok(!sinPuente.dice, "y no se presume de precios reales que no hay");
ok(!errores2.length, "sin errores de JS " + JSON.stringify(errores2.slice(0, 2)));
await ctx2.close();

await page.screenshot({ path: D + "/mktvl-opciones.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
