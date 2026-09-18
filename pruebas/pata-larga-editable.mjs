/* ---------------------------------------------------------------------------
   LA PATA LARGA DEL PMCC SE PUEDE EDITAR (v5.24)

   Victor, después de la v5.23, que ya le decía exactamente qué pasaba
   ("tu servidor no conoce ASTS 70C · 12 ene 2028 (miércoles)") y después de que yo le dijera que
   corrigiera el vencimiento: **"Igual"**.

   Y tenía razón, porque **no podía**. La pata larga del PMCC era una tarjeta de SOLO LECTURA: strike,
   prima y vencimiento se tecleaban al crear la posición y ahí se quedaban para siempre. Para
   arreglar una fecha mal escrita había que borrar la posición y rehacerla — perdiendo su historial
   de rolls, que es justo lo que no se puede perder.

   Un dato que la app USA para pedir precios tiene que poder arreglarse donde se ve que está mal.

   Lo que se comprueba:

     · los cuatro campos de la pata larga existen, se escriben y se GUARDAN (IndexedDB manda, así que
       se comprueba recargando la página, no leyendo el estado de React);
     · corregido el vencimiento, la posición pide el contrato bueno y se valora sola;
     · el resto de la pata larga no se pierde al tocar un solo campo;
     · y el vencimiento dice EN QUÉ DÍA DE LA SEMANA cae, que es lo que hace visible el error, con
       aviso solo cuando es imposible o improbable — nunca en un vencimiento normal.

     node pruebas/pata-larga-editable.mjs
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
const PUERTO = 8354;
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

/* la PMCC de Victor tal como está en su teléfono: sin corta, y la larga al 12 de enero del 28 */
const MALO = "2028-01-12", BUENO = "2028-01-21";
const COD_BUENO = "US.ASTS280121C70000";
const MARCA = 41.2;
const POS = [
  { id: "acc", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
    entryDate: "2026-02-01", broker: "IBKR", comision: "0" },
  { id: "pmcc", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "",
    expiry: "", prima: "2.31", noShort: true, entryDate: "2026-08-12", broker: "IBKR", comision: "0.7",
    pnlModo: "MANUAL", pnl: "0", mktValue: "0", last: "62.71",
    long: { strike: "70", expiry: MALO, prima: "34.81", comision: "1.05", delta: "0.78" },
    rollChain: [{ date: "2026-09-05", prevStrike: "80", prevExpiry: "2026-09-18", prevPrima: "4.50",
      buybackCost: 2.19, newCredit: 0, comision: 0, soloRecompra: true }] },
];
const CASH = -5000, MARGIN = 3000;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pedidos = [];
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 62.71, dp: 0, pc: 62.71, h: 62.71 }) }));
await ctx.route(/puente\.alphavext\.com/, (r) => {
  const u = r.request().url();
  const m = u.match(/[?&]codigos=([^&]+)/);
  if (!/\/opciones/.test(u) || !m) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  const cods = decodeURIComponent(m[1]).split(",").filter(Boolean);
  cods.forEach((c) => pedidos.push(c));
  const out = {};
  /* el servidor SOLO conoce el contrato del 21 — el del 12 no existe */
  cods.filter((c) => c === COD_BUENO).forEach((c) => {
    out[c] = { ultimo: MARCA, medio: MARCA, iv: 0.6, delta: 0.78, theta: -0.02, fecha_dato: new Date().toISOString() };
  });
  return r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, opciones: out, sin_datos: cods.filter((c) => c !== COD_BUENO) }) });
});
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript(({ pos, cash, margin }) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "bloques");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
}, { pos: POS, cash: CASH, margin: MARGIN });

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

const arrancar = async () => {
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(3200);
};
await page.goto(URL_APP, { waitUntil: "load" });
await arrancar();

/* ---------------------------------------------------------------------------
   0. EL AVISO DEL DÍA DE LA SEMANA, leído de la función compilada.
--------------------------------------------------------------------------- */
console.log("=== el vencimiento dice en qué día cae ===");
const avisos = await page.evaluate((hoy) => {
  const f = (d) => { const a = avisoVencimiento(d); return a ? { dia: a.dia, raro: a.raro, texto: a.texto } : null; };
  return { miercoles: f("2028-01-12"), viernes: f("2028-01-21"), sabado: f("2028-01-22"), cerca: f(hoy) };
}, new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10));
console.log("  12 ene 2028 → " + JSON.stringify(avisos.miercoles));
console.log("  21 ene 2028 → " + JSON.stringify(avisos.viernes));
console.log("  22 ene 2028 → " + avisos.sabado.texto);
ok(avisos.miercoles.dia === "miércoles" && avisos.miercoles.raro, "un LEAPS en miércoles se marca en ámbar");
ok(/compruébalo en tu bróker/.test(avisos.miercoles.texto), "y dice qué hacer: comprobarlo en el bróker (no afirma que esté mal)");
ok(avisos.viernes.dia === "viernes" && !avisos.viernes.raro, "el tercer viernes NO se marca — sería ruido en el caso normal");
ok(avisos.sabado.raro && /fin de semana/.test(avisos.sabado.texto), "un sábado se marca como imposible");
ok(avisos.cerca && !avisos.cerca.raro, "y un vencimiento cercano en día laborable tampoco se marca (hay semanales)");

/* ---------------------------------------------------------------------------
   1. DE PARTIDA: el contrato malo se pide, no se conoce, y la posición no vale.
--------------------------------------------------------------------------- */
console.log("\n=== de partida, con el 12 de enero ===");
console.log("  pedidos: " + JSON.stringify([...new Set(pedidos)]));
ok(pedidos.some((c) => c === "US.ASTS280112C70000"), "se pide el contrato del 12 (que no existe)");
const antes = await page.evaluate(() => {
  const vivas = JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]");
  const q = vivas.find((x) => x.id === "pmcc");
  return { eff: Math.round(effMkt(q) * 100) / 100, real: mktEsReal(q) };
});
console.log("  vale " + antes.eff + " · real: " + antes.real);
ok(antes.eff === 0 && antes.real === false, "y la posición no tiene valor de mercado (sale " + antes.eff + ")");

/* ---------------------------------------------------------------------------
   2. SE ABRE EL EDITOR Y SE CAMBIA EL VENCIMIENTO. Esto es lo que NO se podía hacer.
--------------------------------------------------------------------------- */
console.log("\n=== se abre la posición y se corrige la fecha ===");
/* la vista de bloques arranca en "Resumen": las posiciones viven bajo la pestaña de su bloque */
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll("button, div, span"))
    .filter((e) => (e.textContent || "").trim() === "B2 · Income" && getComputedStyle(e).cursor === "pointer")
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
  if (t) t.click();
});
await page.waitForTimeout(700);
/* abrir la fila de la PMCC: se busca por su texto y se pulsa el elemento pulsable más ajustado */
const abierto = await page.evaluate(() => {
  const filas = Array.from(document.querySelectorAll("div")).filter((e) => {
    const t = e.textContent || "";
    return /ASTS/.test(t) && /PMCC/.test(t) && t.length < 400 && getComputedStyle(e).cursor === "pointer";
  });
  filas.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (!filas.length) return false;
  filas[0].click();
  return true;
});
await page.waitForTimeout(500);
ok(abierto, "se encuentra y se abre la fila de la PMCC");
/* tocar la fila abre la hoja de acciones; de ahí, "Editar" despliega el formulario */
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((e) => /^Editar/.test((e.textContent || "").trim()));
  if (b) b.click();
});
await page.waitForTimeout(800);
const campos = await page.evaluate(() => {
  const et = (s) => Array.from(document.querySelectorAll("span, div, label")).some((e) => (e.textContent || "").trim().toLowerCase() === s);
  const fechas = Array.from(document.querySelectorAll('input[type="date"]')).map((i) => i.value);
  return { strike: et("strike long"), prima: et("prima pagada $/acc"), vto: et("vencimiento long"),
    comision: et("comisión long"), fechas, aviso: /Cae en miércoles/.test(document.body.innerText) };
});
console.log("  campos de la pata larga → strike:" + campos.strike + " prima:" + campos.prima + " vto:" + campos.vto + " comisión:" + campos.comision);
console.log("  fechas editables en pantalla: " + JSON.stringify(campos.fechas));
ok(campos.strike && campos.prima && campos.vto && campos.comision, "los CUATRO campos de la pata larga son editables");
ok(campos.fechas.indexOf("2028-01-12") >= 0, "el vencimiento malo está ahí, en un campo de fecha de verdad");
ok(campos.aviso, "y debajo pone que cae en miércoles");

/* se teclea el vencimiento bueno en ese campo */
await page.evaluate((v) => {
  const i = Array.from(document.querySelectorAll('input[type="date"]')).find((x) => x.value === "2028-01-12");
  if (!i) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(i, v);
  i.dispatchEvent(new Event("input", { bubbles: true }));
  i.dispatchEvent(new Event("change", { bubbles: true }));
}, BUENO);
await page.waitForTimeout(900);

/* ---------------------------------------------------------------------------
   3. SE GUARDA DE VERDAD (recargando la página: IndexedDB es lo autoritativo)
--------------------------------------------------------------------------- */
console.log("\n=== se guarda, y la posición se cura sola ===");
pedidos.length = 0;
await page.reload({ waitUntil: "load" });
await arrancar();
const despues = await page.evaluate(() => {
  const vivas = JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]");
  const q = vivas.find((x) => x.id === "pmcc") || {};
  return { long: q.long || null, rolls: (q.rollChain || []).length,
    eff: Math.round(effMkt(q) * 100) / 100, real: mktEsReal(q), pnl: Math.round(effPnl(q) * 100) / 100,
    aviso: /no conoce/.test(document.body.innerText) };
});
console.log("  pata larga guardada → " + JSON.stringify(despues.long));
console.log("  pedidos tras recargar: " + JSON.stringify([...new Set(pedidos)]));
console.log("  vale " + despues.eff + " · P&L " + despues.pnl + " · real: " + despues.real);
ok(despues.long && despues.long.expiry === BUENO, "el vencimiento nuevo sobrevive a recargar la app (IndexedDB)");
ok(despues.long.strike === "70" && despues.long.prima === "34.81" && despues.long.comision === "1.05" && despues.long.delta === "0.78",
  "y NO se pierde el resto de la pata larga al tocar un solo campo: " + JSON.stringify(despues.long));
ok(despues.rolls === 1, "ni su historial de rolls — que es lo que se perdía al borrar y rehacer");
ok(pedidos.indexOf(COD_BUENO) >= 0, "ahora se pide el contrato bueno: " + COD_BUENO);
ok(despues.real === true && despues.eff === 4120, "la posición pasa a valor REAL: +$4.120 (41,20 × 100) — sale " + despues.eff);
ok(despues.pnl === Math.round((MARCA - 34.81) * 100 * 100) / 100, "y su P&L es (41,20 − 34,81) × 100 = +$639 — sale " + despues.pnl);
ok(!despues.aviso, "y desaparece el aviso de contrato desconocido");

await page.screenshot({ path: D + "/pata-larga-editable.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
