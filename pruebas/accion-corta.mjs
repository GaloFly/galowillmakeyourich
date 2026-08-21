/* ---------------------------------------------------------------------------
   ACCIONES CORTAS — LA GANANCIA SALE DE RECOMPRAR MÁS BARATO (v5.13)

   Victor: *"si abres un corto, para cerrarlo tienes que recomprarlo, y la pérdida o ganancia
   tienen que salir de esa lógica"*.

   Exacto. Y no salía. La v4.91 metió las acciones cortas con `signoAcc`, pero solo lo aplicó en
   DOS sitios: el P&L mientras la posición está abierta y la delta de la cartera. El resultado
   REALIZADO —el que queda cuando cierras— usaba la fórmula de una larga:

       corta abierta a $50, recomprada a $40   →   la app apuntaba −$1.000
                                                    y son +$1.000 GANADOS

   Y de ahí pasaba al Histórico, al MTM y al rendimiento de la cartera. El fallo más caro no es el
   que se ve raro en pantalla: es el que se apunta en el historial y luego cuadra solo consigo mismo.

   Se comprueban los CUATRO caminos por los que una acción realiza dinero, en corto y en largo, con
   los números hechos a mano — y ese contraste con la larga es lo que importa: si algún día alguien
   aplicara el signo dos veces, las largas se romperían y esta prueba lo diría.

     node pruebas/accion-corta.mjs
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
const PUERTO = 8335;
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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 40, dp: 0, pc: 40, h: 40 }) }));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2000);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* Las funciones se leen del COMPILADO, no se copian aquí: una copia se comprobaría contra sí
   misma y pasaría siempre, aunque la app hiciera otra cosa. */
const hay = await page.evaluate(() => ["mtmSumOfPos", "signoAcc", "esAccCorta"].every((f) => typeof window[f] === "function" || typeof eval(f) === "function"));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }

/* 100 acciones a $50. En corto se recompran a $40 → se ganan $1.000.
   La MISMA operación en largo pierde esos $1.000. Los dos casos van siempre juntos. */
const medir = () => page.evaluate(() => {
  const base = { id: "s1", tkr: "ASTS", block: 3, nat: "ACC", qty: "100", bep: "50", last: "40",
    entryDate: "2026-06-01", broker: "IBKR", comision: "0" };
  const corta = { ...base, tipo: "Short Stock", corto: true };
  const larga = { ...base, tipo: "Long Stock" };
  const cerrar = (x, fee) => ({ ...x, closed: true, closeDate: "2026-08-20", closePrice: "40", closeComision: String(fee || 0) });
  const conLotes = (x) => ({ ...x, lots: [{ id: "l1", date: "2026-06-01", qty: "100", price: "50" }] });
  const conVenta = (x) => ({ ...x, soldLots: [{ date: "2026-07-01", qty: "50", cost: "50", price: "40", fee: "0" }] });
  const conDiv = (x) => ({ ...x, dividends: [{ date: "2026-07-15", amount: "30", ret: "0", fee: "0" }] });
  const r = (x) => Math.round(mtmSumOfPos(x) * 100) / 100;
  return {
    esCorta: esAccCorta(corta), signo: signoAcc(corta), signoLarga: signoAcc(larga),
    cierreC: r(cerrar(corta)), cierreL: r(cerrar(larga)),
    cierreConFeeC: r(cerrar(corta, 5)), cierreConFeeL: r(cerrar(larga, 5)),
    lotesC: r(cerrar(conLotes(corta))), lotesL: r(cerrar(conLotes(larga))),
    ventaC: r(conVenta(corta)), ventaL: r(conVenta(larga)),
    divC: r(conDiv(corta)), divL: r(conDiv(larga)),
    /* el P&L MIENTRAS está abierta: eso ya lo hacía bien la v4.91, y se comprueba para que
       nadie lo rompa arreglando lo otro */
    abiertoC: Math.round(effPnl(corta)), abiertoL: Math.round(effPnl(larga)),
  };
});
const m = await medir();

console.log("=== la corta se reconoce y lleva su signo ===");
ok(m.esCorta === true, "una posición con tipo Short Stock es corta");
ok(m.signo === -1 && m.signoLarga === 1, "y su signo es −1, el de la larga +1");

console.log("\n=== cerrar: recomprar a $40 lo vendido a $50 ===");
console.log("  corta: $" + m.cierreC + "   ·   larga: $" + m.cierreL);
ok(m.cierreC === 1000, "la corta GANA $1.000 (antes apuntaba −$1.000, el signo de una larga)");
ok(m.cierreL === -1000, "y la larga pierde $1.000, que es lo que siempre hizo bien");

console.log("\n=== la comisión no cambia de signo: se paga en los dos sentidos ===");
console.log("  con $5 de comisión — corta: $" + m.cierreConFeeC + "   ·   larga: $" + m.cierreConFeeL);
ok(m.cierreConFeeC === 995, "a la corta le RESTA (995), no le suma");
ok(m.cierreConFeeL === -1005, "y a la larga también (−1005)");

console.log("\n=== por lotes (FIFO), que es otro camino distinto ===");
console.log("  corta: $" + m.lotesC + "   ·   larga: $" + m.lotesL);
ok(m.lotesC === 1000, "mismo resultado por el camino de los lotes");
ok(m.lotesL === -1000, "y la larga igual que antes");

console.log("\n=== venta parcial de la mitad ===");
console.log("  corta: $" + m.ventaC + "   ·   larga: $" + m.ventaL);
ok(m.ventaC === 500, "50 acciones dan la mitad: +$500 en corto");
ok(m.ventaL === -500, "y −$500 en largo");

console.log("\n=== dividendo: en corto lo PAGAS tú ===");
console.log("  corta: $" + m.divC + "   ·   larga: $" + m.divL);
ok(m.divC === -30, "estando corto, un dividendo de $30 es un cargo (−30)");
ok(m.divL === 30, "estando largo, es un cobro (+30)");

/* y que no se cuele el signo dos veces: corta + larga tienen que ser opuestas exactas */
console.log("\n=== simetría: la corta es el espejo de la larga ===");
[["cierre", m.cierreC, m.cierreL], ["lotes", m.lotesC, m.lotesL], ["venta", m.ventaC, m.ventaL], ["dividendo", m.divC, m.divL]]
  .forEach(([k, c, l]) => ok(c === -l, k + ": " + c + " es exactamente lo contrario de " + l));

console.log("\n=== y el P&L mientras sigue abierta (esto ya iba bien) ===");
console.log("  corta: $" + m.abiertoC + "   ·   larga: $" + m.abiertoL);
ok(m.abiertoC === 1000, "con la acción a $40, la corta abierta a $50 gana $1.000 en pantalla");
ok(m.abiertoL === -1000, "y la larga pierde $1.000");
ok(m.abiertoC === m.cierreC, "y coincide con lo que se realiza al cerrar a ese mismo precio — que era justo lo que NO pasaba");

ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));
await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
