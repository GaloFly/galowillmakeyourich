/* ---------------------------------------------------------------------------
   PMCC — RECOMPRAR LA CORTA SIN VENDER OTRA TODAVÍA (v5.10)

   Victor: *"que en un PMCC esté la opción de recomprar la corta y volver a vender una corta más
   adelante, por si se separan los trades"*.

   Lo que ya había y NO valía para esto:
     · "Rolar" recompra y vende en el MISMO acto — te obliga a saber ya la nueva.
     · "Expirar corta" deja la posición sin corta pero apuntando $0, que solo es cierto si expiró
       sin valor. Si pagaste por cerrarla, apunta un cierre gratis que no fue gratis.

   Se comprueba lo que de verdad puede salir mal, que son las CUENTAS y el dato guardado:
     · la corta desaparece (noShort, sin strike ni vencimiento) y la long sigue viva;
     · el crédito acumulado baja EXACTAMENTE por lo pagado, así que el débito neto sube igual;
     · en la cadena hay una fila de RECOMPRA y NINGUNA venta fantasma de $0 — el mismo fallo que
       la v3.46 arregló para la expiración, que aquí se repetiría solo;
     · nada de lo anterior se pierde: la pata vieja sigue en la cadena con su strike y su fecha;
     · y después se puede vender otra, que es el punto de todo esto.

     node pruebas/pmcc-recompra.mjs
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
const PUERTO = 8327;
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

/* Un PMCC de ASTS con números redondos, para poder hacer la cuenta a mano:
     long call $20 pagada a 12.00 · call corta $40 cobrada a 2.50 · 1 contrato
     débito neto de partida = 12.00 − 2.50 = 9.50 por acción  →  $950 de riesgo
   Se recompra la corta a 0.80 con $1 de comisión:
     crédito vivo = 2.50 − 0.80 = 1.70  →  débito neto = 12.00 − 1.70 = 10.30  →  $1.030 */
const PMCC = {
  id: "pm1", tkr: "ASTS", block: 3, tipo: "PMCC", nat: "CRED", right: "C", qty: "100",
  strike: "40", expiry: "2026-09-18", prima: "2.50", last: "38.20",
  long: { strike: "20", expiry: "2027-06-18", prima: "12.00" },
  entryDate: "2026-06-01", broker: "IBKR", comision: "1",
};
const RECOMPRA = 0.8, FEE = 1;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 38.2, dp: 0, pc: 38.2, h: 38.2 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify([pos]));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "portfolio");
}, PMCC);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2200);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(400);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]")[0]);

/* --- la posición vive en B3, y la vista abre en Resumen --- */
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /B3/.test(x.innerText || ""));
  if (b) b.click();
});
await page.waitForTimeout(700);

/* --- abrir la hoja de acciones de la posición --- */
const abierta = await page.evaluate(() => {
  /* la fila de la posición NO es un <button>: es un div con cursor de mano. Se busca el más
     grande que mencione ticker y estrategia — el de dentro no abre la hoja. */
  const cand = Array.from(document.querySelectorAll("div")).filter((e) =>
    /ASTS/.test(e.textContent || "") && /PMCC/.test(e.textContent || "") && getComputedStyle(e).cursor === "pointer");
  if (!cand.length) return false;
  cand.sort((a, b) => (b.innerText || "").length - (a.innerText || "").length);
  cand[0].click();
  return true;
});
await page.waitForTimeout(700);
ok(abierta, "se abre la hoja de acciones de la posición");

console.log("=== el botón nuevo existe y dice en qué se diferencia del de al lado ===");
const botones = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map((b) => (b.innerText || "").replace(/\n/g, " · ").trim()).filter(Boolean));
const bRec = botones.find((b) => /Recomprar corta/.test(b));
const bExp = botones.find((b) => /Expirar corta/.test(b));
console.log("  ·", bRec);
console.log("  ·", bExp);
ok(!!bRec, "está «Recomprar corta»");
ok(!!bExp, "y sigue estando «Expirar corta», que es otra cosa");
ok(bRec && /[Pp]agas/.test(bRec), "y el nuevo dice que PAGAS por cerrarla");
ok(bExp && /sin valor|no pagas/i.test(bExp), "y el viejo, que no se paga nada");

/* --- recomprar --- */
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /Recomprar corta/.test(x.innerText || ""));
  if (b) b.click();
});
await page.waitForTimeout(500);
await page.evaluate((v) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const campos = Array.from(document.querySelectorAll("input"));
  const pon = (re, val) => {
    const i = campos.find((x) => { const l = x.closest("label") || x.parentElement; return re.test((l && l.innerText) || ""); });
    if (i) { set.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); }
  };
  /* ojo: innerText devuelve el texto YA en mayúsculas por el text-transform del rótulo,
     así que la búsqueda tiene que ser insensible a mayúsculas */
  pon(/recompra/i, String(v.px));
  pon(/comisi/i, String(v.fee));
}, { px: RECOMPRA, fee: FEE });
await page.waitForTimeout(400);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => (x.innerText || "").trim() === "Confirmar");
  if (b) b.click();
});
await page.waitForTimeout(900);

console.log("\n=== lo que queda guardado ===");
const g = await guardado();
console.log("  prima:", g.prima, "· noShort:", g.noShort, "· strike:", JSON.stringify(g.strike), "· patas:", (g.rollChain || []).length);
ok(g.noShort === true, "la posición se queda SIN call vendida");
ok(!g.strike && !g.expiry, "y sin strike ni vencimiento, así que sale de Vencimientos");
ok(!!(g.long && g.long.strike === "20"), "la long comprada sigue intacta (" + JSON.stringify(g.long) + ")");
ok(Math.abs(Number(g.prima) - (2.5 - RECOMPRA)) < 1e-9,
  "el crédito vivo baja EXACTAMENTE lo pagado: 2.50 − " + RECOMPRA + " = " + (2.5 - RECOMPRA) + " (sale " + g.prima + ")");

const pata = (g.rollChain || [])[0] || {};
ok((g.rollChain || []).length === 1, "hay UNA pata nueva en la cadena (" + (g.rollChain || []).length + ")");
ok(pata.soloRecompra === true, "marcada como recompra suelta, no como roll");
ok(Number(pata.buybackCost) === RECOMPRA && Number(pata.newCredit) === 0, "con lo pagado y sin venta (" + pata.buybackCost + " / " + pata.newCredit + ")");
ok(Number(pata.comision) === FEE, "y su comisión (" + pata.comision + ")");
ok(pata.prevStrike === "40" && pata.prevExpiry === "2026-09-18",
  "y NO se pierde qué corta era: queda su strike y su fecha (" + pata.prevStrike + " · " + pata.prevExpiry + ")");

/* --- la cadena en pantalla: recompra sí, venta fantasma no --- */
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Movimientos"); if (b) b.click(); });
await page.waitForTimeout(900);
console.log("\n=== la cuenta, hecha a mano ===");
/* venta inicial:  2.50 × 100 − 1 de comisión  = +$249
   recompra:      −0.80 × 100 − 1 de comisión  = −$81
   ---------------------------------------------------
   prima acumulada                              = +$168   ·  comisiones = $2
   Es LA comprobación de todo esto: si la recompra no restara, o restara de más, o se colara
   una venta de $0, este número no saldría. */
const esperado = (2.5 * 100 - 1) - (RECOMPRA * 100 + FEE);
let texto = await page.evaluate(() => document.body.innerText);
const cifra = (re) => { const m = texto.match(re); return m ? Number(m[1].replace(/,/g, "")) : NaN; };
/* la fila es «TOTAL ACUM.  $2 | +$168»: la primera cifra es la comisión y la segunda, con
   su signo delante, la prima. Sin exigir el «+» se lee la comisión y la prueba se engaña. */
const total = cifra(/TOTAL ACUM\.[\s\S]{0,40}?\+\$([\d,]+)/);
const fees = cifra(/TOTAL ACUM\.[\s\S]{0,20}?\$([\d,]+)/);
console.log("  prima acumulada: $" + total + " · comisiones: $" + fees + " · esperado: $" + esperado);
ok(total === esperado, "la prima acumulada es $" + esperado + " = $249 de la venta − $81 de la recompra (sale $" + total + ")");
ok(fees === 2, "y las comisiones suman $2, las dos operaciones (sale $" + fees + ")");

/* y el detalle, que es donde se vería la venta fantasma */
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll("*")).filter((e) => /TOTAL 2026/.test(e.textContent || "") && e.children.length < 8);
  const b = t[t.length - 1];
  if (b) b.click();
});
await page.waitForTimeout(700);
texto = await page.evaluate(() => document.body.innerText);
/* al abrir el año salen los meses, y ahí están las DOS operaciones por separado */
ok(/\+\$249/.test(texto), "el mes de la venta inicial suma +$249");
ok(/-\$81/.test(texto), "y el de la recompra resta -$81 (0,80 × 100 + $1)");

/* un nivel más: la operación en sí, que es donde se vería la venta fantasma */
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll("*")).filter((e) => /TOTAL AGO 2026/.test(e.textContent || "") && e.children.length < 8);
  const b = t[t.length - 1];
  if (b) b.click();
});
await page.waitForTimeout(700);
texto = await page.evaluate(() => document.body.innerText);
/* y por fin la ficha de la operación: la lista solo enseña fecha e importe, el nombre y las
   patas están un toque más adentro ("Toca una línea para ver strike y detalle") */
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll("*")).filter((e) => /-\$81/.test(e.textContent || "") && !/TOTAL/.test(e.textContent || "") && e.children.length < 10);
  const b = t[t.length - 1];
  if (b) b.click();
});
await page.waitForTimeout(700);
texto = await page.evaluate(() => document.body.innerText);
console.log("  [ficha] " + texto.replace(/\n+/g, " | ").slice(300, 720));
ok(/Recompra/i.test(texto), "la operación se llama recompra");
ok(!/\bRoll\b/.test(texto), "y NO «Roll», porque no se ha vendido nada");
/* la venta fantasma se ve como un importe "+$0" en la ficha. Buscarla como «VENTA … $0» en la
   misma línea NO vale: innerText mete un salto entre el rótulo y la cifra, así que esa
   comprobación no saltaba ni con el fallo delante — comprobado. */
const ceros = (texto.match(/\+\$0\b/g) || []).length;
ok(ceros === 0, "y no hay ningún importe de $0 inventado en la ficha (" + ceros + ")");

/* ---------------------------------------------------------------------------
   Y LA OTRA MITAD: vender una corta nueva DÍAS DESPUÉS, que es el punto de todo esto.
   Ese camino ya existía (el botón "Vender call" que sale cuando no hay corta), pero hasta
   ahora solo se llegaba a él si la corta había EXPIRADO. Hay que comprobar que también
   funciona viniendo de una recompra: es media función si solo se puede cerrar.
--------------------------------------------------------------------------- */
console.log("\n=== y ahora se vende otra ===");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Portfolio"); if (b) b.click(); });
await page.waitForTimeout(700);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /B3/.test(x.innerText || "")); if (b) b.click(); });
await page.waitForTimeout(700);
await page.evaluate(() => {
  const cand = Array.from(document.querySelectorAll("div")).filter((e) =>
    /ASTS/.test(e.textContent || "") && /PMCC/.test(e.textContent || "") && getComputedStyle(e).cursor === "pointer");
  cand.sort((a, b) => (b.innerText || "").length - (a.innerText || "").length);
  if (cand[0]) cand[0].click();
});
await page.waitForTimeout(700);
const hayVender = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => /Vender call/.test(x.innerText || ""));
  if (!b) return false;
  b.click();
  return true;
});
await page.waitForTimeout(700);
ok(hayVender, "tras recomprar sale el botón «Vender call»");
await page.evaluate(() => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const campos = Array.from(document.querySelectorAll("input"));
  const pon = (re, val) => {
    const i = campos.find((x) => { const l = x.closest("label"); return l && re.test(l.innerText || ""); });
    if (i) { set.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); }
  };
  pon(/nuevo strike/i, "45");
  pon(/nuevo expiry/i, "2026-10-16");
  pon(/prima nueva/i, "1.20");
  pon(/comisi/i, "1");
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).filter((x) => /Guardar|Confirmar|Registrar/i.test(x.innerText || "") && x.offsetParent !== null);
  if (b.length) b[b.length - 1].click();
});
await page.waitForTimeout(900);
const g2 = await guardado();
console.log("  prima:", g2.prima, "· strike:", JSON.stringify(g2.strike), "· noShort:", g2.noShort, "· patas:", (g2.rollChain || []).length);
ok(g2.noShort === false, "la posición vuelve a tener call vendida");
ok(g2.strike === "45" && g2.expiry === "2026-10-16", "con el strike y el vencimiento nuevos (" + g2.strike + " · " + g2.expiry + ")");
ok(Math.abs(Number(g2.prima) - 2.9) < 1e-9, "y el crédito vivo sube a 1.70 + 1.20 = 2.90 (sale " + g2.prima + ")");
ok((g2.rollChain || []).length === 2, "dos patas en la cadena: la recompra y la venta (" + (g2.rollChain || []).length + ")");
const pata2 = (g2.rollChain || [])[1] || {};
ok(pata2.soldAfterExpiry === true && Number(pata2.buybackCost) === 0,
  "y la segunda es SOLO venta, sin recompra fantasma de $0 (" + pata2.buybackCost + ")");

await page.screenshot({ path: D + "/pmcc-recompra.png", fullPage: true });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
