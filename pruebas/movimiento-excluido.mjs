/* ---------------------------------------------------------------------------
   ELIMINAR UN MOVIMIENTO DEL HISTÓRICO (v5.15 · confirmación en la v5.16)

   Victor: *"que en el histórico de movimientos se pueda editar el movimiento para borrarlo y que
   no se cuente ni en MTM ni en primas"*.

   Lo que hace esto delicado: los movimientos del Histórico NO son registros guardados, se DERIVAN
   de la posición en cada pintado. Y se derivan DOS veces por dos caminos distintos —las listas de
   Primas/MTM dentro de la pantalla, y `primaSumOfPos`/`mtmSumOfPos`, que son la réplica autónoma
   que usan la ficha de la posición y el Histórico—. Si la exclusión solo llegara a uno de los dos,
   la lista y el total dirían cosas distintas: exactamente el descuadre que se pide arreglar.

   Por eso se comprueba en los dos sitios y con números hechos a mano:

     · un roll excluido baja Primas EXACTAMENTE su importe de Primas ($298) y MTM EXACTAMENTE el
       suyo ($198) — que son distintos a propósito: una sola clave, dos cuentas;
     · los derivadores autónomos dan lo mismo que las listas;
     · se pide CONFIRMACIÓN, y mientras pregunta no ha pasado nada todavía: Cancelar no borra;
     · el movimiento no se esfuma de la app: queda en la papelera, en gris y tachado, y vuelve de un toque;
     · la posición NO se toca (el roll sigue en la cadena con su strike y su fecha): lo único que
       se guarda es la clave en `p.omit`, campo nuevo y opcional;
     · y una posición sin `p.omit` se comporta EXACTAMENTE como antes (regla de formato de datos).

     node pruebas/movimiento-excluido.mjs
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
const PUERTO = 8341;
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
   La cartera, elegida para que cada número se pueda comprobar a mano.

   TMDX — short put de 1 contrato, vendida a 3,00 con $1 de comisión y rolada una vez:
     recompra 1,00 · venta nueva 4,00 · $2 de comisión.
       Primas · apertura:  3,00 × 100 − 1        = +$299   (junio)
       Primas · roll:     (4,00 − 1,00) × 100 − 2 = +$298   (julio)
       MTM    · roll:     (3,00 − 1,00) × 100 − 2 = +$198   (julio)
     Los dos importes del MISMO movimiento son DISTINTOS a propósito: si la exclusión se
     aplicara con el importe equivocado, o solo en una pestaña, saltaría aquí.

   NVDA — 100 acciones a $100 con un dividendo de $50 y una venta de 40 acciones a $130:
       Primas · dividendo:  +$50
       MTM    · dividendo:  +$50   ·   MTM · venta del lote: (130 − 100) × 40 = +$1.200
--------------------------------------------------------------------------- */
const SP = {
  id: "sp1", tkr: "TMDX", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
  strike: "70", expiry: "2026-12-18", prima: "4.00", last: "76.00",
  entryDate: "2026-06-01", broker: "IBKR", comision: "1",
  rollChain: [{ date: "2026-07-10", prevStrike: "70", prevExpiry: "2026-09-18", prevPrima: "3.00",
    buybackCost: "1.00", newCredit: "4.00", comision: "2", ivr: "", note: "" }],
};
const ST = {
  id: "st1", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "60", entry: "100",
  bep: "100", last: "130", entryDate: "2026-02-01", broker: "IBKR", comision: "0",
  dividends: [{ id: "dv1", date: "2026-08-05", amount: "50", ret: "0", fee: "0" }],
  soldLots: [{ id: "sl1", date: "2026-08-20", qty: "40", cost: "100", price: "130", fee: "0" }],
};

const PRIMAS_APERTURA = 299, PRIMAS_ROLL = 298, MTM_ROLL = 198, DIV = 50, VENTA = 1200;
const PRIMAS_TOTAL = PRIMAS_APERTURA + PRIMAS_ROLL + DIV;   /* 647 */
const MTM_TOTAL = MTM_ROLL + DIV + VENTA;                   /* 1448 */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
}, [SP, ST]);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2400);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(400);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]"));

/* ---------------------------------------------------------------------------
   1. LOS DERIVADORES AUTÓNOMOS. Se leen del COMPILADO —no se copian aquí— porque una copia se
   comprobaría contra sí misma y pasaría siempre aunque la app hiciera otra cosa.
--------------------------------------------------------------------------- */
console.log("=== los derivadores autónomos (primaSumOfPos / mtmSumOfPos) ===");
const hay = await page.evaluate(() => ["primaSumOfPos", "mtmSumOfPos", "omitidoMov"].every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }

const medir = (sp, st) => page.evaluate(({ sp, st }) => {
  const r = (x) => Math.round(x * 100) / 100;
  return { primaSP: r(primaSumOfPos(sp)), mtmSP: r(mtmSumOfPos(sp)), mtmST: r(mtmSumOfPos(st)) };
}, { sp, st });

const base = await medir(SP, ST);
console.log("  sin excluir nada → Primas SP $" + base.primaSP + " · MTM SP $" + base.mtmSP + " · MTM ST $" + base.mtmST);
ok(base.primaSP === PRIMAS_APERTURA + PRIMAS_ROLL, "una posición SIN `omit` cuenta como siempre: $" + (PRIMAS_APERTURA + PRIMAS_ROLL) + " (sale $" + base.primaSP + ")");
ok(base.mtmSP === MTM_ROLL, "y su MTM son los $" + MTM_ROLL + " del roll (sale $" + base.mtmSP + ")");
ok(base.mtmST === DIV + VENTA, "y el de la acción, dividendo + venta = $" + (DIV + VENTA) + " (sale $" + base.mtmST + ")");

const conRoll = await medir({ ...SP, omit: ["roll0"] }, { ...ST, omit: ["divdv1"] });
console.log("  excluyendo el roll y el dividendo → Primas SP $" + conRoll.primaSP + " · MTM SP $" + conRoll.mtmSP + " · MTM ST $" + conRoll.mtmST);
ok(conRoll.primaSP === PRIMAS_APERTURA, "el roll excluido quita sus $" + PRIMAS_ROLL + " de Primas y deja la apertura (sale $" + conRoll.primaSP + ")");
ok(conRoll.mtmSP === 0, "y sus $" + MTM_ROLL + " de MTM, que es OTRA cifra del MISMO movimiento (sale $" + conRoll.mtmSP + ")");
ok(conRoll.mtmST === VENTA, "el dividendo excluido quita $" + DIV + " y deja la venta del lote (sale $" + conRoll.mtmST + ")");

const soloVenta = await medir(SP, { ...ST, omit: ["soldsl1"] });
ok(soloVenta.mtmST === DIV, "y una venta por lote excluida quita sus $" + VENTA + " (sale $" + soloVenta.mtmST + ")");

const dosCosas = await medir(SP, { ...ST, omit: ["divdv1", "soldsl1"] });
ok(dosCosas.mtmST === 0, "se pueden excluir varios a la vez (sale $" + dosCosas.mtmST + ")");

const desconocida = await medir({ ...SP, omit: ["roll7", "loquesea"] }, ST);
ok(desconocida.primaSP === PRIMAS_APERTURA + PRIMAS_ROLL, "una clave que no corresponde a nada no descuenta nada (sale $" + desconocida.primaSP + ")");

/* ---------------------------------------------------------------------------
   2. LA PANTALLA. Los totales de Primas y MTM antes de tocar nada.
--------------------------------------------------------------------------- */
const irA = async (nombre) => {
  await page.evaluate((t) => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === t); if (b) b.click(); }, nombre);
  await page.waitForTimeout(800);
};
const totalAcum = () => page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/TOTAL ACUM\.[\s\S]{0,40}?([+-])\$([\d,]+)/);
  return m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN;
});

await irA("Movimientos");
console.log("\n=== los totales en pantalla, antes de tocar nada ===");
const p0 = await totalAcum();
await irA("MTM");
const m0 = await totalAcum();
console.log("  Primas $" + p0 + " · MTM $" + m0);
ok(p0 === PRIMAS_TOTAL, "Primas suma $" + PRIMAS_TOTAL + " = 299 apertura + 298 roll + 50 dividendo (sale $" + p0 + ")");
ok(m0 === MTM_TOTAL, "MTM suma $" + MTM_TOTAL + " = 198 roll + 50 dividendo + 1.200 venta (sale $" + m0 + ")");

/* ---------------------------------------------------------------------------
   3. EXCLUIR EL ROLL desde la pestaña de Primas, con los mismos toques que daría Victor.
--------------------------------------------------------------------------- */
console.log("\n=== se excluye el roll desde Primas ===");
await irA("Primas");
/* el listado abre por años y meses plegados: año → mes → la fila del movimiento */
/* se pulsa el elemento MÁS PEQUEÑO que contenga el rótulo: el clic sube solo hasta la caja que
   lo escucha. Coger el más grande (o el último del documento) acierta por casualidad unas veces
   y otras pulsa el contenedor entero, que no abre nada — y entonces la prueba pasa sin haber
   desplegado nada. */
const desplegar = async (re) => {
  const hecho = await page.evaluate((patron) => {
    const rx = new RegExp(patron);
    const c = Array.from(document.querySelectorAll("div, span")).filter((e) => rx.test(e.textContent || ""));
    if (!c.length) return false;
    c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    c[0].click();
    return true;
  }, re);
  await page.waitForTimeout(600);
  return hecho;
};
ok(await desplegar("TOTAL 2026"), "se despliega el año");
ok(await desplegar("TOTAL JUL 2026"), "y el mes del roll");

/* la fila de un movimiento: se busca por TICKER + importe a la vez. Solo por el importe se pillan
   también las cajas de totales del mes, que llevan la misma cifra cuando el mes tiene un solo
   movimiento — y ahí el clic pliega el mes en vez de abrir la ficha. */
const abrirFila = async (tkr, importe) => {
  const hecho = await page.evaluate(({ t, imp }) => {
    /* y con cursor de mano: el contenedor que envuelve la fila tiene EXACTAMENTE el mismo texto,
       así que por longitud puede ganar él — y no escucha el clic, con lo que no se abre nada. */
    const c = Array.from(document.querySelectorAll("div")).filter((e) => {
      const x = e.textContent || "";
      return x.indexOf(t) >= 0 && x.indexOf(imp) >= 0 && !/TOTAL/.test(x) && getComputedStyle(e).cursor === "pointer";
    });
    if (!c.length) return false;
    c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    c[0].click();
    return true;
  }, { t: tkr, imp: importe });
  await page.waitForTimeout(600);
  return hecho;
};
ok(await abrirFila("TMDX", "+$" + PRIMAS_ROLL), "se abre la ficha del roll (+$" + PRIMAS_ROLL + ")");
const hayBoton = await page.evaluate(() => /Eliminar movimiento/.test(document.body.innerText));
ok(hayBoton, "y dentro está el botón «Eliminar movimiento»");

const pulsar = async (re) => {
  const hecho = await page.evaluate((patron) => {
    const rx = new RegExp(patron);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.innerText || "") && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  }, re);
  await page.waitForTimeout(900);
  return hecho;
};

/* --- v5.16: PIDE CONFIRMACIÓN, y el botón por sí solo no borra nada --------------------------
   Lo que de verdad hay que comprobar de un "¿seguro?" no es que salga el cartel, es que MIENTRAS
   está en pantalla no haya pasado nada todavía, y que Cancelar deje las cosas como estaban. Un
   diálogo que confirma algo ya hecho es peor que no tenerlo. */
ok(await pulsar("Eliminar movimiento"), "se pulsa «Eliminar movimiento»");
const trasPreguntar = await page.evaluate(() => document.body.innerText);
ok(/¿Eliminar este movimiento\?/.test(trasPreguntar), "y pregunta antes de hacer nada");
ok(/Primas/.test(trasPreguntar) && /MTM/.test(trasPreguntar), "diciendo dónde dejará de contar");
ok(/Cancelar/.test(trasPreguntar) && /Sí, eliminar/.test(trasPreguntar), "con las dos salidas");
const enPregunta = await guardado();
ok(!((enPregunta.find((x) => x.id === "sp1").omit || []).length), "y de momento NO ha borrado nada");
ok((await totalAcum()) === PRIMAS_TOTAL, "el total sigue en $" + PRIMAS_TOTAL + " mientras pregunta");

ok(await pulsar("Cancelar"), "se pulsa «Cancelar»");
const trasCancelar = await guardado();
ok(!((trasCancelar.find((x) => x.id === "sp1").omit || []).length), "y no se borra nada");
ok((await totalAcum()) === PRIMAS_TOTAL, "el total tampoco se mueve (sigue en $" + PRIMAS_TOTAL + ")");
ok(await page.evaluate(() => !/¿Eliminar este movimiento\?/.test(document.body.innerText)), "y la pregunta se retira");

/* ahora sí */
ok(await pulsar("Eliminar movimiento"), "se vuelve a pulsar «Eliminar movimiento»");
ok(await pulsar("Sí, eliminar"), "y se confirma");

console.log("\n=== lo que queda guardado: SOLO la clave, la posición intacta ===");
const g = await guardado();
const gsp = g.find((x) => x.id === "sp1");
console.log("  omit:", JSON.stringify(gsp.omit), "· patas en la cadena:", (gsp.rollChain || []).length);
ok(Array.isArray(gsp.omit) && gsp.omit.length === 1 && gsp.omit[0] === "roll0", "se guarda la clave del movimiento (" + JSON.stringify(gsp.omit) + ")");
ok((gsp.rollChain || []).length === 1, "el roll SIGUE en la cadena — no se ha borrado nada de la posición");
const pata = (gsp.rollChain || [])[0] || {};
ok(pata.prevStrike === "70" && pata.buybackCost === "1.00" && pata.newCredit === "4.00",
  "con su strike y sus precios sin tocar (" + pata.prevStrike + " · " + pata.buybackCost + " → " + pata.newCredit + ")");
ok(!(g.find((x) => x.id === "st1").omit || []).length, "y la otra posición no se ha enterado de nada");

console.log("\n=== y ya no cuenta: NI en Primas NI en MTM ===");
const p1 = await totalAcum();
await irA("MTM");
const m1 = await totalAcum();
console.log("  Primas $" + p1 + " (esperado " + (PRIMAS_TOTAL - PRIMAS_ROLL) + ") · MTM $" + m1 + " (esperado " + (MTM_TOTAL - MTM_ROLL) + ")");
ok(p1 === PRIMAS_TOTAL - PRIMAS_ROLL, "Primas baja EXACTAMENTE los $" + PRIMAS_ROLL + " del roll (sale $" + p1 + ")");
ok(m1 === MTM_TOTAL - MTM_ROLL, "y MTM los $" + MTM_ROLL + " suyos, que son otra cifra (sale $" + m1 + ")");

console.log("\n=== no se esfuma: se dice cuántos hay y cuánto suman ===");
/* la cifra va en otro trozo de la caja, así que innerText la deja en OTRA línea: leerla con
   `[^\n]*` sobre el texto de la página no la ve nunca y la comprobación pasaría siempre. Se lee
   el textContent de la caja entera, que es donde de verdad están las dos cosas juntas. */
const aviso = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => /movimientos? eliminados?/.test(e.textContent || ""));
  c.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  return c.length ? c[0].textContent : "";
});
console.log("  " + (aviso || "(no dice nada)"));
ok(/Papelera/.test(aviso) && /1 movimiento eliminado/.test(aviso), "la papelera dice que hay 1 movimiento eliminado");
ok(aviso.indexOf("$" + MTM_ROLL) >= 0, "y cuánto suma lo que NO está en el total de arriba (" + aviso + ")");
/* el roll de TMDX es el ÚNICO movimiento de TMDX en MTM: si el listado plegado enseñara al
   eliminado, aquí ya saldría el ticker. Tiene que aparecer SOLO al abrirlo. */
const tkrPlegado = await page.evaluate(() => /TMDX/.test(document.body.innerText));
ok(!tkrPlegado, "y plegado no se ve el movimiento");
ok(await desplegar("movimientos? eliminados?|movimiento eliminado"), "se abre la papelera");
const tkrAbierto = await page.evaluate(() => /TMDX/.test(document.body.innerText));
ok(tkrAbierto, "y ahí sí sale el movimiento eliminado");

console.log("\n=== y vuelve de un toque ===");
ok(await abrirFila("TMDX", "+$" + MTM_ROLL), "se abre la ficha del eliminado");
const textoFicha = await page.evaluate(() => document.body.innerText);
ok(/eliminado/.test(textoFicha) && /no cuenta ni en Primas ni en MTM/.test(textoFicha), "que explica en qué estado está");
/* recuperar no pregunta: devolver algo no destruye nada */
ok(await pulsar("Recuperar este movimiento"), "se pulsa «Recuperar este movimiento»");
const m2 = await totalAcum();
await irA("Primas");
const p2 = await totalAcum();
console.log("  Primas $" + p2 + " · MTM $" + m2);
ok(m2 === MTM_TOTAL, "MTM vuelve a $" + MTM_TOTAL + " (sale $" + m2 + ")");
ok(p2 === PRIMAS_TOTAL, "y Primas a $" + PRIMAS_TOTAL + " (sale $" + p2 + ")");
const g2 = await guardado();
ok(!((g2.find((x) => x.id === "sp1").omit || []).length), "y la clave desaparece de lo guardado (" + JSON.stringify(g2.find((x) => x.id === "sp1").omit) + ")");
const noAviso = await page.evaluate(() => /Papelera/.test(document.body.innerText));
ok(!noAviso, "y con la papelera vacía, la papelera tampoco se enseña");

await page.screenshot({ path: D + "/movimiento-excluido.png", fullPage: true });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
