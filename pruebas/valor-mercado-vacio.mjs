/* ---------------------------------------------------------------------------
   UNA CAJA EN BLANCO NO SE DISTINGUE DE UNA AVERÍA (v5.25)

   Victor, mirando la ficha de su PMCC de ASTS: *"el problema es que no está cogiendo bien el valor
   de mercado; fíjate, lo tengo en Auto y no aparece nada"*.

   Y tenía razón en lo que veía: en Auto, sin precio del servidor, ahí no había más que un campo
   vacío. Nada que dijera si el servidor no había contestado todavía, si le faltaba un dato a la
   posición, o si el contrato que se le pedía no existe (que era su caso: el LEAPS apuntado a un
   miércoles). Cuarta vez con la misma lección — **callarse no es un estado neutro**.

   Los motivos son los mismos cuatro que ya separa el aviso de la cabecera desde la v5.23, pero
   dichos para UNA posición, en el sitio exacto donde se está mirando. Y cada uno se arregla distinto:

     · sin servidor propio ............ ponlo en Manual y escríbelo
     · le falta un dato a una pata .... complétalo ahí mismo
     · el contrato no existe .......... comprueba el vencimiento en el bróker (pulsar no sirve)
     · todavía no ha llegado .......... pulsa 🔄 Precios
     · estructura no descomponible .... es manual por diseño, no te falta nada

   Y cuando SÍ hay precio, no se dice nada: un aviso que sale siempre no avisa de nada.

     node pruebas/valor-mercado-vacio.mjs
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
const PUERTO = 8355;
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

/* la PMCC de Victor: sin corta, y la larga al 12 de enero del 28 — que es miércoles */
const PMCC = { id: "pmcc", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100",
  strike: "", expiry: "", prima: "2.31", noShort: true, entryDate: "2026-08-12", broker: "IBKR",
  comision: "0.7", pnlModo: "MANUAL", pnl: "0", mktValue: "", last: "58.55",
  long: { strike: "70", expiry: "2028-01-12", prima: "34.81", comision: "1.05" }, rollChain: [] };
const COD_MALO = "US.ASTS280112C70000";
const COD_BUENO = "US.ASTS280121C70000";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 58.55, dp: 0, pc: 58.55, h: 58.55 }) }));
await ctx.route(/puente\.alphavext\.com/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "-5000", margin: "3000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "bloques");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
}, [PMCC]);
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2600);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(700);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* ---------------------------------------------------------------------------
   1. LOS CINCO MOTIVOS, leídos de la función compilada.
--------------------------------------------------------------------------- */
console.log("=== cada hueco vacío dice por qué lo está ===");
const hay = await page.evaluate(() => { try { return typeof motivoSinPrecio === "function"; } catch (e) { return false; } });
if (!hay) { console.log("  ✗ motivoSinPrecio no es accesible desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const m = await page.evaluate(({ pmcc, malo, bueno }) => {
  const r = {};
  /* el caso de Victor: se preguntó por el contrato y el servidor no lo conoce */
  r.desconocido = motivoSinPrecio({ ...pmcc, optSinDato: [malo] });
  /* todavía no se ha pulsado 🔄 Precios: patas descritas, sin marcas y sin respuesta que juzgar */
  r.sinRefrescar = motivoSinPrecio(pmcc);
  /* le falta el vencimiento a la pata larga: no hay contrato que pedir */
  r.incompleta = motivoSinPrecio({ ...pmcc, long: { strike: "70", prima: "34.81" } });
  /* estructura que la app no sabe descomponer */
  r.sinModelo = motivoSinPrecio({ id: "ic", tkr: "SPY", block: 3, tipo: "Iron Condor", nat: "DEF",
    qty: "100", expiry: "2026-12-18", mktValue: "-1234" });
  /* con el precio del contrato bueno ya guardado: no hay nada que explicar */
  r.conPrecio = motivoSinPrecio({ ...pmcc, long: { ...pmcc.long, expiry: "2028-01-21" }, optMarks: { [bueno]: "41.2" } });
  /* puesto en Manual a propósito: tampoco */
  r.manual = motivoSinPrecio({ ...pmcc, mktModo: "MANUAL" });
  /* una acción no entra por aquí */
  r.accion = motivoSinPrecio({ id: "a", tkr: "NVDA", nat: "ACC", qty: "100", last: "130" });
  /* y una posición CERRADA tampoco: no le falta nada, ya terminó */
  r.cerrada = motivoSinPrecio({ ...pmcc, closed: true, closeDate: "2026-09-10" });
  return r;
}, { pmcc: PMCC, malo: COD_MALO, bueno: COD_BUENO });
Object.keys(m).forEach((k) => console.log("  " + k.padEnd(13) + " → " + (m[k] || "(nada)")));
ok(/ASTS 70C/.test(m.desconocido) && /miércoles/.test(m.desconocido),
  "el contrato que el servidor no conoce se nombra con su día de la semana");
ok(/no lo va a arreglar/.test(m.desconocido), "y se dice que volver a pulsar no sirve");
ok(/Pulsa 🔄 Precios/.test(m.sinRefrescar) && !/no conoce/.test(m.sinRefrescar),
  "el que solo necesita un refresco dice justo eso, y no acusa al contrato");
ok(/falta un dato/.test(m.incompleta) && /Complétalo/.test(m.incompleta),
  "al que le falta el vencimiento de una pata se le manda a completarlo");
ok(/no sabe descomponer/.test(m.sinModelo) && /No te falta ningún dato/.test(m.sinModelo),
  "y al Iron Condor no se le manda a completar nada: es manual por diseño");
ok(m.conPrecio === null, "con precio de verdad NO se dice nada (sale: " + m.conPrecio + ")");
ok(m.manual === null, "en Manual tampoco: lo has elegido tú");
ok(m.accion === null, "y una acción ni entra: su valor es Último × Cantidad");
ok(m.cerrada === null, "una posición CERRADA tampoco: no le falta nada que completar (sale: " + m.cerrada + ")");

/* ---------------------------------------------------------------------------
   2. SIN SERVIDOR: el motivo es otro, y el arreglo también.
--------------------------------------------------------------------------- */
console.log("\n=== y sin servidor propio, lo dice y manda a Manual ===");
const ctx2 = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx2.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 58.55, dp: 0, pc: 58.55, h: 58.55 }) }));
const p2 = await ctx2.newPage();
const errores2 = [];
p2.on("pageerror", (e) => errores2.push(e.message));
await p2.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "bloques");
}, [PMCC]);
await p2.goto(URL_APP, { waitUntil: "load" });
await p2.waitForTimeout(2600);
await p2.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await p2.waitForTimeout(600);
const sinPuente = await p2.evaluate(({ pmcc, malo }) => ({
  normal: motivoSinPrecio(pmcc),
  conSinDato: motivoSinPrecio({ ...pmcc, optSinDato: [malo] }),
}), { pmcc: PMCC, malo: COD_MALO });
console.log("  " + sinPuente.normal);
ok(/servidor propio/.test(sinPuente.normal) && /Manual/.test(sinPuente.normal),
  "sin servidor se explica eso y se ofrece la salida (Manual)");
ok(sinPuente.conSinDato === sinPuente.normal,
  "y NUNCA se culpa a un contrato sin servidor, aunque quedaran restos guardados de otro dispositivo");
ok(!errores2.length, "sin errores de JS " + JSON.stringify(errores2.slice(0, 2)));
await ctx2.close();

/* ---------------------------------------------------------------------------
   3. EN PANTALLA, donde Victor estaba mirando: dentro de la ficha, bajo "Avanzado".
--------------------------------------------------------------------------- */
console.log("\n=== y se ve en la ficha, debajo del campo vacío ===");
/* se llega al estado de verdad: una descarga real contra un servidor que contesta lo que conoce
   (una acción cualquiera) y NO conoce el contrato de la PMCC. Sembrar `optSinDato` a mano en
   localStorage no vale: IndexedDB es lo autoritativo y lo machaca al cargar. */
const ctx3 = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx3.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 58.55, dp: 0, pc: 58.55, h: 58.55 }) }));
await ctx3.route(/puente\.alphavext\.com/, (r) => {
  const u = r.request().url();
  const mm = u.match(/[?&]codigos=([^&]+)/);
  if (!/\/opciones/.test(u) || !mm) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  const cods = decodeURIComponent(mm[1]).split(",").filter(Boolean);
  const out = {};
  cods.filter((c) => /261023P/.test(c)).forEach((c) => { out[c] = { ultimo: 5.47, medio: 5.47, iv: 0.7, delta: -0.3, theta: -0.04, fecha_dato: new Date().toISOString() }; });
  return r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, opciones: out, sin_datos: cods.filter((c) => !/261023P/.test(c)) }) });
});
const page3 = await ctx3.newPage();
page3.on("pageerror", (e) => errores.push(e.message));
await page3.addInitScript((pos) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "-5000", margin: "3000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "bloques");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
}, [PMCC, { id: "put", tkr: "ASTS", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
  strike: "63", expiry: "2026-10-23", prima: "8.20", entryDate: "2026-08-01", broker: "IBKR", comision: "0" }]);
await page3.goto(URL_APP, { waitUntil: "load" });
await page3.waitForTimeout(2600);
await page3.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page3.waitForTimeout(3400);
await page3.evaluate(() => {
  const t = Array.from(document.querySelectorAll("button, div, span"))
    .filter((e) => (e.textContent || "").trim() === "B2 · Income" && getComputedStyle(e).cursor === "pointer")
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
  if (t) t.click();
});
await page3.waitForTimeout(700);
await page3.evaluate(() => {
  const f = Array.from(document.querySelectorAll("div")).filter((e) => {
    const t = e.textContent || "";
    return /ASTS/.test(t) && /PMCC/.test(t) && t.length < 400 && getComputedStyle(e).cursor === "pointer";
  }).sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  if (f.length) f[0].click();
});
await page3.waitForTimeout(600);
await page3.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((e) => /^Editar/.test((e.textContent || "").trim()));
  if (b) b.click();
});
await page3.waitForTimeout(900);
const enPantalla = await page3.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf("VALOR MERCADO");
  return { hay: /Tu servidor no conoce ASTS 70C/.test(t), trozo: i >= 0 ? t.slice(i, i + 260) : "(no se ve el campo)" };
});
console.log("  " + enPantalla.trozo.replace(/\n+/g, " · ").slice(0, 230));
ok(enPantalla.hay, "el motivo sale en la ficha, justo donde estaba mirando");
await page3.screenshot({ path: D + "/valor-mercado-vacio.png" });
ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
