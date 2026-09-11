/* ---------------------------------------------------------------------------
   EL RENDIMIENTO DENTRO DE UN MOVIMIENTO DE MTM · Y REABRIR CON CONFIRMACIÓN (v5.18)

   Dos peticiones de Victor sobre la misma pantalla:

   1. *"El botón de reabrir, que cuando le des te pida confirmación, para que no le des sin querer,
      porque si no es un poco complicado volver a hacerlo."*
      Reabrir deshace el cierre: la operación sale del Histórico y para dejarla como estaba hay que
      volver a cerrarla a mano con su fecha, su precio y su comisión. De un dedazo.

   2. *"En MTM, cuando pulses cada movimiento, que te aparezca el cuadro del rendimiento que te ha
      generado; como un híbrido entre el histórico y lo que ya sale — las notas, pero también el
      cuadro de lo que ha generado."*

   Lo que de verdad hay que comprobar de cada una:

   · De la confirmación, NO que salga el cartel: que MIENTRAS pregunta la posición siga cerrada, y
     que Cancelar la deje cerrada. Un diálogo que confirma algo ya hecho es peor que no tenerlo.
   · Del cuadro, NO que aparezca: que diga EXACTAMENTE lo mismo que el Histórico. Son dos pantallas
     que enseñan el rendimiento de la misma operación; el día que una diga +51,32% y la otra +50,93%
     no habrá forma de saber cuál es la buena. Por eso la prueba abre las dos y las compara cifra a
     cifra en vez de mirar cada una por su cuenta.

     node pruebas/rendimiento-en-mtm.mjs
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
const PUERTO = 8345;
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

/* El IDT de la captura de Victor: 333 acciones a 45,73 vendidas a 69,20, casi cinco años dentro.
   Y una short put rolada, para comprobar que la variante de opciones (prima acumulada · ROI sobre
   riesgo) también cuadra entre las dos pantallas — son dos cuadros distintos, no uno. */
const POS = [
  { id: "idt", tkr: "IDT", block: 1, tipo: "Long Stock", nat: "ACC", qty: "333", entry: "45.73", bep: "45.73",
    last: "69.20", closed: true, closePrice: "69.20", closeDate: "2026-09-10", closeComision: "0",
    closeNote: "Cerrada por gestión de riesgo", entryDate: "2021-09-21", broker: "IBKR", comision: "0" },
  { id: "tmdx", tkr: "TMDX", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100", strike: "70",
    expiry: "2026-12-18", prima: "4.00", last: "76", entryDate: "2026-06-01", broker: "IBKR", comision: "1",
    rollChain: [{ date: "2026-07-10", prevStrike: "70", prevExpiry: "2026-09-18", prevPrima: "3.00",
      buybackCost: "1.00", newCredit: "4.00", comision: "2" }] },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 69.2, dp: 0, pc: 69.2, h: 69.2 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
}, POS);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(400);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]"));
const texto = () => page.evaluate(() => document.body.innerText);
/* el texto de UN cuadro concreto, no el de la página: con dos movimientos abiertos a la vez, leer
   `document.body.innerText` mezcla las cifras de los dos y una comprobación puede pasar leyendo el
   cuadro del vecino. Pasó con "no se le inventa un precio de venta". */
const cuadroDe = (tkr) => page.evaluate((t) => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => /^LA OPERACIÓN ENTERA/.test((e.innerText || "").trim()) && (e.innerText || "").indexOf(t) >= 0);
  if (!c.length) return "";
  c.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
  return c[0].innerText;
}, tkr);

const ir = async (t) => {
  await page.evaluate((s) => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === s); if (b) b.click(); }, t);
  await page.waitForTimeout(800);
};
/* pulsa el elemento MÁS PEQUEÑO que contenga el rótulo: el clic sube hasta la caja que lo escucha */
const tocar = async (re) => {
  const hecho = await page.evaluate((pat) => {
    const rx = new RegExp(pat);
    const c = Array.from(document.querySelectorAll("div, span")).filter((e) => rx.test(e.textContent || ""));
    if (!c.length) return false;
    c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    c[0].click();
    return true;
  }, re);
  await page.waitForTimeout(650);
  return hecho;
};
/* despliega año y mes ASEGURÁNDOSE del resultado: los pliegues son estado compartido entre Primas y
   MTM, así que al cambiar de pestaña pueden estar ya abiertos — y entonces "tocar el total" los
   CIERRA y la fila que se busca desaparece. Comprobado: pasó, y la prueba culpaba a la app. */
const abrirHasta = async (tkr, anio, mes) => {
  for (let i = 0; i < 3; i++) {
    const hay = await page.evaluate((t) => Array.from(document.querySelectorAll("div")).some((e) => {
      const x = (e.textContent || "");
      return x.indexOf(t) >= 0 && !/TOTAL/.test(x) && e.children.length < 6;
    }), tkr);
    if (hay) return true;
    await tocar(anio);
    await tocar(mes);
  }
  return false;
};
const pulsar = async (re) => {
  const hecho = await page.evaluate((pat) => {
    const rx = new RegExp(pat);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test((x.innerText || "").trim()) && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  }, re);
  await page.waitForTimeout(800);
  return hecho;
};
/* lee las cifras de un bloque de texto. Se usa el MISMO lector para las dos pantallas: si cada una
   tuviera el suyo, una diferencia de formato se leería como una diferencia de número. */
const cifras = (t) => ({
  pnl: (t.match(/([+-]\$[\d,]+(?:\.\d+)?)\s*\n?\s*P&L realizado/) || [])[1] || null,
  ann: (t.match(/([+-][\d.]+%)\s*\n?\s*Annualized ROI/) || [])[1] || null,
  bep: (t.match(/Precio compra \(BEP\)\s*\n?\s*(\$[\d.,]+)/) || [])[1] || null,
  venta: (t.match(/Precio venta\s*\n?\s*(\$[\d.,]+)/) || [])[1] || null,
  roi: (t.match(/([+-][\d.]+%)\s*\n?\s*ROI\b/) || [])[1] || null,
  dit: (t.match(/(\d+d)\s*\n?\s*DIT/) || [])[1] || null,
});

/* ---------------------------------------------------------------------------
   1. EL CUADRO EN MTM, Y QUE DIGA LO MISMO QUE EL HISTÓRICO
--------------------------------------------------------------------------- */
console.log("=== el cuadro dentro del movimiento de MTM ===");
await ir("Movimientos");
await ir("MTM");
ok(await abrirHasta("IDT", "^TOTAL 2026", "TOTAL SEP 2026"), "se llega hasta la fila de IDT");
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => {
    const x = e.textContent || "";
    return x.indexOf("IDT") >= 0 && !/TOTAL/.test(x) && getComputedStyle(e).cursor === "pointer";
  });
  c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (c[0]) c[0].click();
});
await page.waitForTimeout(700);
const tMtm = await texto();
ok(/LA OPERACIÓN ENTERA/.test(tMtm), "sale el cuadro, rotulado como de la OPERACIÓN (no del movimiento)");
ok(/Cerrada por gestión de riesgo/.test(tMtm), "y las notas siguen estando, que es el «híbrido» que pidió");
const enMtm = cifras(await cuadroDe("IDT"));
console.log("  MTM      → " + JSON.stringify(enMtm));
ok(enMtm.pnl && enMtm.ann && enMtm.bep && enMtm.venta && enMtm.roi && enMtm.dit,
  "con las seis cifras: P&L, anualizado, precio de compra, precio de venta, ROI y DIT");
/* ---- y las seis, HECHAS A MANO ----------------------------------------------------------------
   Comparar MTM contra el Histórico demuestra que las dos pantallas dicen lo mismo, pero NO que lo
   que dicen sea cierto: desde que comparten la misma función, un error de fórmula cambiaría las dos
   a la vez y la comparación seguiría en verde. Comprobado: cambiando el 365 del anualizado por 360,
   la prueba pasaba igual. Así que aquí van los números de esta operación, calculados aparte:
     compra 333 × $45,73 = $15.228,09   ·   venta 333 × $69,20 = $23.043,60
     P&L    = (69,20 − 45,73) × 333 = $7.815,51        →  +$7.816 redondeado
     ROI    = 7.815,51 / 15.228,09    = 51,32 %
     DIT    = 21-sep-2021 → 10-sep-2026 = 1.815 días  (fechas fijas: no depende de hoy)
     anual. = 51,3236 % × 365 / 1.815   = 10,32 %
   Si alguna de estas cinco se mueve, es que se ha cambiado un criterio — y hay que decirlo. */
ok(enMtm.pnl === "+$7,816", "P&L = (69,20 − 45,73) × 333 = +$7.816 (sale " + enMtm.pnl + ")");
ok(enMtm.bep === "$45.73", "precio de compra $45,73 (sale " + enMtm.bep + ")");
ok(enMtm.venta === "$69.2", "precio de venta $69,20 (sale " + enMtm.venta + ")");
ok(enMtm.roi === "+51.32%", "ROI = 7.815,51 / 15.228,09 = +51,32% (sale " + enMtm.roi + ")");
ok(enMtm.dit === "1815d", "DIT = 21-sep-21 → 10-sep-26 = 1815 días (sale " + enMtm.dit + ")");
ok(enMtm.ann === "+10.32%", "anualizado = 51,32% × 365/1815 = +10,32% (sale " + enMtm.ann + ")");

console.log("\n=== y dice EXACTAMENTE lo mismo que el Histórico ===");
await ir("Histórico");
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^Cerradas/.test((x.innerText || "").trim()));
  if (b) b.click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => (e.textContent || "").indexOf("IDT") >= 0 && getComputedStyle(e).cursor === "pointer");
  c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (c[0]) c[0].click();
});
await page.waitForTimeout(700);
const tHist = await texto();
const enHist = cifras(tHist);
console.log("  Histórico → " + JSON.stringify(enHist));
ok(enHist.pnl !== null, "el Histórico enseña su cuadro (si no, no habría con qué comparar)");
["pnl", "ann", "bep", "venta", "roi", "dit"].forEach((k) => {
  ok(enMtm[k] !== null && enMtm[k] === enHist[k], "coincide " + k + ": MTM " + enMtm[k] + " · Histórico " + enHist[k]);
});

console.log("\n=== en Primas NO sale: ahí la columna mide otra cosa ===");
await ir("Movimientos");
await ir("Primas");
ok(await abrirHasta("TMDX", "^TOTAL 2026", "TOTAL JUL 2026"), "se llega hasta la fila de TMDX");
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => {
    const x = e.textContent || "";
    return x.indexOf("TMDX") >= 0 && !/TOTAL/.test(x) && getComputedStyle(e).cursor === "pointer";
  });
  c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (c[0]) c[0].click();
});
await page.waitForTimeout(700);
const tPrimas = await texto();
console.log("  [primas] " + tPrimas.replace(/\n+/g, " | ").slice(240, 560));
ok(/Roll|Recompra|Venta/.test(tPrimas), "el movimiento de Primas se abre igual que siempre");
ok(!/LA OPERACIÓN ENTERA/.test(tPrimas), "y ahí NO se mete el cuadro de rendimiento");

console.log("\n=== y en una opción (otro cuadro distinto) también cuadran ===");
await ir("MTM");
ok(await abrirHasta("TMDX", "^TOTAL 2026", "TOTAL JUL 2026"), "se llega hasta la fila de TMDX");
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => {
    const x = e.textContent || "";
    return x.indexOf("TMDX") >= 0 && !/TOTAL/.test(x) && getComputedStyle(e).cursor === "pointer";
  });
  c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (c[0]) c[0].click();
});
await page.waitForTimeout(700);
const tOpt = await cuadroDe("TMDX");
const primaMtm = (tOpt.match(/([+-]\$[\d,]+(?:\.\d+)?)\s*\n?\s*Prima acumulada/) || [])[1] || null;
const romMtm = (tOpt.match(/([+-][\d.]+%)\s*\n?\s*ROI \(prima\/riesgo\)/) || [])[1] || null;
console.log("  MTM      → prima " + primaMtm + " · ROI " + romMtm);
ok(primaMtm !== null && romMtm !== null, "la opción enseña prima acumulada y ROI sobre riesgo, no precio de venta");
ok(!/Precio venta/.test(tOpt), "y no se le inventa un precio de venta: la posición sigue abierta");
/* contraste cruzado sin cambiar de pantalla: la prima acumulada que enseña el cuadro tiene que ser
   exactamente el total de la pestaña Primas de esa posición — apertura $299 + roll $298 = $597. Si
   el cuadro se calculara por su cuenta, esta suma dejaría de cuadrar. */
ok(primaMtm === "+$597", "la prima acumulada es la misma que suma la pestaña Primas: +$597 (sale " + primaMtm + ")");
ok(romMtm === "+8.91%", "y el ROI es prima/riesgo de apertura: 597 / (70−3)×100 = 8,91% (sale " + romMtm + ")");

/* ---------------------------------------------------------------------------
   2. REABRIR PIDE CONFIRMACIÓN
--------------------------------------------------------------------------- */
console.log("\n=== reabrir pregunta antes, y mientras pregunta no ha pasado nada ===");
await ir("Movimientos");
await ir("Histórico");
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /^Cerradas/.test((x.innerText || "").trim()));
  if (b) b.click();
});
await page.waitForTimeout(700);
const cerradaAntes = (await guardado()).find((x) => x.id === "idt").closed;
ok(cerradaAntes === true, "IDT parte de estar cerrada");
ok(await pulsar("^Reabrir$"), "se pulsa «Reabrir»");
const tPreg = await texto();
ok(/¿Reabrir IDT\?/.test(tPreg), "y pregunta antes de hacer nada");
ok(/volver a cerrarla a mano/.test(tPreg), "diciendo lo que costaría deshacerlo, que es el motivo de preguntar");
ok(((await guardado()).find((x) => x.id === "idt").closed) === true, "y de momento NO la ha reabierto");
ok(await pulsar("^Cancelar$"), "se pulsa «Cancelar»");
ok(((await guardado()).find((x) => x.id === "idt").closed) === true, "y sigue cerrada");
ok(!/¿Reabrir IDT\?/.test(await texto()), "y la pregunta se retira");

console.log("\n=== y confirmando, se reabre de verdad ===");
ok(await pulsar("^Reabrir$"), "se vuelve a pulsar «Reabrir»");
ok(await pulsar("Sí, reabrir"), "y se confirma");
ok(((await guardado()).find((x) => x.id === "idt").closed) === false, "ahora sí: la posición vuelve a estar activa");

await page.screenshot({ path: D + "/rendimiento-en-mtm.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
