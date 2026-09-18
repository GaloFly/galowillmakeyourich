/* ---------------------------------------------------------------------------
   "LE PREGUNTÉ Y NO LO CONOCE" NO ES LO MISMO QUE "TODAVÍA NO HE PREGUNTADO" (v5.23)

   Victor, con la v5.22 ya instalada y funcionando: *"está ya casi todo bien, falta esa PMCC de ASTS
   que no tiene pata corta vendida ahora mismo, solo larga"*.

   Su ficha, abierta: STRIKE SHORT vacío, EXPIRY vacío, y la pata larga completa —
   **strike $70, prima $34,81, vto JAN 12 '28**. Y ahí está el fallo, a la vista:

       el 12 de enero de 2028 es MIÉRCOLES,

   y a dos años vista no vence ninguna opción en miércoles (el LEAPS es el 21, tercer viernes). Así
   que la app preguntaba por `US.ASTS280112C70000`, el servidor no lo conocía, y lo único que se veía
   era `P&L · MANUAL` y un aviso diciendo "pulsa 🔄 Precios" — un botón que no podía arreglarlo nunca.

   Dos cosas se comprueban aquí:

     1. La app **dice** cuando el servidor no conoce un contrato, con el contrato escrito en cristiano
        y con su día de la semana, que es donde se ve el error. Y no lo confunde con el puente caído:
        si NO ha llegado ni una marca, el que falla es el servidor y no se acusa a ningún contrato.
     2. Un PMCC sin strike NI vencimiento de la corta se valora por la pata que le queda, tenga o no
        la marca `noShort` — porque una ficha editada a mano se queda sin la marca. Pero si falta
        solo UNO de los dos, eso sí es un dato a medias y no se valora nada.

     node pruebas/contrato-desconocido.mjs
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
const PUERTO = 8353;
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
   La cartera: la PMCC de Victor tal como está en su teléfono, más una acción y una short put que
   SÍ tiene precio (para que el servidor conteste algo y se pueda distinguir "no conoce ese
   contrato" de "el servidor no contesta").
--------------------------------------------------------------------------- */
const MK_PUT = 5.47;
const POS = [
  { id: "acc", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
    entryDate: "2026-02-01", broker: "IBKR", comision: "0" },
  { id: "put", tkr: "ASTS", block: 2, tipo: "Short Put", nat: "CRED", right: "P", qty: "100", strike: "63",
    expiry: "2026-10-23", prima: "8.20", entryDate: "2026-08-01", broker: "IBKR", comision: "0", last: "62.71" },
  /* la PMCC de Victor: corta recomprada (campos vacíos) y larga al 12 de enero del 28 — miércoles */
  { id: "pmcc", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "",
    expiry: "", prima: "2.31", noShort: true, entryDate: "2026-08-12", broker: "IBKR", comision: "0.7",
    pnlModo: "MANUAL", pnl: "0", mktValue: "0", last: "62.71",
    long: { strike: "70", expiry: "2028-01-12", prima: "34.81", comision: "" },
    rollChain: [{ date: "2026-09-05", prevStrike: "80", prevExpiry: "2026-09-18", prevPrima: "4.50",
      buybackCost: 2.19, newCredit: 0, comision: 0, soloRecompra: true }] },
];
const CASH = -5000, MARGIN = 3000;
const COD_MALO = "US.ASTS280112C70000";
const COD_BUENO = "US.ASTS280121C70000";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
/* el puente de mentira: contesta a lo que conoce y calla lo que no, que es lo que hace OpenD */
const abrir = async (pos, conoce) => {
  const pedidos = [];
  const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 62.71, dp: 0, pc: 62.71, h: 62.71 }) }));
  /* el puente de mentira habla como el de verdad: GET /opciones?codigos=a,b,c y devuelve
     { ok, opciones: {...}, sin_datos: [...] } — contesta lo que conoce y lista lo que no. */
  await ctx.route(/puente\.alphavext\.com/, (r) => {
    const u = r.request().url();
    const m = u.match(/[?&]codigos=([^&]+)/);
    if (!/\/opciones/.test(u) || !m) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    const cods = decodeURIComponent(m[1]).split(",").filter(Boolean);
    cods.forEach((c) => pedidos.push(c));
    const out = {};
    cods.filter((c) => conoce[c] != null).forEach((c) => {
      out[c] = { ultimo: conoce[c], medio: conoce[c], iv: 0.6, delta: 0.3, theta: -0.05, fecha_dato: new Date().toISOString() };
    });
    return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, opciones: out, sin_datos: cods.filter((c) => conoce[c] == null) }) });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(({ pos, cash, margin }) => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", "portfolio");
    localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
    /* con key de precios guardada la app hace sola la descarga al arrancar (v5.05) — que es
       exactamente lo que se quiere medir aquí: qué pasa DESPUÉS de preguntarle al servidor. */
    localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
  }, { pos, cash: CASH, margin: MARGIN });
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  /* la descarga tarda: hay una pausa por ticker y la del puente encima */
  await page.waitForTimeout(3500);
  return { ctx, page, errs, pedidos };
};

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* ---------------------------------------------------------------------------
   1. LAS PATAS: la PMCC sin corta se describe por la larga, con marca `noShort` o sin ella.
--------------------------------------------------------------------------- */
console.log("=== un PMCC al que le han recomprado la corta ===");
const a = await abrir(POS, { [COD_BUENO]: 41.2, "US.ASTS261023P63000": MK_PUT });
const patas = await a.page.evaluate((pos) => {
  const p = pos.find((x) => x.id === "pmcc");
  const conMarca = { ...p };
  const { noShort, ...sinMarca } = p;                        /* ficha editada a mano: sin `noShort` */
  const media = { ...p, noShort: false, strike: "80" };       /* corta a medias: strike sí, vto no */
  const r = (q) => patasDePosicion(q).map((x) => x.cod);
  return { conMarca: r(conMarca), sinMarca: r(sinMarca), media: r(media) };
}, POS);
console.log("  con `noShort`        → " + JSON.stringify(patas.conMarca));
console.log("  sin `noShort`        → " + JSON.stringify(patas.sinMarca));
console.log("  con strike y sin vto → " + JSON.stringify(patas.media));
ok(patas.conMarca.length === 1 && patas.conMarca[0] === COD_MALO, "se describe por la pata que le queda: " + COD_MALO);
ok(patas.sinMarca.length === 1, "y también sin la marca `noShort` — una ficha editada a mano no la tiene");
ok(patas.media.length === 0, "pero con el strike puesto y el vencimiento vacío, NO se valora: es un dato a medias");

/* ---------------------------------------------------------------------------
   2. SE PREGUNTA POR ÉL, Y SE DICE QUE EL SERVIDOR NO LO CONOCE
--------------------------------------------------------------------------- */
console.log("\n=== se pregunta por el contrato, y el servidor no lo conoce ===");
console.log("  pedidos al servidor: " + JSON.stringify([...new Set(a.pedidos)]));
ok(a.pedidos.indexOf(COD_MALO) >= 0, "la app SÍ pregunta por " + COD_MALO + " (antes de la v5.22 ni preguntaba)");
const v = await a.page.evaluate(() => {
  const t = document.body.innerText;
  return { aviso: (t.match(/[^\n]*no conoce[^\n]*/) || [""])[0],
    refresco: (t.match(/Sin precio todavía:[^\n]*/) || [""])[0],
    cab: (t.match(/[^\n]*opciones con precio real[^\n]*/) || [""])[0] };
});
console.log("  " + v.aviso);
ok(/ASTS PMCC/.test(v.aviso), "se NOMBRA la posición (sale: " + v.aviso.slice(0, 60) + "…)");
ok(/ASTS 70C/.test(v.aviso) && /12 ene 2028/.test(v.aviso), "y el contrato por el que se preguntó, en cristiano");
ok(/miércoles/.test(v.aviso), "CON EL DÍA DE LA SEMANA — que es donde se ve el error: nada vence en miércoles a dos años");
ok(/no lo va a arreglar|no va a arreglar/.test(v.aviso), "y se dice que volver a pulsar 🔄 Precios no sirve");
ok(!/ASTS PMCC/.test(v.refresco), "sin mezclarla con las que solo necesitan un refresco");
await a.page.screenshot({ path: D + "/contrato-desconocido.png" });
ok(!a.errs.length, "sin errores de JS " + JSON.stringify(a.errs.slice(0, 2)));
await a.ctx.close();

/* ---------------------------------------------------------------------------
   3. CON EL VENCIMIENTO BUENO, SE VALORA SOLA
--------------------------------------------------------------------------- */
console.log("\n=== y con el vencimiento corregido al 21 (tercer viernes), se valora ===");
const POS_OK = POS.map((p) => (p.id === "pmcc" ? { ...p, long: { ...p.long, expiry: "2028-01-21" } } : p));
const b = await abrir(POS_OK, { [COD_BUENO]: 41.2, "US.ASTS261023P63000": MK_PUT });
const vb = await b.page.evaluate(() => {
  const t = document.body.innerText;
  const val = (q) => (isFinite(effMkt(q)) ? Math.round(effMkt(q) * 100) / 100 : null);
  return { aviso: (t.match(/[^\n]*no conoce[^\n]*/) || [""])[0], cab: (t.match(/[^\n]*opciones con precio real[^\n]*/) || [""])[0] };
});
const valores = await b.page.evaluate((pos) => {
  const p = pos.find((x) => x.id === "pmcc");
  /* se lee la posición YA refrescada, que es la que tiene las marcas */
  const vivas = JSON.parse(localStorage.getItem("bloques_pos_v5") || "[]");
  const q = vivas.find((x) => x.id === p.id) || p;
  return { marks: q.optMarks || null, eff: Math.round(effMkt(q) * 100) / 100, real: mktEsReal(q), pnl: Math.round(effPnl(q) * 100) / 100 };
}, POS_OK);
console.log("  marcas guardadas → " + JSON.stringify(valores.marks));
console.log("  vale " + valores.eff + " · P&L " + valores.pnl + " · real: " + valores.real);
console.log("  " + vb.cab);
ok(valores.real === true, "con el contrato bueno, la PMCC pasa a valor REAL");
ok(valores.eff === 4120, "vale +$4.120 (41,20 × 100 de la call comprada) — sale " + valores.eff);
ok(valores.pnl === Math.round((41.2 - 34.81) * 100 * 100) / 100, "y su P&L es (41,20 − 34,81) × 100 = +$639 — sale " + valores.pnl);
ok(!/ASTS PMCC/.test(vb.aviso), "y ya no se avisa de ningún contrato desconocido");
ok(!b.errs.length, "sin errores de JS " + JSON.stringify(b.errs.slice(0, 2)));
await b.ctx.close();

/* ---------------------------------------------------------------------------
   4. Y SI EL QUE FALLA ES EL SERVIDOR, NO SE ACUSA A NINGÚN CONTRATO.
   Sin esta regla, un puente apagado señalaría como "desconocidos" TODOS los contratos de la cartera
   y mandaría a Victor a revisar diez posiciones que están perfectas.
--------------------------------------------------------------------------- */
console.log("\n=== si el servidor no contesta nada, la culpa no es de los contratos ===");
const c = await abrir(POS_OK, {});
const vc = await c.page.evaluate(() => {
  const t = document.body.innerText;
  return { aviso: (t.match(/[^\n]*no conoce[^\n]*/) || [""])[0],
    refresco: (t.match(/Sin precio todavía:[^\n]*/) || [""])[0] };
});
console.log("  aviso de contrato desconocido → " + (vc.aviso || "(ninguno, bien)"));
console.log("  " + vc.refresco);
ok(!vc.aviso, "con el servidor mudo NO se señala ningún contrato");
ok(/ASTS/.test(vc.refresco), "se cae al aviso de siempre: pulsa 🔄 Precios");
ok(!c.errs.length, "sin errores de JS " + JSON.stringify(c.errs.slice(0, 2)));
await c.ctx.close();

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
