/* ---------------------------------------------------------------------------
   CAMBIAR DE MONEDA SIN TRAMPA (v5.31)

   Victor, tras la v5.30, con su TEP real: 222 acciones con BEP $102 y último $64,47 — el BEP son sus
   89,73 € pasados a dólares el día de la compra, y el último era el de OTRA empresa americana que
   Finnhub llama "TEP". Al marcar la ficha en euros los números NO se convierten: pasan a leerse en
   euros. Un BEP de 102 que eran dólares sería 102 € sin que nada lo dijera.

   Lo que se comprueba:
     1. Si TEP está en euros en otra posición (aquí, su covered call) y estas acciones no tienen
        moneda, la fila lo dice y ofrece pasarla — da igual por dónde entrara la posición.
     2. Un ticker con sufijo de bolsa europea (ASML.AS) se reconoce solo, y "Es otra, dejar en $"
        lo deja decidido (no vuelve a salir tras recargar).
     3. Al cambiar la moneda, desde el aviso o desde el editor, sale qué números se van a leer en la
        moneda nueva (BEP €102 · último €64.47) hasta pulsar "Entendido".
     4. Una put en euros que te asignan crea acciones EN EUROS (en la v5.30 salían en dólares).
     5. NVDA, en dólares y sin hermanos en euros: ni un aviso.

     node pruebas/moneda-aviso.mjs
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
const PUERTO = 8359;
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


const SERIE = { "2026-09-01": 1.10, "2026-10-01": 1.05, "2026-10-20": 1.08 };
const NVDA = { id: "nvda", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
  entryDate: "2026-02-01", broker: "IBKR", comision: "0" };
/* la de su captura: sin moneda, BEP y último en dólares */
const TEPACC = { id: "tepacc", tkr: "TEP", block: 1, tipo: "Long Stock", nat: "ACC", qty: "222", bep: "102", last: "64.47",
  entryDate: "2026-06-01", broker: "IBKR", comision: "0" };
const TEPCC = { id: "tepcc", tkr: "TEP", moneda: "EUR", block: 2, tipo: "Short Call", nat: "CRED", right: "C", covered: true, qty: "200",
  strike: "82", expiry: "2026-11-20", prima: "1.2", entryDate: "2026-10-01", broker: "IBKR", comision: "3", mktValue: "-100" };
const ASML = { id: "asml", tkr: "ASML.AS", block: 1, tipo: "Long Stock", nat: "ACC", qty: "10", bep: "600", last: "650",
  entryDate: "2026-05-01", broker: "IBKR", comision: "0" };
const PUTEUR = { id: "puteur", tkr: "SAN", moneda: "EUR", block: 1, tipo: "Short Put", nat: "CRED", right: "P", qty: "100",
  strike: "70", expiry: "2026-10-16", prima: "3", last: "68", entryDate: "2026-10-01", broker: "IBKR", comision: "0" };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const abrir = async (pos) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
  await ctx.route(/frankfurter|er-api/, (r) => {
    const rates = {};
    Object.keys(SERIE).forEach((d) => { rates[d] = { USD: SERIE[d] }; });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ amount: 1, base: "EUR", rates }) });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  /* se siembra UNA vez: al recargar tiene que mandar lo que la app guardó, no la semilla */
  await page.addInitScript((p) => {
    if (sessionStorage.getItem("sembrado")) return;
    sessionStorage.setItem("sembrado", "1");
    localStorage.setItem("bloques_pos_v5", JSON.stringify(p));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "0", margin: "1000" } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", "bloques");
  }, pos);
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
};

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

const a = await abrir([NVDA, TEPACC, TEPCC, ASML]);
const pg = a.page;
const guardado = () => pg.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]"));
const tab = async (re) => { await pg.evaluate((r) => { const b = Array.from(document.querySelectorAll("button")).find((x) => new RegExp(r).test(x.innerText || "")); if (b) b.click(); }, re); await pg.waitForTimeout(800); };
/* la tarjeta (más pequeña) de una posición: empieza por su ticker y lleva BEP */
const tarjeta = (tkr) => pg.evaluate((t) => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => { const x = (e.innerText || "").trim(); return x.startsWith(t) && /BEP/.test(x) && /Long Stock/.test(x); });
  c.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
  return c[0] ? c[0].innerText.replace(/\n+/g, " · ") : "";
}, tkr);
const pulsarEn = async (tkr, boton) => {
  const hecho = await pg.evaluate(({ t, b }) => {
    const c = Array.from(document.querySelectorAll("div")).filter((e) => { const x = (e.innerText || "").trim(); return x.startsWith(t) && /BEP/.test(x) && Array.from(e.querySelectorAll("button")).some((y) => (y.innerText || "").trim() === b); });
    c.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
    if (!c[0]) return false;
    Array.from(c[0].querySelectorAll("button")).find((y) => (y.innerText || "").trim() === b).click();
    return true;
  }, { t: tkr, b: boton });
  await pg.waitForTimeout(700);
  return hecho;
};

const foto = async (re, nombre) => {
  await pg.evaluate((r) => { const e = Array.from(document.querySelectorAll("div")).filter((x) => new RegExp(r).test((x.innerText || "").trim())).sort((x, y) => (x.innerText || "").length - (y.innerText || "").length)[0]; if (e) e.scrollIntoView({ block: "center" }); }, re);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: D + "/" + nombre });
};

console.log("=== 1. TEP en euros en otra posición: la fila de las acciones lo dice ===");
await tab("^B1");
let tep = await tarjeta("TEP");
console.log("  " + tep.slice(0, 300));
ok(/Tienes TEP en euros en otra posición \((Covered|Short) Call\)/.test(tep), "avisa: TEP está en euros en la covered call y esta en dólares");
ok(/Pasar a euros/.test(tep) && /Es otra, dejar en \$/.test(tep), "y ofrece las dos salidas");
const nv = await tarjeta("NVDA");
ok(nv && !/euros/.test(nv), "NVDA (dólares, sin hermanos en euros): ni un aviso");

console.log("\n=== 2. al pasarla, dice qué números se leen ahora en euros ===");
await foto("^Tienes TEP en euros", "moneda-sugerencia.png");
ok(await pulsarEn("TEP", "Pasar a euros"), "se pulsa «Pasar a euros»");
let g = await guardado();
ok((g.find((x) => x.id === "tepacc") || {}).moneda === "EUR", "queda guardada en euros");
ok((g.find((x) => x.id === "tepacc") || {}).bep === "102", "y el BEP NO se toca: lo reescribe él, que es quien sabe en qué moneda estaba");
tep = await tarjeta("TEP");
console.log("  " + tep.slice(0, 360));
ok(/no se han convertido/.test(tep), "avisa de que los números no se han convertido");
ok(/BEP €102 · último €64\.47/.test(tep), "y enseña cuáles: BEP €102 · último €64.47");
ok(!/Pasar a euros/.test(tep), "el aviso de antes ya no sale");
await foto("^Ahora esta ficha va en euros", "moneda-aviso.png");
ok(await pulsarEn("TEP", "Entendido"), "«Entendido»");
tep = await tarjeta("TEP");
ok(!/no se han convertido/.test(tep), "y desaparece");

console.log("\n=== 3. ASML.AS: sufijo de Ámsterdam → euros ===");
let asml = await tarjeta("ASML.AS");
ok(/cotiza en una bolsa europea, en euros/.test(asml), "lo reconoce por el sufijo .AS");
ok(await pulsarEn("ASML.AS", "Es otra, dejar en $"), "«Es otra, dejar en $»");
g = await guardado();
ok((g.find((x) => x.id === "asml") || {}).moneda === "USD", "queda decidido: moneda USD guardada");
asml = await tarjeta("ASML.AS");
ok(!/bolsa europea/.test(asml) && !/no se han convertido/.test(asml), "sin aviso, y sin el de «no convertido» (no ha cambiado nada)");

console.log("\n=== 4. tras recargar, lo decidido sigue decidido ===");
await pg.reload({ waitUntil: "load" });
await pg.waitForTimeout(3500);
await tab("^B1");
tep = await tarjeta("TEP"); asml = await tarjeta("ASML.AS");
ok(/P&L en euros/.test(tep) || /€102/.test(tep), "TEP sigue en euros (sale " + (tep.match(/BEP[^·]*·[^·]*/) || [""])[0] + ")");
ok(!/Pasar a euros|bolsa europea/.test(tep + asml), "y no vuelve a salir ningún aviso");

console.log("\n=== 5. desde el editor, el mismo aviso ===");
await pg.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => (e.innerText || "").trim().startsWith("NVDA") && /BEP/.test(e.innerText || "") && getComputedStyle(e).cursor === "pointer");
  c.sort((x, y) => (x.innerText || "").length - (y.innerText || "").length);
  if (c[0]) c[0].click();
});
await pg.waitForTimeout(800);
await pg.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => (x.innerText || "").trim().split("\n")[0] === "Editar" && x.offsetParent !== null); if (b) b.click(); });
await pg.waitForTimeout(1200);
const hayPill = await pg.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "EUR €" && x.offsetParent !== null); if (b) { b.click(); return true; } return false; });
if (!hayPill) console.log("  botones: " + JSON.stringify(await pg.evaluate(() => Array.from(document.querySelectorAll("button")).filter((x) => x.offsetParent !== null).map((x) => (x.innerText || "").split("\n")[0].trim()).slice(0, 60))));
ok(hayPill, "en Editar, Moneda → EUR €");
await pg.waitForTimeout(700);
let nvd = await tarjeta("NVDA");
ok(/no se han convertido/.test(nvd) && /BEP €100 · último €130/.test(nvd), "sale el aviso con sus números: BEP €100 · último €130");
await pg.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "USD $" && x.offsetParent !== null); if (b) b.click(); });
await pg.waitForTimeout(700);
nvd = await tarjeta("NVDA");
ok(/va en dólares/.test(nvd), "y si se vuelve a dólares, lo dice también");
ok(!a.errs.length, "sin errores de JS " + JSON.stringify(a.errs.slice(0, 2)));
await a.ctx.close();

console.log("\n=== 6. una put en euros que te asignan: las acciones, en euros ===");
const b = await abrir([PUTEUR]);
const pb = b.page;
await pb.evaluate(() => { const x = Array.from(document.querySelectorAll("button")).find((y) => /^B1/.test(y.innerText || "")); if (x) x.click(); });
await pb.waitForTimeout(800);
await pb.evaluate(() => {
  const c = Array.from(document.querySelectorAll("div")).filter((e) => (e.textContent || "").indexOf("SAN") >= 0 && getComputedStyle(e).cursor === "pointer");
  c.sort((x, y) => (y.innerText || "").length - (x.innerText || "").length);
  if (c[0]) c[0].click();
});
await pb.waitForTimeout(800);
const pulsarB = async (re) => { const h = await pb.evaluate((p) => { const b = Array.from(document.querySelectorAll("button")).find((x) => new RegExp(p).test(x.innerText || "") && x.offsetParent !== null); if (!b) return false; b.click(); return true; }, re); await pb.waitForTimeout(900); return h; };
ok(await pulsarB("Me han ejercido"), "«Me han ejercido»");
ok(await pulsarB("Confirmar"), "«Confirmar»");
const gb = await pb.evaluate(() => JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]"));
const acc = gb.find((x) => x.assignedFrom === "puteur");
console.log("  acción creada: " + JSON.stringify(acc && { tkr: acc.tkr, moneda: acc.moneda, bep: acc.bep, nota: acc.entryNote }));
ok(acc && acc.moneda === "EUR", "las acciones salen en euros, como su put (en la v5.30 salían sin moneda = dólares)");
ok(acc && /BEP €67/.test(acc.entryNote || ""), "y su nota dice el coste en euros: €67");
ok(!b.errs.length, "sin errores de JS " + JSON.stringify(b.errs.slice(0, 2)));
await b.ctx.close();

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
