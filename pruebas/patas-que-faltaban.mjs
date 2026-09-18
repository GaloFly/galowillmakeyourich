/* ---------------------------------------------------------------------------
   LAS PATAS QUE FALTABAN (v5.22)

   Victor, tras la v5.21: *"sigue igual"*. El aviso de la v5.21 ya decía cuáles eran —dos Long Call
   de IBIT y tres PMCC— y ahí se vio que no era cosa de pulsar 🔄 Precios: la app NO SABÍA DESCRIBIR
   esas cinco posiciones, aunque todas sean un único contrato o dos bien identificados. En IBKR esas
   cinco valen +10.876, que es casi exactamente el hueco que quedaba (10.962).

   Dos causas distintas, las dos comprobadas en el compilado antes de tocar nada:

     1. La Long Call se guarda con nat DEF (riesgo definido), no DEB. El filtro de `esUnaPata` pedía
        CRED o DEB, así que la ÚNICA estrategia de débito de un solo contrato quedaba fuera — y el
        CHANGELOG lleva diciendo desde la v4.51 que tiene precio real. (La prueba de la v5.20 no lo
        cazó porque su IBIT de laboratorio estaba escrito con nat DEB, que no es como lo crea el
        asistente. Aquí se escribe como lo crea el asistente.)

     2. Un PMCC al que se le recompró o expiró la call corta (`noShort`, v3.46/v5.10) se queda vivo
        con solo la pata larga. `patasDePosicion` exigía DOS patas siempre y devolvía la lista vacía:
        sin precio real, sin griegas, en silencio, y justo en el caso más fácil de valorar.

   Lo que se comprueba, que es lo que puede salir mal:

     · las cinco posiciones de Victor pasan a tener valor real, con su signo y su importe;
     · el candado sigue puesto: al PMCC entero le tienen que estar las DOS marcas, y si a uno le
       falta el vencimiento de la larga no se le inventa nada;
     · lo que NO es de una pata sigue sin serlo: un Calendar es nat DEF y guarda un strike suelto,
       y por ahí no se puede colar (conserva su valor escrito a mano);
     · y sin servidor, cero marcas — como siempre.

     node pruebas/patas-que-faltaban.mjs
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
const PUERTO = 8352;
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
   Las posiciones que salían sin precio en la cartera de Victor, con los importes que IBKR le da a
   cada una. Los precios por acción son esos importes entre 100 (todas son de un contrato).

     IBIT call 39  · larga, pagada a 27,50 → hoy 47,29 → vale +$4.729   (IBKR: 4.729)
     IBIT call 45  · larga, pagada a  9,00 → hoy 13,28 → vale +$1.328   (IBKR: 1.328)
     ASTS PMCC sin corta · long call 60 pagada a 32,50 → hoy 25,30 → vale +$2.530   (IBKR: 2.530)
     ASTS PMCC con corta · long call 70 a 30,00 → hoy 28,00 (+2.800)
                           call corta 95 cobrada a 8,00 → hoy 6,00 (−600)  →  vale +$2.200

   Y un Calendar de control: nat DEF con strike y vencimiento sueltos, como los guarda la app. NO es
   de una pata y no se le puede pedir precio: conserva los −$1.500 escritos a mano.
--------------------------------------------------------------------------- */
const MK = { lc39: 47.29, lc45: 13.28, astsLong: 25.30, astsLong2: 28.00, astsShort: 6.00 };
const VAL_LC39 = 4729, VAL_LC45 = 1328, VAL_PMCC_SIN = 2530, VAL_PMCC_CON = 2200;
const VAL_CAL = -1500, VAL_ACC = 13000;
const MKTVL = VAL_ACC + VAL_LC39 + VAL_LC45 + VAL_PMCC_SIN + VAL_PMCC_CON + VAL_CAL; /* 22.287 */

const POS = [
  { id: "acc", tkr: "NVDA", block: 1, tipo: "Long Stock", nat: "ACC", qty: "100", bep: "100", last: "130",
    entryDate: "2026-02-01", broker: "IBKR", comision: "0" },
  /* Long Call tal como la escribe el asistente: nat DEF, right C, riesgo = prima pagada */
  { id: "lc39", tkr: "IBIT", block: 2, tipo: "Long Call", nat: "DEF", right: "C", qty: "100", strike: "39",
    expiry: "2027-12-17", prima: "27.50", bep: "66.50", riesgo: "2750", entryDate: "2026-03-02", broker: "IBKR",
    comision: "0", pnl: "0", mktValue: "0", optMarks: { "US.IBIT271217C39000": MK.lc39 } },
  { id: "lc45", tkr: "IBIT", block: 2, tipo: "Long Call", nat: "DEF", right: "C", qty: "100", strike: "45",
    expiry: "2027-01-15", prima: "9", bep: "54", riesgo: "900", entryDate: "2026-05-11", broker: "IBKR",
    comision: "0", pnl: "0", mktValue: "0", optMarks: { "US.IBIT270115C45000": MK.lc45 } },
  /* PMCC al que se le recompró la corta: strike y vencimiento vacíos, noShort, solo queda la long */
  { id: "pmccSin", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "",
    expiry: "", prima: "3.10", noShort: true, entryDate: "2026-04-20", broker: "IBKR", comision: "0",
    pnl: "0", mktValue: "0", long: { strike: "60", expiry: "2028-01-21", right: "C", prima: "32.50" },
    rollChain: [{ date: "2026-09-01", prevStrike: "80", prevExpiry: "2026-09-18", prevPrima: "8.20",
      buybackCost: 5.1, newCredit: 0, comision: 0, soloRecompra: true }],
    optMarks: { "US.ASTS280121C60000": MK.astsLong } },
  /* PMCC entero: las DOS patas tienen que estar */
  { id: "pmccCon", tkr: "ASTS", block: 2, tipo: "PMCC", nat: "CRED", right: "C", qty: "100", strike: "95",
    expiry: "2027-01-21", prima: "8", entryDate: "2026-04-20", broker: "IBKR", comision: "0",
    pnl: "0", mktValue: "0", long: { strike: "70", expiry: "2028-01-21", right: "C", prima: "30" },
    optMarks: { "US.ASTS270121C95000": MK.astsShort, "US.ASTS280121C70000": MK.astsLong2 } },
  /* control: débito genérico multi-pata con un strike suelto — NO es de una pata */
  { id: "cal", tkr: "SPY", block: 3, tipo: "Calendar", nat: "DEF", right: "P", qty: "100", strike: "560",
    expiry: "2026-12-18", prima: "12", entryDate: "2026-08-01", broker: "IBKR", comision: "0",
    mktValue: String(VAL_CAL), optMarks: { "US.SPY261218P560000": 4.1 } },
];
const CASH = -5000, MARGIN = 3000;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const abrir = async (pos, conPuente) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 130, dp: 0, pc: 130, h: 130 }) }));
  await ctx.route(/puente\.alphavext\.com/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(({ pos, cash, margin, puente }) => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify(pos));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: String(cash), margin: String(margin) } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", "portfolio");
    if (puente) localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  }, { pos, cash: CASH, margin: MARGIN, puente: conPuente });
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
};

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };
const r2 = (v) => Math.round(v * 100) / 100;

const { ctx, page, errs } = await abrir(POS, true);

/* ---------------------------------------------------------------------------
   1. LAS PATAS. Es el punto exacto donde las cinco posiciones se caían.
--------------------------------------------------------------------------- */
console.log("=== ¿sabe la app describir estas posiciones? ===");
const hay = await page.evaluate(() => ["patasDePosicion", "esUnaPata", "mktRealOpcion", "effMkt", "mktEsReal", "effPnl"]
  .every((f) => { try { return typeof eval(f) === "function"; } catch (e) { return false; } }));
if (!hay) { console.log("  ✗ las funciones no son accesibles desde la página"); await browser.close(); servidor.close(); process.exit(1); }
const patas = await page.evaluate((pos) => {
  const out = {};
  pos.forEach((p) => { out[p.id] = { n: patasDePosicion(p).length, cods: patasDePosicion(p).map((x) => x.cod), una: esUnaPata(p) }; });
  return out;
}, POS);
Object.keys(patas).forEach((k) => console.log("  " + k.padEnd(8) + " → " + patas[k].n + " pata(s)  " + JSON.stringify(patas[k].cods)));
ok(patas.lc39.n === 1 && patas.lc39.cods[0] === "US.IBIT271217C39000",
  "la Long Call (nat DEF, como la crea el asistente) es UNA pata: US.IBIT271217C39000");
ok(patas.lc45.n === 1, "y la segunda Long Call también");
ok(patas.pmccSin.n === 1 && patas.pmccSin.cods[0] === "US.ASTS280121C60000",
  "un PMCC sin call vendida es la pata que le queda: la long comprada");
ok(patas.pmccCon.n === 2, "y el PMCC entero sigue siendo DOS patas, como siempre");
ok(patas.cal.n === 0 && patas.cal.una === false,
  "un Calendar (nat DEF con strike suelto) NO se cuela por el hueco de la Long Call");

/* ---------------------------------------------------------------------------
   2. EL VALOR, con los importes que le da IBKR
--------------------------------------------------------------------------- */
console.log("\n=== lo que vale cada una (a la derecha, lo que dice IBKR) ===");
const vals = await page.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const out = {};
  pos.forEach((p) => { out[p.id] = { eff: r(effMkt(p)), esReal: mktEsReal(p), pnl: r(effPnl(p)) }; });
  return out;
}, POS);
console.log("  IBIT call 39      → " + vals.lc39.eff + "   (IBKR " + VAL_LC39 + ")");
console.log("  IBIT call 45      → " + vals.lc45.eff + "   (IBKR " + VAL_LC45 + ")");
console.log("  ASTS PMCC sin corta → " + vals.pmccSin.eff + "   (IBKR " + VAL_PMCC_SIN + ")");
console.log("  ASTS PMCC entero    → " + vals.pmccCon.eff + "   (esperado " + VAL_PMCC_CON + ")");
console.log("  Calendar (manual)   → " + vals.cal.eff + "   (lo escrito: " + VAL_CAL + ")");
ok(vals.lc39.eff === VAL_LC39 && vals.lc39.esReal, "la call 39 vale +$" + VAL_LC39 + " y se marca REAL (sale " + vals.lc39.eff + ")");
ok(vals.lc45.eff === VAL_LC45 && vals.lc45.esReal, "la call 45 vale +$" + VAL_LC45 + " (sale " + vals.lc45.eff + ")");
ok(vals.pmccSin.eff === VAL_PMCC_SIN && vals.pmccSin.esReal, "el PMCC sin corta vale +$" + VAL_PMCC_SIN + " (sale " + vals.pmccSin.eff + ")");
ok(vals.pmccCon.eff === VAL_PMCC_CON && vals.pmccCon.esReal, "el PMCC entero vale +$" + VAL_PMCC_CON + " = +2.800 de la larga − 600 de la corta (sale " + vals.pmccCon.eff + ")");
ok(vals.cal.eff === VAL_CAL && vals.cal.esReal === false, "y al Calendar no se le inventa nada: sigue en " + VAL_CAL);
/* el fallo tonto que hay que impedir: que una larga entre con el signo cambiado */
ok(vals.lc39.eff > 0 && vals.pmccSin.eff > 0, "una call comprada vale A FAVOR, no en contra");

console.log("\n=== y su P&L deja de ser un número escrito a mano ===");
console.log("  IBIT call 39 → " + vals.lc39.pnl + "   (47,29 − 27,50) × 100 = 1979");
console.log("  PMCC sin corta → " + vals.pmccSin.pnl + "   (25,30 − 32,50) × 100 = −720 en la long");
ok(vals.lc39.pnl === r2((MK.lc39 - 27.5) * 100), "P&L real de la call 39: +$1.979 (sale " + vals.lc39.pnl + ")");
ok(vals.pmccSin.pnl === r2((MK.astsLong - 32.5) * 100),
  "P&L real de la long que queda en el PMCC: −$720 — lo cobrado por la corta recomprada ya está reservado en el realizado (sale " + vals.pmccSin.pnl + ")");

/* ---------------------------------------------------------------------------
   3. EL CANDADO: o todas las marcas, o ninguna. Si se hubiera arreglado el PMCC devolviendo
      "las patas que se puedan", un PMCC con corta viva a la que le falte el precio habría valido
      solo por su long — la mitad de la posición, con pinta de exacta.
--------------------------------------------------------------------------- */
console.log("\n=== el candado de la v4.51 sigue puesto ===");
const candados = await page.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const con = pos.find((p) => p.id === "pmccCon");
  const sin = pos.find((p) => p.id === "pmccSin");
  /* PMCC entero al que le falta el precio de la corta */
  const cojo = { ...con, optMarks: { "US.ASTS280121C70000": 28 }, mktValue: "-999" };
  /* PMCC sin corta al que le falta el VENCIMIENTO de la larga: no hay contrato que pedir */
  const roto = { ...sin, long: { strike: "60", right: "C", prima: "32.50" }, mktValue: "-888" };
  return { cojo: r(effMkt(cojo)), cojoPatas: patasDePosicion(cojo).length, cojoReal: mktEsReal(cojo),
    roto: r(effMkt(roto)), rotoPatas: patasDePosicion(roto).length };
}, POS);
console.log("  PMCC sin el precio de su corta → " + candados.cojo + "  ·  PMCC sin el vencimiento de su larga → " + candados.roto);
ok(candados.cojoPatas === 2 && candados.cojo === -999 && candados.cojoReal === false,
  "si falta la marca de UNA pata no se usa ninguna: cae a lo escrito (sale " + candados.cojo + ")");
ok(candados.rotoPatas === 0 && candados.roto === -888,
  "y sin el vencimiento de la larga no hay patas que pedir: tampoco se inventa (sale " + candados.roto + ")");

/* ---------------------------------------------------------------------------
   4. EN PANTALLA
--------------------------------------------------------------------------- */
console.log("\n=== MKT VL en pantalla ===");
console.log("  13.000 acciones + 4.729 + 1.328 + 2.530 + 2.200 − 1.500 = " + MKTVL);
const v = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/VALOR MERCADO\s*\n\s*(-?)\$([\d,]+)/);
  return { mkt: m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN,
    cab: (t.match(/[^\n]*opciones con precio real[^\n]*/) || [""])[0],
    falta: (t.match(/Sin precio todavía:[^\n]*/) || [""])[0] };
});
console.log("  en pantalla → $" + v.mkt);
console.log("  " + v.cab);
ok(v.mkt === MKTVL, "MKT VL = $" + MKTVL + " (sale $" + v.mkt + ")");
ok(/4 de tus 5 opciones/.test(v.cab), "la cabecera cuenta 4 de 5 con precio real — la quinta es el Calendar (sale: " + v.cab + ")");
ok(!/IBIT|ASTS/.test(v.falta), "y ya no se nombra a ninguna IBIT ni ASTS entre las que faltan");

/* ---------------------------------------------------------------------------
   4b. Y AL CALENDAR NO SE LE MANDA A COMPLETAR NADA.
   El aviso de la v5.21 metía en el mismo saco a un PMCC al que de verdad le falta un dato y a un
   Iron Condor o un Calendar, que NO guardan sus patas por separado y nunca las han guardado. Al
   segundo le decía "ábrela y complétala": un botón que no existe, que es justo el pecado que la
   v5.21 vino a arreglar en el otro sitio.
--------------------------------------------------------------------------- */
console.log("\n=== lo que no tiene arreglo por tu parte, se dice así ===");
const avisos = await page.evaluate(() => {
  const t = document.body.innerText;
  return { completar: (t.match(/[^\n]*no se le[s]? puede pedir precio[^\n]*/) || [""])[0],
    manual: (t.match(/[^\n]*no guarda sus patas por separado[^\n]*/) || [""])[0] };
});
console.log("  \"completa esto\" → " + (avisos.completar || "(nada, bien)"));
console.log("  \"esto es manual\" → " + avisos.manual);
ok(!/Calendar/.test(avisos.completar), "al Calendar NO se le manda a completar datos que no le faltan");
ok(/Calendar/.test(avisos.manual) && /No te falta ningún dato/.test(avisos.manual),
  "se dice que su valor es manual porque la app no sabe descomponerlo (sale: " + avisos.manual + ")");
await page.screenshot({ path: D + "/patas-que-faltaban.png" });
ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
await ctx.close();

/* ---------------------------------------------------------------------------
   5. SIN SERVIDOR: NI UNA MARCA — la red de los dos amigos de Victor.
--------------------------------------------------------------------------- */
console.log("\n=== sin servidor propio, todo como antes ===");
const b = await abrir(POS, false);
const sinPuente = await b.page.evaluate((pos) => {
  const r = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : null);
  const t = document.body.innerText;
  const m = t.match(/VALOR MERCADO\s*\n\s*(-?)\$([\d,]+)/);
  const out = {};
  pos.forEach((p) => { out[p.id] = { eff: r(effMkt(p)), esReal: mktEsReal(p) }; });
  return { out, mkt: m ? (m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")) : NaN,
    dice: /opciones con precio real/.test(t) };
}, POS);
console.log("  IBIT call 39 → " + sinPuente.out.lc39.eff + " (era " + VAL_LC39 + " con servidor) · MKT VL $" + sinPuente.mkt);
ok(sinPuente.out.lc39.eff === 0 && sinPuente.out.pmccSin.eff === 0,
  "sin servidor NO se usa ni una marca, aunque estén guardadas en la posición");
ok(!sinPuente.out.lc39.esReal && !sinPuente.out.pmccCon.esReal, "y ninguna se marca como REAL");
ok(sinPuente.mkt === VAL_ACC + VAL_CAL, "MKT VL vuelve a ser acciones + lo escrito a mano: $" + (VAL_ACC + VAL_CAL) + " (sale $" + sinPuente.mkt + ")");
ok(!sinPuente.dice, "y no se presume de precios reales que no hay");
ok(!b.errs.length, "sin errores de JS " + JSON.stringify(b.errs.slice(0, 2)));
await b.ctx.close();

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
