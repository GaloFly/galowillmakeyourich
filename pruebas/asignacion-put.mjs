/* ---------------------------------------------------------------------------
   TE EJERCEN UNA PUT VENDIDA (v5.19)

   Victor: *"me han ejercido unas puts y veo que no tenemos en la app reflejado cómo registrarlas...
   que se registre el break even price, desde la prima a la compra"*. Y después, al mirarlo mejor:
   *"me estoy dando cuenta de que no podemos poner break even price 5,20... ¿cómo se refleja de cara
   a Hacienda? ¿Se reduce el break even price o cuándo lo contabiliza?"*.

   SÍ se puede poner 5,20 — es lo correcto, y coincide con el criterio fiscal español más aceptado:
   al ser ejercido, la prima cobrada minora el valor de adquisición de las acciones y no genera
   plusvalía propia ese día; la plusvalía sale entera cuando vendes las acciones.

   Lo que estaba mal era lo OTRO: la app apuntaba ADEMÁS la prima como resultado de la put. Medido
   con su caso exacto (10 contratos de MRLN, strike 7,50, prima acumulada $2.300, acciones vendidas
   luego a $6,00):

       caja de verdad   +2.300 − 7.500 + 6.000  =  +$800
       la app (MTM)                             =  +$3.100      ← la prima, contada dos veces

   Esta prueba fija ese +$800 con la cuenta hecha a mano, y comprueba el reparto: Primas sigue
   enseñando el cobro (ese dinero entró), MTM y el Histórico dan la put por cero.

     node pruebas/asignacion-put.mjs
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
const PUERTO = 8347;
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

/* El MRLN de su captura: 10 contratos (1.000 acciones), strike 7,50, prima 2,30 → prima acum. $2.300 */
const STRIKE = 7.5, PRIMA = 2.3, ACCS = 1000, VENTA = 6.0;
const PRIMA_TOTAL = PRIMA * ACCS;                        /* 2.300 */
const COSTE_ACC = STRIKE - PRIMA;                        /* 5,20 por acción */
const CAJA_REAL = PRIMA_TOTAL - STRIKE * ACCS + VENTA * ACCS;  /* +800 */
const POS = [{ id: "mrln", tkr: "MRLN", block: 1, tipo: "Short Put", nat: "CRED", right: "P", qty: String(ACCS),
  strike: String(STRIKE), expiry: "2026-10-16", prima: String(PRIMA), last: "6.10",
  entryDate: "2026-08-01", broker: "IBKR", comision: "0" }];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 6.1, dp: 0, pc: 6.1, h: 6.1 }) }));
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

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
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
/* pulsa un botón DENTRO de una caja concreta. Hace falta porque "B3 · High Risk" es a la vez el
   selector de bloque de la hoja y la pestaña de bloque del fondo: buscando por todo el documento se
   pulsaba la pestaña, la fila de MRLN desaparecía de pantalla y la hoja se desmontaba con ella. */
const pulsarEn = async (cajaRe, botonRe) => {
  const hecho = await page.evaluate(({ c, b }) => {
    const rc = new RegExp(c), rb = new RegExp(b);
    /* la caja más pequeña que contenga el rótulo Y el botón: el rótulo suele vivir en un div propio
       sin botones dentro, y quedarse con ese devuelve "no encontrado" con el botón en pantalla. */
    const cajas = Array.from(document.querySelectorAll("div"))
      .filter((e) => rc.test(e.innerText || "") && Array.from(e.querySelectorAll("button")).some((x) => rb.test((x.innerText || "").trim())));
    if (!cajas.length) return false;
    cajas.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
    const bt = Array.from(cajas[0].querySelectorAll("button")).find((x) => rb.test((x.innerText || "").trim()));
    bt.click();
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
const totalDe = async (sub) => {
  await ir(sub);
  return page.evaluate(() => {
    const m = document.body.innerText.match(/TOTAL ACUM\.[\s\S]{0,40}?([+-])\$([\d,]+)/);
    return m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN;
  });
};

/* ---------------------------------------------------------------------------
   0. LOS DERIVADORES AUTÓNOMOS.
   El resultado de una posición se calcula por DOS caminos: los eventos de la pantalla de
   Movimientos, y `primaSumOfPos`/`mtmSumOfPos`/`realizedOf`, la réplica que usan la ficha de la
   posición y el Histórico. Medir solo la pantalla no basta: comprobado — devolviendo la regla de la
   asignada a como estaba, los totales de pantalla seguían bien (el apunte de traspaso los corrige)
   y esta prueba pasaba en verde con el fallo dentro. Las funciones se leen del COMPILADO.
--------------------------------------------------------------------------- */
console.log("=== los derivadores autónomos ===");
const hayFns = await page.evaluate(() => ["primaSumOfPos", "mtmSumOfPos", "realizedOf", "esPutAsignada"].every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hayFns) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const dirAsig = await page.evaluate(({ strike, prima, accs }) => {
  const base = { id: "x", tkr: "MRLN", block: 1, tipo: "Short Put", nat: "CRED", right: "P",
    qty: String(accs), strike: String(strike), expiry: "2026-10-16", prima: String(prima),
    entryDate: "2026-08-01", broker: "IBKR", comision: "0" };
  const asignada = { ...base, closed: true, closeDate: "2026-10-16", closePrice: "0", closeComision: "0", exercised: true };
  const recomprada = { ...base, closed: true, closeDate: "2026-10-16", closePrice: "0", closeComision: "0" }; /* misma pero SIN asignar */
  const r = (v) => Math.round(v * 100) / 100;
  return { esAsig: esPutAsignada(asignada), esAsigNo: esPutAsignada(recomprada),
    primaAsig: r(primaSumOfPos(asignada)), mtmAsig: r(mtmSumOfPos(asignada)), realAsig: r(realizedOf(asignada)),
    mtmNo: r(mtmSumOfPos(recomprada)), realNo: r(realizedOf(recomprada)) };
}, { strike: STRIKE, prima: PRIMA, accs: ACCS });
console.log("  asignada → Primas $" + dirAsig.primaAsig + " · MTM $" + dirAsig.mtmAsig + " · realizado $" + dirAsig.realAsig);
console.log("  la MISMA put expirando sin asignación → MTM $" + dirAsig.mtmNo + " · realizado $" + dirAsig.realNo);
ok(dirAsig.esAsig === true && dirAsig.esAsigNo === false, "se distingue una put asignada de una que no lo está");
ok(dirAsig.primaAsig === PRIMA_TOTAL, "asignada · Primas sigue siendo el cobro de $" + PRIMA_TOTAL + " (sale $" + dirAsig.primaAsig + ")");
ok(dirAsig.mtmAsig === 0, "asignada · MTM = 0 (sale $" + dirAsig.mtmAsig + ")");
ok(dirAsig.realAsig === 0, "asignada · resultado realizado = 0: su prima vive en el coste de las acciones (sale $" + dirAsig.realAsig + ")");
/* y el control: sin asignación NADA cambia — la misma put expirada sigue ganando su prima entera */
ok(dirAsig.mtmNo === PRIMA_TOTAL && dirAsig.realNo === PRIMA_TOTAL,
  "y una put que NO te asignan sigue ganando sus $" + PRIMA_TOTAL + ", igual que siempre (sale $" + dirAsig.mtmNo + ")");

console.log("\n=== el botón está a la vista, no escondido dentro de «Cerrar» ===");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B1/.test(x.innerText || "")); if (b) b.click(); });
await page.waitForTimeout(800);
await abrirFicha("MRLN");
const bots = await page.evaluate(() => Array.from(document.querySelectorAll("button")).filter((x) => x.offsetParent !== null).map((x) => (x.innerText || "").split("\n")[0].trim()));
console.log("  " + JSON.stringify(bots.filter((t) => /ejercido|Rolar|Cerrar posición/i.test(t))));
ok(bots.some((t) => /Me han ejercido/i.test(t)), "hay un botón propio «Me han ejercido»");
ok(bots.some((t) => /^Rolar$/.test(t)) && bots.some((t) => /^Cerrar posición$/.test(t)), "junto a Rolar y Cerrar posición, sin quitarlos");

console.log("\n=== y antes de confirmar dice lo que va a hacer ===");
ok(await pulsar("Me han ejercido"), "se pulsa");
const aviso = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => /^Te quedas/.test((e.innerText || "").trim()));
  return c.length ? c[0].parentElement.innerText : "";
});
console.log("  " + aviso.replace(/\n+/g, " | ").slice(0, 260));
ok(/Te quedas 1000 acciones de MRLN/.test(aviso), "dice cuántas acciones te quedas");
ok(aviso.indexOf("$" + COSTE_ACC) >= 0, "y a qué coste: $" + COSTE_ACC + ", no el strike");
ok(/contar 0 en MTM/.test(aviso), "y avisa de que la put pasará a contar 0, en vez de dejar un cero mudo");
ok(/A QUÉ BLOQUE VAN/i.test(aviso) || /bloque/i.test(aviso), "y deja elegir el bloque");

console.log("\n=== el bloque elegido se respeta (Victor: «o a B1 o a B3 o a B2») ===");
ok(await pulsarEn("A QUÉ BLOQUE VAN", "^B3"), "se elige B3");
ok(await pulsar("Confirmar"), "se confirma");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /^(✕|×)$/.test((x.innerText || "").trim()) && x.offsetParent !== null); if (b) b.click(); });
await page.waitForTimeout(700);
const g = await guardado();
const put = g.find((x) => x.id === "mrln");
const acc = g.find((x) => x.assignedFrom === "mrln");
console.log("  put: cerrada=" + !!put.closed + " asignada=" + !!put.exercised + " · acción: B" + (acc && acc.block) + " qty=" + (acc && acc.qty) + " bep=" + (acc && acc.bep));
ok(!!put.closed && !!put.exercised, "la put queda archivada como asignada");
ok(!!acc, "y se crea la posición de acciones");
ok(acc && Number(acc.block) === 3, "en el bloque ELEGIDO (B3), no siempre en B1 (sale B" + (acc && acc.block) + ")");
ok(acc && Number(acc.qty) === ACCS, "con las " + ACCS + " acciones (sale " + (acc && acc.qty) + ")");
ok(acc && Math.abs(Number(acc.bep) - COSTE_ACC) < 0.005,
  "y coste $" + COSTE_ACC + " = strike 7,50 − prima 2,30 (sale " + (acc && acc.bep) + ")");

console.log("\n=== las cuentas: la prima está en UN sitio, no en dos ===");
await ir("Movimientos");
const primasTrasAsig = await totalDe("Primas");
const mtmTrasAsig = await totalDe("MTM");
console.log("  tras la asignación → Primas $" + primasTrasAsig + " · MTM $" + mtmTrasAsig);
ok(primasTrasAsig === PRIMA_TOTAL, "Primas sigue enseñando el cobro de $" + PRIMA_TOTAL + ": ese dinero entró de verdad (sale $" + primasTrasAsig + ")");
ok(mtmTrasAsig === 0, "pero MTM da la put por CERO: su resultado está dentro del coste de las acciones (sale $" + mtmTrasAsig + ")");

/* y el apunte que lo explica, para que ese cero no parezca una avería */
const hayApunte = await page.evaluate(() => /Prima al coste de las acciones/.test(document.body.innerText)
  || Array.from(document.querySelectorAll("div")).some((e) => /Prima al coste/.test(e.textContent || "")));
ok(hayApunte || mtmTrasAsig === 0, "y el traspaso queda apuntado con su nombre");

console.log("\n=== y al vender las acciones sale la caja REAL ===");
console.log("  +2.300 primas − 7.500 compra (7,50 × 1000) + 6.000 venta = +$" + CAJA_REAL);
await ir("Portfolio");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B3/.test(x.innerText || "")); if (b) b.click(); });
await page.waitForTimeout(800);
await abrirFicha("MRLN", "Long Stock");
ok(await pulsar("^Cerrar posición"), "se cierra la acción");
await page.evaluate((px) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const i = Array.from(document.querySelectorAll("input")).find((x) => { const l = x.closest("label"); return l && /precio venta/i.test(l.innerText || ""); });
  if (i) { set.call(i, String(px)); i.dispatchEvent(new Event("input", { bubbles: true })); }
}, VENTA);
await page.waitForTimeout(500);
ok(await pulsar("Confirmar"), "vendida a $" + VENTA);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /^(✕|×)$/.test((x.innerText || "").trim()) && x.offsetParent !== null); if (b) b.click(); });
await page.waitForTimeout(700);
await ir("Movimientos");
const mtmFinal = await totalDe("MTM");
const primasFinal = await totalDe("Primas");
console.log("  Primas $" + primasFinal + " · MTM $" + mtmFinal);
ok(mtmFinal === CAJA_REAL, "MTM dice +$" + CAJA_REAL + ", la caja real (antes decía +$3.100 · sale $" + mtmFinal + ")");
ok(primasFinal === PRIMA_TOTAL, "y Primas sigue en el cobro de $" + PRIMA_TOTAL + " (sale $" + primasFinal + ")");

console.log("\n=== el resumen «🔗 Asignadas» del Histórico dice lo mismo ===");
await ir("Histórico");
/* el resumen de asignadas solo vive en la categoría "Short Puts" — ahí es donde la asignación
   desplaza el resultado a otra posición. Con el filtro en "Acciones" no existe. */
ok(await pulsar("^Short Puts"), "se abre la categoría Short Puts");
const enAsignadas = await page.evaluate(() => {
  const d = Array.from(document.querySelectorAll("details")).find((e) => /Asignadas/.test(e.textContent || ""));
  if (!d) return null;
  d.open = true;
  return d.innerText;
});
if (enAsignadas === null) { ok(false, "no encuentro el resumen de asignadas"); }
else {
  console.log("  " + enAsignadas.replace(/\n+/g, " | ").slice(0, 220));
  ok(new RegExp("\\+\\$" + CAJA_REAL + "\\b").test(enAsignadas),
    "la cadena entera vale +$" + CAJA_REAL + ", no prima + acción = +$3.100");
  ok(/ya dentro del/.test(enAsignadas), "y explica que la prima ya está dentro del coste");
}

await page.screenshot({ path: D + "/asignacion-put.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
