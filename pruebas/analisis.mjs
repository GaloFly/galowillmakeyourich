/* ---------------------------------------------------------------------------
   PRUEBA DE LA PESTAÑA ANÁLISIS (v4.93 · ampliada en la v4.94)

   El puente va simulado con una cadena de opciones inventada A PROPÓSITO: gamma plana y precios
   redondos, para poder calcular a mano —aquí arriba, fuera de la app— lo que TIENE que salir, y
   contrastarlo con lo que pinta la pantalla. Si el cálculo de la app se desvía, la prueba lo dice
   con los dos números delante.

   Comprueba además las dos fronteras que no se pueden cruzar:
     · SIN servidor propio la pestaña NO EXISTE (los amigos de Victor ven las de siempre)
     · SIETE llamadas al puente por análisis, ni una por strike (el cupo de OpenD es compartido)

     node pruebas/analisis.mjs

   Requiere `dist/` compilado (npm run build); sirve esa carpeta él solo.
   Deja recortes de cada ficha en la carpeta temporal que diga SALIDA (por defecto /tmp), para
   MIRARLAS y no solo medirlas — lección de la v4.90.
--------------------------------------------------------------------------- */
import { createServer } from "http";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

/* Playwright no es dependencia del proyecto a propósito (ver pruebas/sin-servidor.mjs) */
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
const PUERTO = 8322;
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

const SPOT = 200;
const dentroDe = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* ---- siete vencimientos, para que los tres horizontes del flujo tengan de dónde salir ----
     CORTO (≤14d):  7 y 12 días     MEDIO (15-60d): 30, 44 y 58     LARGO (>60d): 90 y 110
   El de 30 días es el que usan la gamma, el interés abierto y el ROI (su regla: DTE entre 30 y 45,
   y dentro del rango el más cercano a 30). */
/* 31 y no 30: `dias()` redondea, y un vencimiento sembrado "a 30 días" sale a 29 según la hora
   del día — y 29 se cae del rango [30,45] por un pelo. Con 31, el bucket es el mismo siempre. */
const VTOS = { a: dentroDe(7), b: dentroDe(12), c: dentroDe(31), d: dentroDe(44),
               e: dentroDe(58), f: dentroDe(90), g: dentroDe(110) };
const VTO = VTOS.c;          /* el del gamma y el ROI */
const VTO2 = VTOS.e;

/* cadena a mano: strikes de 170 a 230 de 10 en 10, puts y calls, en los siete vencimientos.
   Se pone MUCHO OI de calls en 220 y MUCHO de puts en 180 -> esos deben salir como los muros. */
const STRIKES = [170, 180, 190, 200, 210, 220, 230];
const OI = { call: { 170: 200, 180: 300, 190: 500, 200: 900, 210: 1200, 220: 9000, 230: 800 },
             put:  { 170: 700, 180: 8000, 190: 1100, 200: 950, 210: 400, 220: 200, 230: 100 } };
const VOL = { call: { 170: 10, 180: 20, 190: 40, 200: 300, 210: 250, 220: 600, 230: 30 },
              put:  { 170: 60, 180: 500, 190: 80, 200: 200, 210: 30, 220: 10, 230: 5 } };
const GAMMA = 0.01;            /* gamma plana, para poder hacer la cuenta a mano sin Black-Scholes */
const PX = { call: 5, put: 4 };
const IV = 40;                 /* en %, como lo manda OpenD */

/* deltas de las PUTS del vencimiento del ROI. Su criterio: la más cercana a −0,30 aceptando solo
   entre −0,36 y −0,18. Dentro caen la de 180 (−0,18) y la de 190 (−0,30) -> tiene que elegir P190. */
const DELTA_PUT = { 170: -0.10, 180: -0.18, 190: -0.30, 200: -0.50, 210: -0.70, 220: -0.85, 230: -0.95 };

/* volumen por vencimiento fuera del de 30 días, para que cada horizonte tenga un veredicto claro:
   corto muy comprador, medio empatado, largo muy vendedor y con aperturas. */
const OTROS = {
  [VTOS.a]: { call: 100, put: 20, oi: 400 },    [VTOS.b]: { call: 100, put: 20, oi: 400 },
  [VTOS.d]: { call: 50, put: 100, oi: 800 },    [VTOS.e]: { call: 50, put: 100, oi: 800 },
  [VTOS.f]: { call: 10, put: 300, oi: 100 },    [VTOS.g]: { call: 10, put: 300, oi: 100 },
};
/* el interés abierto de estos vencimientos se bajó en la v4.98 (era 5.000 en todos) para que la
   mariposa se pueda JUZGAR mirándola: con un OI uniforme y enorme, el volumen del día quedaba en
   un píxel en todas las filas y el dibujo no decía nada. No cambia ningún veredicto: las aperturas
   siguen pidiendo más de 200 de volumen, y esos vencimientos mueven 100 o menos. */

const cod = (k, lado, v) => "US.TEST" + v.slice(2).replace(/-/g, "") + lado + k * 1000;
const contratos = [];
Object.values(VTOS).forEach((v) => STRIKES.forEach((k) => {
  contratos.push({ codigo: cod(k, "C", v), tipo: "CALL", strike: k, vencimiento: v });
  contratos.push({ codigo: cod(k, "P", v), tipo: "PUT", strike: k, vencimiento: v });
}));
const opciones = {};
contratos.forEach((c) => {
  const lado = c.tipo === "CALL" ? "call" : "put";
  const otro = OTROS[c.vencimiento];
  const vol = otro ? otro[lado] : VOL[lado][c.strike];
  const oi = otro ? otro.oi : OI[lado][c.strike];
  const delta = c.vencimiento === VTO && lado === "put" ? DELTA_PUT[c.strike] : (lado === "call" ? 0.4 : -0.4);
  opciones[c.codigo] = { codigo: c.codigo, ultimo: PX[lado], medio: PX[lado], bid: PX[lado] - 0.1, ask: PX[lado] + 0.1,
    volumen: vol, interes_abierto: oi, iv: IV, delta,
    gamma: GAMMA, theta: -0.02, vega: 0.1, fecha_dato: "2026-08-18 15:00:00" };
});

/* ---- el ROI, a mano ---- (P190: bid 3,90 · medio 4,00 · ask 4,10 · 30 días · IV 40%)
     ROI al bid      = 3,90 / (190 − 3,90) = 2,10%
     ROI anualizado  = 2,0956 × 365/30     = 25%
     equilibrio      = 190 − 3,90          = $186,10
     horquilla       = (4,10 − 3,90) / 4   = 5%
     movimiento esp. = 200 × 0,40 × √(30/365) = $22,94
     strike en EM    = (200 − 190) / 22,94 = 0,44  -> por debajo de 1: ÁMBAR, "justo" */
const ROI_BID = 3.9 / (190 - 3.9) * 100;
/* el plazo exacto lo pone la app (redondea igual que el mercado), así que las cifras que dependen
   de él se comparan contra la MISMA fórmula escrita aquí, no contra un número congelado */
const roiAnualDe = (dte) => Math.round(ROI_BID * 365 / dte);
const emDe = (dte) => 200 * 0.40 * Math.sqrt(dte / 365);
console.log("=== el ROI, a mano ===");
console.log("  elige P190 (delta −0,30) · ROI " + ROI_BID.toFixed(2) + "% · equilibrio $186.1 · horquilla 5%");
console.log("  y con el plazo que diga la app: anual = 2,0956 × 365/dte · EM = 200 × 0,40 × √(dte/365)\n");

/* ---- el flujo, a mano ----
   CORTO  (7 y 12 días): calls 2×7×100 = 1.400 · puts 2×7×20 = 280
      P/C 0,20 -> +1 · calls−puts +1.120 sobre umbral 168 -> +1
      prima calls $700k contra puts $112k -> +1 · aperturas 0/0 -> 0        SCORE +3 ALCISTA
   MEDIO  (30, 44 y 58): calls 1.250+700 = 1.950 · puts 885+1.400 = 2.285
      P/C 1,17 -> 0 · diferencia −335 bajo umbral 423 -> 0
      prima $975k contra $914k, ninguna gana por 1,5× -> 0 · aperturas 0/0 -> 0   SCORE 0 NEUTRAL
   LARGO  (90 y 110): calls 140 · puts 4.200
      P/C 30 -> −1 · −4.060 -> −1 · prima $70k contra $1,68M -> −1
      aperturas: las puts mueven 300 sobre 100 de OI = 3× -> −1              SCORE −4 BAJISTA */
/* la ficha profunda, con los nombres REALES del servidor: periodos son TRIMESTRES, los márgenes
   son escalares y no listas, el consenso se llama consenso_analistas, y el DCF viene dentro —
   para comprobar que la app NO lo pinta aunque lo tenga delante. */
const FICHA = {
  ticker: "TEST", generado: "2026-08-19T02:00", precio: 146.99,
  financiero: { periodos: ["2026/Q3", "2026/Q2", "2026/Q1", "2025/Q4"],
                revenue: [4.2e9, 3.9e9, 3.6e9, 3.4e9], net_income: [4.6e8, 4.1e8, 3.8e8, 3.5e8],
                fcf: [7.2e8, 6.6e8, 6.1e8, 5.8e8], margen_neto_pct: 10.9, margen_fcf_pct: 17.2 },
  balance: { caja: 5.1e9, deuda_total: 9.3e9, deuda_neta: 4.2e9, equity: 1.2e10, ebitda_ttm: 2.1e9 },
  multiplos: { market_cap: 7.24e10, ev: 7.66e10, ev_ebitda: 14.0, pe: 31.5, ps: 4.8,
               net_debt_ebitda: 2.0,
               hist_ev_ebitda: { actual: 14.0, min: 5.0, max: 22.0, mediana: 9.0, n: 20 },
               hist_fcf_yield: { actual: 3.1, min: 1.2, max: 8.4, mediana: 4.5, n: 20 } },
  valoracion: { morningstar_fair_value: 120.0, moat: "Narrow", incertidumbre: "High",
                consenso_analistas: { medio: 165.0, alto: 210.0, bajo: 110.0, n: 34,
                                      buy_pct: 62, hold_pct: 30, sell_pct: 8 },
                dcf_base: 383.17, dcf_supuestos: { wacc: 0.09 },
                dcf_sensibilidad: { "wacc8%_g1%": 383.17, "wacc10%_g1%": 275.55 } },
  ownership: { instit_pct: 61.2, instit_chg: 1.4, instituciones: 2450, smart_money_m: 12.4 },
};

console.log("=== el flujo, a mano ===");
console.log("  corto +3 ALCISTA · medio 0 NEUTRAL · largo −4 BAJISTA (y las puts largas, APERTURA)\n");

/* ---- lo que TIENE que salir, calculado aquí a mano ---- */
const gexDe = (oi) => GAMMA * oi * 100 * SPOT * SPOT * 0.01;          /* = oi × 400 */
const gexPorStrike = {};
STRIKES.forEach((k) => { gexPorStrike[k] = gexDe(OI.call[k]) - gexDe(OI.put[k]); });
const gexTotal = STRIKES.reduce((s, k) => s + gexPorStrike[k], 0);
const muroCall = STRIKES.slice().sort((a, b) => gexPorStrike[b] - gexPorStrike[a])[0];
const muroPut = STRIKES.slice().sort((a, b) => gexPorStrike[a] - gexPorStrike[b])[0];
const callVol = STRIKES.reduce((s, k) => s + VOL.call[k], 0);   /* solo el vto. de 30 días */
const putVol = STRIKES.reduce((s, k) => s + VOL.put[k], 0);
const pc = putVol / callVol;
const primaCall = STRIKES.reduce((s, k) => s + VOL.call[k] * PX.call * 100, 0);
const primaPut = STRIKES.reduce((s, k) => s + VOL.put[k] * PX.put * 100, 0);
console.log("=== calculado A MANO, fuera de la app ===");
console.log("  muro call:", muroCall, "· muro put:", muroPut);
console.log("  GEX total:", (gexTotal / 1e6).toFixed(2) + "M por cada 1%");
console.log("  P/C:", pc.toFixed(2), "· prima calls: $" + (primaCall / 1e3) + "k · prima puts: $" + (primaPut / 1e3) + "k");
console.log("  top print esperado: C220 (600 contratos × $5 × 100 = $300k)\n");

/* ---- v4.94: velas, valoración y reparto de capital ----
   Las velas se fabrican con una forma CONOCIDA para poder comprobar los niveles a mano: una onda
   de periodo 60 sesiones que va justo de 150 a 230. Así el precio TOCA de verdad los mismos dos
   niveles una y otra vez, que es exactamente lo que la herramienta tiene que reconocer:
     máximos en 230 -> i = 15, 75, 135, 195, 255  -> resistencia $230 con 5 toques
     mínimos en 150 -> i = 45, 105, 165, 225, 285 -> soporte     $150 con 5 toques
   El primer extremo del periodo es el máximo (i=15) y el mínimo llega después (i=45), así que el
   tramo grande va de 230 a 150: A LA BAJA. Sus retrocesos son 150 + 80×f, o sea 50% = $190.

   (El primer intento de estos datos era una recta con picos plantados encima, y estaba mal: un
   "valle" en 150 sobre un precio que ahí valía 130 no es un valle. La prueba cazó el dato, no el
   código — pero solo porque los toques se contaban uno a uno.) */
const VELAS = [];
{
  const inicio = Date.parse("2025-09-01T00:00:00Z");
  for (let i = 0; i < 300; i++) {
    const c = 190 + 40 * Math.sin((2 * Math.PI * i) / 60);
    VELAS.push({ f: new Date(inicio + i * 86400000).toISOString().slice(0, 10),
                 o: c, h: c, l: c, c, v: 1000000 });
  }
}
const VALORACION = { codigo: "US.TEST", nombre: "Test Inc", fundamentales_validos: true,
  capitalizacion: 72400000000, per: 31.5, per_ttm: 28.4, p_vc: 6.2, bpa: 7.04,
  valor_contable_accion: 32.3, dividendo_ttm_pct: 1.25, rotacion: 0.82,
  max_52s: 230, min_52s: 95 };
/* dinero: grandes +3M (5−2), muy grandes +1M (2−1), medianas −0,5M (1−1,5), pequeñas −2M (1−3)
   -> neto grandes (muy grande + grande) = +4M · neto pequeñas = −2M · neto total = +1,5M */
const DINERO = { codigo: "US.TEST",
  entra: { muy_grande: 2e6, grande: 5e6, media: 1e6, pequena: 1e6 },
  sale: { muy_grande: 1e6, grande: 2e6, media: 1.5e6, pequena: 3e6 } };
console.log("=== niveles y dinero, a mano ===");
console.log("  resistencia esperada: $230 con 5 toques · soporte esperado: $150 con 5 toques");
console.log("  neto grandes: +$4M · neto pequeñas: −$2M · neto total: +$1.5M\n");

const FUENTE_VELAS = "Stooq";   /* a propósito NO es Yahoo: si la app la tuviera escrita a fuego,
                                   diría "Yahoo" el día que las velas vengan de la otra fuente */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const llamadas = [];
/* el puente simulado, en una función: la prueba del ΔOI necesita una SEGUNDA sesión y no vale
   copiar y pegar los mismos manejadores — si se tocan, hay que tocarlos en un solo sitio */
const montaPuente = async (c, registrar) => {
  await c.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: SPOT, dp: 0, pc: SPOT, h: SPOT }) }));
  await c.route(/puente\.alphavext\.com/, (route) => {
    const u = new URL(route.request().url());
    if (registrar) llamadas.push(u.pathname);
    const J = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/cotiza") return J({ ok: true, cotizaciones: { "US.TEST": { ultimo: SPOT, cierre_anterior: SPOT } } });
    if (u.pathname === "/subyacente") return J({ ok: true, subyacente: { codigo: "US.TEST", nombre: "Test Inc", iv: 44.0, hv_30d: 40.0, iv_rank: 62.0 } });
    if (u.pathname === "/cadena") return J({ ok: true, contratos, total: contratos.length, vencimientos: Object.values(VTOS) });
    if (u.pathname === "/opciones") return J({ ok: true, opciones, pedidos: contratos.length, de_cache: 0, sin_datos: [] });
    /* la fuente llega como la manda el puente, con su coletilla entre paréntesis: la app tiene
       que quedarse con el nombre y no escupir el paréntesis en medio de la frase */
    if (u.pathname === "/velas") return J({ ok: true, simbolo: "TEST", velas: VELAS, total: VELAS.length, fuente: FUENTE_VELAS + " (no gasta cupo de OpenD)" });
    if (u.pathname === "/valoracion") return J({ ok: true, valoracion: VALORACION });
    if (u.pathname === "/dinero") return J({ ok: true, dinero: DINERO, columnas: ["capital_in_big"] });
    if (u.pathname === "/fundamentales") return J({ ok: true, codigo: "US.TEST", ticker: "TEST",
      generada: new Date(Date.now() - 3600000).toISOString(), edad_s: 3600, del_dia: true, ficha: FICHA });
    return J({ ok: true });
  });
};
const ctx = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
await montaPuente(ctx, true);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "40000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "comparador");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
});
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2400);
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await page.waitForTimeout(400);

let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* la pestaña solo existe con servidor */
const pestanas = await page.evaluate(() => Array.from(document.querySelectorAll("button, div"))
  .map((e) => (e.innerText || "").trim()).filter((t) => /^(Puts|Earnings|Screener|DC|Análisis|Alertas)$/.test(t)));
console.log("=== la pestaña ===");
console.log("  pestañas:", [...new Set(pestanas)].join(" · "));
ok(pestanas.includes("Análisis"), "con servidor propio aparece Análisis");

await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Análisis"); if (b) b.click(); });
await page.waitForTimeout(600);
const iconos = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("svg").forEach((s) => {
    const c = s.closest("div, button");
    const t = ((c && c.innerText) || "").trim().split("\n")[0];
    if (t === "Análisis") out.push(s.querySelectorAll("path, circle, rect, line").length);
  });
  return out;
});
ok(iconos.length > 0 && iconos[0] > 0, "y tiene icono de verdad (" + (iconos[0] || 0) + " trazos)");

/* analizar */
await page.locator("label", { hasText: "Ticker" }).locator("input").first().fill("TEST");
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Analizar/.test(x.textContent || "")); if (b) b.click(); });
await page.waitForTimeout(2000);
const t = await page.evaluate(() => document.body.innerText);
await page.screenshot({ path: D + "/analisis.png", fullPage: true });
/* recortes de cada ficha, para MIRARLAS y no solo medirlas */
/* recorte de la mariposa aparte: vive dentro de la ficha de flujo y hay que MIRARLA */
const recorta = async (etiqueta, nombre) => {
  const c = await page.evaluate((e) => {
    const s = Array.from(document.querySelectorAll("svg")).find((x) => (x.getAttribute("aria-label") || "").indexOf(e) === 0);
    if (!s) return null;
    s.scrollIntoView({ block: "center" });
    const b = s.getBoundingClientRect();
    return { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.width + 16, height: b.height + 16 };
  }, etiqueta);
  if (c && c.height > 20) { await page.waitForTimeout(300); await page.screenshot({ path: D + "/" + nombre + ".png", clip: c }); }
};

const caja = (q) => page.evaluate((s) => {
  const f = Array.from(document.querySelectorAll("div")).filter((x) => (x.textContent || "").indexOf(s) === 0);
  const d = f.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length).pop();
  const c = d && d.closest("div"); if (!c) return null;
  const b = c.getBoundingClientRect();
  return { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: b.width + 12, height: Math.min(b.height + 12, 700) };
}, q);
for (const [nombre, txt] of [["roi", "El put que venderías"], ["valoracion", "Valoración"], ["niveles", "Niveles: soportes"], ["gamma", "Muros de gamma"], ["oi", "Interés abierto por strike"], ["flujo", "Flujo de opciones de hoy"], ["dinero", "De dónde viene el dinero"]]) {
  const c1 = await caja(txt);
  if (!c1 || c1.height <= 20) continue;
  await page.evaluate((s) => {
    const f = Array.from(document.querySelectorAll("div")).filter((x) => (x.textContent || "").indexOf(s) === 0);
    const d = f.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length).pop();
    if (d) d.scrollIntoView({ block: "center" });
  }, txt);
  await page.waitForTimeout(400);
  const c2 = await caja(txt);
  if (c2) await page.screenshot({ path: D + "/analisis-" + nombre + ".png", clip: c2 });
}

await recorta("Volumen de hoy sobre interés abierto", "analisis-mariposa");

console.log("\n=== lo que pinta la app ===");
console.log("  llamadas al puente:", llamadas.join(" · "));
/* una llamada por RUTA, ninguna por strike ni por vencimiento: siete vencimientos y 98 contratos
   se resuelven con UNA cadena y UN lote de contratos. Ahí es donde se protege el cupo compartido. */
ok(llamadas.filter((x) => x === "/cadena").length === 1,
  "UNA sola cadena para el ROI, el flujo y la gamma (" + llamadas.filter((x) => x === "/cadena").length + ")");
ok(llamadas.filter((x) => x === "/opciones").length === 1,
  "y UN solo lote de contratos para los 98 de los siete vencimientos");
ok(llamadas.filter((x) => x === "/velas").length === 1,
  "y UNA sola petición de velas, que sirve para el diario y para el semanal");
ok(llamadas.includes("/fundamentales"), "la ficha profunda se pide también");
ok(llamadas.length === 8, "ocho llamadas en total (" + llamadas.length + "): " + llamadas.join(" "));
ok(new RegExp("\\$" + muroCall).test(t), "muro call $" + muroCall + " (el strike con más gamma de calls)");
ok(new RegExp("\\$" + muroPut).test(t), "muro put $" + muroPut);
/* la app usa k por debajo del millón, que es más preciso que "0,58M" */
const gexApp = (t.match(/([+−-])\$([\d.,]+)(M|k) por cada 1%/) || [])[0];
const esperadoTxt = (gexTotal >= 0 ? "+" : "−") + "$" +
  (Math.abs(gexTotal) >= 1e6 ? (Math.abs(gexTotal) / 1e6).toFixed(2) + "M" : Math.round(Math.abs(gexTotal) / 1e3) + "k") + " por cada 1%";
console.log("  GEX que pinta:", gexApp, "· a mano:", esperadoTxt);
ok(gexApp === esperadoTxt, "el GEX total cuadra al dígito con la cuenta hecha aparte");
ok(/IV 44\.0/.test(t) && /HV 30d 40\.0/.test(t) && /IV\/HV 1\.10/.test(t), "la cabecera trae IV, HV e IV/HV (44/40 = 1,10)");
/* el P/C global se fue con la ficha de flujo vieja: ahora hay uno por horizonte, y tener los dos
   invitaba a compararlos cuando miden cosas distintas. Se comprueba abajo, horizonte a horizonte. */
const flip = (t.match(/Punto de giro \$?([\d.,]+)/) || [])[1];
console.log("  punto de giro (MODELO):", flip || "no lo encuentra");
ok(/Punto de giro/.test(t), "sale el punto de giro");
ok(/MODELO/.test(t) && /SUPUESTO/.test(t) && /DATO/.test(t), "y se dice qué es dato, qué modelo y qué supuesto");
ok(/C220/.test(t), "el más negociado es C220, que es el de más prima");
ok(/Once llamadas por análisis/.test(t) && /para toda la cuenta/.test(t),
  "y el pie dice cuántas llamadas cuesta y por qué las velas no van por moomoo");
ok(!/Faltan fichas/.test(t), "no falta ninguna ficha con un puente al día");

console.log("\n=== v4.94: valoración ===");
ok(/\$72\.4B/.test(t), "capitalización en B, como la lee en moomoo ($72.4B)");
ok(/28\.4/.test(t), "PER: se usa el TTM (28,4) cuando lo hay, no el anual");
ok(/1\.25%/.test(t), "dividendo TTM 1,25%");
/* el precio de prueba (200) sobre el rango 95-230: (200−95)/(230−95) = 77,8% -> 78% */
const rango = (t.match(/ahora, al (\d+)% del rango/) || [])[1];
console.log("  posición en el rango de 52 semanas:", rango + "% · a mano: 78%");
ok(rango === "78", "y la posición en el rango de 52 semanas sale al 78%");

console.log("\n=== v4.94: niveles ===");
const resis = (t.match(/RESISTENCIAS\s*\n[^\n]*\n[^\n]*/i) || [])[0];
const sopor = (t.match(/SOPORTES\s*\n[^\n]*\n[^\n]*/i) || [])[0];
console.log("  primera resistencia:", (resis || "—").replace(/\n/g, " "));
console.log("  primer soporte:     ", (sopor || "—").replace(/\n/g, " "));
ok(/RESISTENCIAS\s*\n\$230\s*\n\+15\.0% · 5 toques/i.test(t), "resistencia $230 con SUS 5 toques (las cinco veces que la onda llega arriba)");
ok(/SOPORTES\s*\n\$150\s*\n-25\.0% · 5 toques/i.test(t), "soporte $150 con sus 5 toques");
ok(/EMA 21/.test(t) && /EMA 50/.test(t) && /EMA 200/.test(t), "las medias 21, 50 y 200 — la 21 es la de su sistema, no la 20 del manual");
ok(!/EMA 20\b/.test(t), "y no queda ninguna EMA 20 suelta que contradiga a la otra pantalla");
ok(/52 semanas: \$/.test(t), "y el rango de 52 semanas");
ok(!/RETROCESOS/i.test(t) && !/61\.8%/.test(t),
  "NO se dibuja ningún Fibonacci: sus niveles los calcula el detector del servidor y aproximarlos es peor que no tenerlos");
ok(/Niveles de tu detector: no disponibles/.test(t), "y el hueco se dice, en vez de dejarlo mudo");
ok(/Sobre velas diarias de Stooq, que NO gastan cupo/.test(t),
  "la ficha dice la fuente REAL de las velas (aquí Stooq), no 'Yahoo' escrito a fuego");
ok(!/velas diarias de Yahoo/.test(t), "y no queda ningún 'Yahoo' cableado en el texto");
ok(/no son los de tu detector/.test(t), "avisando de que los soportes de la app NO son los del detector");
const grafico = await page.evaluate(() => {
  const s = Array.from(document.querySelectorAll("svg")).find((x) => (x.getAttribute("aria-label") || "") === "Precio con sus niveles");
  if (!s) return null;
  return { lineas: s.querySelectorAll("polyline").length, niveles: s.querySelectorAll("line").length };
});
console.log("  gráfico:", grafico);
ok(!!grafico && grafico.lineas === 4, "el gráfico dibuja precio + TRES medias (21, 50 y 200)");
ok(!!grafico && grafico.niveles >= 6, "y al menos seis líneas horizontales: soportes, resistencias y los cuatro muros ("
  + (grafico ? grafico.niveles : 0) + ")");

console.log("\n=== v4.94: de dónde viene el dinero ===");
ok(/\+\$4M/.test(t), "neto de órdenes grandes +$4M (2+5 entran, 1+2 salen)");
ok(/−\$2M/.test(t), "neto de órdenes pequeñas −$2M");
ok(/Neto de la sesión: \+\$1\.5M/.test(t), "neto de la sesión +$1.5M");
ok(/las órdenes grandes compran mientras las pequeñas venden/.test(t), "y se lee la divergencia en una frase");
ok(/no dice quién fue el agresor|no se sabe quién fue el agresor|sin decir quién fue el agresor/.test(t),
  "con el aviso de siempre: no dice quién fue el agresor");
console.log("\n=== v4.97: ROI ===");
const fila = (re) => (t.match(re) || [""])[0];
console.log("  " + fila(/P190[^\n]*/));
const dteRoi = parseInt((t.match(/P190[\s\S]{0,60}?(\d+)d ·/) || [])[1] || "0", 10);
console.log("  plazo que usa la app: " + dteRoi + " días");
ok(/P190/.test(t) && /delta [-−]0\.30/.test(t),
  "elige la P190: delta −0,30, la más cercana al objetivo dentro de [−0,36, −0,18]");
ok(dteRoi >= 30 && dteRoi <= 45, "y un vencimiento DENTRO de su rango de 30 a 45 días");
ok(!/Ningún vencimiento cae entre 30 y 45/.test(t), "así que no hace falta el aviso de que se salió del rango");
ok(/2\.1%/.test(t), "ROI al bid 2,1% = 3,90 / (190 − 3,90), sobre el capital que bloqueas");
ok(new RegExp("\\b" + roiAnualDe(dteRoi) + "%").test(t),
  "ROI anualizado " + roiAnualDe(dteRoi) + "% = 2,0956 × 365/" + dteRoi);
ok(/\$186\.1/.test(t), "punto de equilibrio $186,10 = strike menos la prima");
ok(/horquilla[^\n]*5%/.test(t), "y la horquilla, 5%");
const emEsperado = ((200 - 190) / emDe(dteRoi)).toFixed(2);
const em = fila(/El strike está a [\d.]+ movimientos esperados/);
console.log("  " + em + " · a mano: " + emEsperado);
ok(new RegExp("El strike está a " + emEsperado + " movimientos esperados").test(t),
  "el strike está a " + emEsperado + " movimientos esperados: por debajo de 1, o sea JUSTO");
ok(/Justo: un movimiento normal se planta ahí/.test(t), "y se dice en palabras, no solo con un color");
ok(/zona NEUTRAL/.test(t), "IV/HV 1,10 se lee como NEUTRAL, no como caro (su regla: 0,90-1,15 no penaliza)");
ok(/nunca solo/.test(t), "y se recuerda leerlo con el IV rank al lado");

console.log("\n=== v4.97: flujo por horizontes ===");
/* la etiqueta de cada voto y su valor son dos trozos distintos de la fila, así que en el texto de
   la pantalla van separados por un salto de línea. Se aplana para poder leerlos juntos. */
const plano = t.replace(/\n+/g, " ");
["Corto", "Medio", "Largo"].forEach((h) => ok(new RegExp(h + "\\s").test(t), "sale el horizonte " + h));
ok(/ALCISTA\s+\+3/.test(t) && /P\/C de volumen 0\.20/.test(plano), "corto: ALCISTA +3 con P/C 0,20 — más calls, más prima, y sin aperturas (voto 0)");
ok(/NEUTRAL\s+\+0/.test(t) && /P\/C de volumen 1\.17/.test(plano), "medio: NEUTRAL 0 con P/C 1,17 — ninguna de las cuatro señales se decanta");
ok(/BAJISTA\s+−4/.test(t) && /P\/C de volumen 30\.00/.test(plano), "largo: BAJISTA −4 con P/C 30 — las cuatro señales a la vez");
ok(/APERTURA/.test(t), "y se marcan las APERTURAS (volumen 300 sobre 100 de interés abierto = 3×)");
/* el voto de la prima dice cuántas VECES es mayor un lado, que es lo que explica el voto:
   corto 700k/112k = 6,3× calls · largo 1,68M/70k = 24× puts. Los importes van en las barras. */
ok(/6\.3× calls/.test(plano), "el voto de la prima dice 6,3× calls en el corto, no repite los dos importes");
ok(/24\.0× puts/.test(plano), "y 24× puts en el largo");
ok(/calls[\s\S]{0,40}\$700k/.test(plano) && /puts[\s\S]{0,40}\$112k/.test(plano),
  "y los importes van dibujados en barras a la misma escala, debajo");
ok(/no se sabe quién fue el agresor/.test(t), "con el aviso de que no se sabe quién fue el agresor");
ok(/sesión de HOY[^\n]*cierre de AYER/.test(t), "y el de la mezcla temporal, que es lo que hace dudosa una apertura");

console.log("\n=== v4.98: los tres dibujos nuevos ===");
const svgs = await page.evaluate(() => Array.from(document.querySelectorAll("svg"))
  .map((x) => ({ etiqueta: x.getAttribute("aria-label") || "", rects: x.querySelectorAll("rect").length,
                 lineas: x.querySelectorAll("line").length })));
const mariposa = svgs.find((x) => /Volumen de hoy sobre interés abierto/.test(x.etiqueta));
console.log("  mariposa:", mariposa || "no está");
ok(!!mariposa, "la mariposa de volumen sobre interés abierto se dibuja");
/* cuatro rectángulos por fila: la sombra del OI y el sólido del volumen, de cada lado */
ok(!!mariposa && mariposa.rects >= 7 * 4,
  "con las DOS capas de cada lado: sombra del interés abierto y sólido del volumen (" + (mariposa ? mariposa.rects : 0) + " barras)");
ok(!!mariposa && mariposa.lineas >= 1, "y la línea del precio cruzada por su sitio entre los strikes");
ok(/el bloque sólido es el volumen de HOY, la sombra el interés abierto del cierre de AYER/.test(t),
  "diciendo qué es cada capa: mezclarlas sin decirlo es lo que fabrica muros que no existen");

/* las referencias externas: precio, Morningstar y consenso en la MISMA escala */
ok(/Precio ahora/.test(t) && /Morningstar/.test(t) && /Consenso Wall St/.test(t),
  "las tres referencias en la misma escala");
/* Morningstar 120 sobre un precio de 200 son −40%; el consenso 165, −18% */
ok(/−40%/.test(t), "Morningstar $120 contra un precio de $200 sale como −40%, calculado a mano");
ok(/−18%/.test(t), "y el consenso $165, como −18%");

/* los múltiplos, con su color contra su PROPIA historia */
ok(/14x/.test(t) && /hist 5–22 \(med 9\)/.test(t),
  "EV/EBITDA 14x con su rango histórico debajo: 5–22, mediana 9");
/* la ficha de prueba NO trae `fcf_yield_pct` a propósito: solo el histórico con su `actual`.
   Antes eso salía como "0%" y pintado de rojo — un dato que falta valiendo cero, que además es
   el número más llamativo que se puede enseñar. */
ok(/3\.1%/.test(t) && /hist 1\.2–8\.4 \(med 4\.5\)/.test(t),
  "la caja sobre precio sale del histórico cuando no viene suelta: 3,1%, no 0%");
ok(!/>0%</.test(t.replace(/\n/g, ">")), "y ningún múltiplo se pinta como 0% por faltar");
ok((t.match(/dónde cae hoy/g) || []).length === 0,
  "y el rango no se repite dos veces: lo dice la ficha con su color, y ya");
ok(/barato contra\s+su PROPIA historia/.test(plano) || /barato contra su PROPIA historia/.test(plano),
  "con la leyenda de que el verde y el rojo son contra SU historia, no contra otras empresas");

console.log("\n=== v4.97: gráfico y muros ===");
ok(/Diario · 9 meses/.test(t) && /Semanal · 3 años/.test(t), "las dos pestañas del gráfico");
ok(/EMA 200/.test(t), "y la EMA 200, que faltaba");
const mur = (t.match(/MUROS CALL[\s\S]{0,80}/i) || [""])[0];
console.log("  " + mur.replace(/\n/g, " "));
ok(/muros call/i.test(t) && /muros put/i.test(t), "las dos fichas de muros");
ok((t.match(/▌/g) || []).length >= 4, "y CUATRO muros dibujados: dos por lado (" + (t.match(/▌/g) || []).length + ")");
ok(/muros de gamma a trazo continuo/.test(t), "dibujados sobre las velas y distinguidos de los soportes");

console.log("\n=== v4.97: Valora profunda ===");
ok(/Ficha profunda/.test(t), "la ficha profunda se pinta");
ok(/2026\/Q3/.test(t) && /son un año/i.test(t),
  "por TRIMESTRES, y se dice cuánto tiempo son de verdad cuatro periodos: un año, bien escrito");
ok(/deuda\/EBITDA/.test(t) && /2/.test(t), "deuda neta, EBITDA y su cociente");
ok(/EV \/ EBITDA/.test(t) && /med 9/.test(t),
  "EV/EBITDA contra su propio histórico: 14 con la mediana en 9 — sin eso, un múltiplo no dice nada");
ok(/según morningstar/i.test(t) && /\$120/.test(t), "Morningstar con su nombre encima, como dato de terceros");
ok(/consenso de analistas · 34/i.test(t) && /\$165/.test(t) && /62% comprar/.test(t), "el consenso con su reparto");
ok(/Institucional/.test(t) && /61\.2%/.test(t) && /smart money/.test(t), "y el accionariado");
ok(!/383/.test(t) && !/275/.test(t),
  "el DCF NO se pinta aunque venga dentro de la ficha: ni el base ni la tabla de sensibilidad");
ok(/No se enseña a propósito/.test(t) || /no se enseña a propósito/i.test(t),
  "y se dice que no se enseña a propósito, en vez de callarlo");

ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));

/* ---- v4.95: el ΔOI necesita DOS días, que es justo donde puede fallar ----
   Primero se comprueba que la primera vez lo dice en vez de callarse. Luego, en una sesión nueva,
   se siembra a mano la foto de AYER y se mira si el cambio sale bien y si el filtro descarta lo que
   no se movió lo bastante. Los números, a mano:
     C220: ayer 6.000 -> hoy 9.000  = +3.000 abiertos   (pasa: más de 500)
     P180: ayer 9.000 -> hoy 8.000  = −1.000 cerrados   (pasa)
     C210: ayer 1.150 -> hoy 1.200  = +50               (NO pasa: ni 500 ni el 25%)
     P170: ayer   600 -> hoy   700  = +100 pero es el 16,7%... tampoco pasa
     C170: ayer   150 -> hoy   200  = +50 y es el 33%   (SÍ pasa, por porcentaje) */
console.log("\n=== v4.95: qué se abrió y qué se cerró ===");
ok(/Primera foto guardada/.test(t), "la primera vez lo dice: no hay con qué comparar todavía");

const AYER = (() => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); })();
const ctx3 = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
await montaPuente(ctx3, false);
const p3 = await ctx3.newPage();
const errores3 = [];
p3.on("pageerror", (e) => errores3.push(e.message));
await p3.addInitScript(([ayer, vto, foto]) => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "40000", margin: "20000" } }));
  localStorage.setItem("bloques_dark_override", "dark");
  localStorage.setItem("bloques_view_v1", "comparador");
  localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  localStorage.setItem("bloques_oi_v1", JSON.stringify({ ["TEST|" + vto]: { [ayer]: foto } }));
}, [AYER, VTO, {
  [cod(220, "C", VTO)]: { k: 220, c: 1, oi: 6000 },
  [cod(180, "P", VTO)]: { k: 180, c: 0, oi: 9000 },
  [cod(210, "C", VTO)]: { k: 210, c: 1, oi: 1150 },
  [cod(170, "P", VTO)]: { k: 170, c: 0, oi: 600 },
  [cod(170, "C", VTO)]: { k: 170, c: 1, oi: 150 },
}]);
await p3.goto(URL_APP, { waitUntil: "load" });
await p3.waitForTimeout(2400);
await p3.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
await p3.waitForTimeout(300);
await p3.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Análisis"); if (b) b.click(); });
await p3.waitForTimeout(500);
await p3.locator("label", { hasText: "Ticker" }).locator("input").first().fill("TEST");
await p3.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Analizar/.test(x.textContent || "")); if (b) b.click(); });
await p3.waitForTimeout(2000);
const t3 = await p3.evaluate(() => document.body.innerText);
const cajaOi = await p3.evaluate(() => {
  const f = Array.from(document.querySelectorAll("div")).filter((x) => (x.textContent || "").indexOf("Qué se abrió") === 0);
  const d = f.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length).pop();
  if (d) d.scrollIntoView({ block: "center" });
  const c = d && d.closest("div"); if (!c) return null;
  const b = c.getBoundingClientRect();
  return { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: b.width + 12, height: Math.min(b.height + 12, 700) };
});
if (cajaOi) { await p3.waitForTimeout(300); await p3.screenshot({ path: D + "/analisis-oi-delta.png", clip: cajaOi }); }
console.log("  filas:", (t3.match(/[CP]\d+ · de [\d,]+ a [\d,]+/g) || []).join(" | ") || "ninguna");
ok(/C220 · de 6,000 a 9,000/.test(t3) && /\+3,000 abiertos/.test(t3), "C220: +3.000 contratos ABIERTOS desde la foto de ayer");
ok(/P180 · de 9,000 a 8,000/.test(t3) && /−1,000 cerrados/.test(t3), "P180: 1.000 CERRADOS");
ok(!/C210 · de/.test(t3), "C210 (+50 sobre 1.150) NO sale: no llega ni a 500 contratos ni al 25%");
ok(!/P170 · de/.test(t3), "P170 (+100 sobre 600, un 16,7%) tampoco");
ok(/C170 · de 150 a 200/.test(t3), "pero C170 SÍ sale: son 50 contratos, y es un tercio de lo que había");
/* la fecha de la foto anterior tiene que ir ESCRITA. Decir "ayer" sería mentira en cuanto pasen
   dos días sin abrir el ticker, así que se comprueba que sale la fecha de verdad — y que además
   se avisa de que no tiene por qué ser ayer. */
const frase = (t3.match(/Comparado con la foto del[^\n]*/) || [""])[0];
console.log("  frase:", frase);
ok(/Comparado con la foto del \w{3} \d{1,2} '\d{2}/.test(frase), "sale la FECHA de la foto anterior, escrita");
ok(/no necesariamente ayer/.test(t3), "y se avisa de que no tiene por qué ser de ayer");
ok(!errores3.length, "sin errores de JS en la segunda sesión " + JSON.stringify(errores3.slice(0, 2)));
await ctx3.close();

/* sin servidor NO debe existir la pestaña */
const ctx2 = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
await ctx2.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: 100, dp: 0, pc: 100, h: 100 }) }));
const p2 = await ctx2.newPage();
await p2.addInitScript(() => {
  localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
  localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "40000", margin: "20000" } }));
  localStorage.setItem("bloques_view_v1", "comparador");
  localStorage.removeItem("bloques_puente_v1");
});
await p2.goto(URL_APP, { waitUntil: "load" });
await p2.waitForTimeout(2200);
const sinServidor = await p2.evaluate(() => document.body.innerText);
console.log("");
ok(!/Análisis/.test(sinServidor), "SIN servidor la pestaña no existe (tus amigos ven las de siempre)");

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos + " comprobaciones" : "\nOK");
process.exit(fallos ? 1 : 0);
