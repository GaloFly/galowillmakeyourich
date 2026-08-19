/* ---------------------------------------------------------------------------
   ANÁLISIS: QUE NADA SE SALGA DE LA PANTALLA

   Victor, con MRVL de verdad: *"está descuadrado"*. La pestaña entera salía cortada por la derecha
   —los textos, las fichas y hasta las etiquetas del gráfico—, que es el síntoma de UN elemento más
   ancho que el móvil: empuja la página y todo lo demás se sale con él.

   La prueba de cálculo (analisis.mjs) no lo cazó, y por un motivo que merece quedar escrito: sus
   datos son BONITOS. Strikes de 170 a 230 de diez en diez, precios de un dígito, cifras cortas.
   Los de verdad no: precios de tres cifras con dos decimales, treinta y tantos strikes, primas de
   dos dígitos, capitalizaciones de nueve. Un ancho se desborda por los CARACTERES, no por la lógica.

   Así que esta prueba tiene los datos feos —los de la captura de Victor— y no comprueba ni un
   número: solo mide. Y mide en 320, 375 y 390 px, porque cabiendo en la más estrecha cabe en todas.

     node pruebas/analisis-ancho.mjs
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
const PUERTO = 8323;
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

/* ---------- los datos FEOS, con la forma de la captura de Victor ---------- */
const SPOT = 215.73;
const dentroDe = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const VTOS = [3, 10, 17, 31, 38, 45, 59, 66, 87].map(dentroDe);   /* nueve vencimientos, como un nombre líquido */
const STRIKES = [];
for (let k = 150; k <= 300; k += 5) STRIKES.push(k);              /* 31 strikes, no 7 */

const cod = (k, lado, v) => "US.MRVL" + v.slice(2).replace(/-/g, "") + lado + k * 1000;
const contratos = [];
VTOS.forEach((v) => STRIKES.forEach((k) => {
  contratos.push({ codigo: cod(k, "C", v), tipo: "CALL", strike: k, vencimiento: v });
  contratos.push({ codigo: cod(k, "P", v), tipo: "PUT", strike: k, vencimiento: v });
}));
const opciones = {};
contratos.forEach((c) => {
  const esCall = c.tipo === "CALL";
  const lejos = Math.abs(c.strike - SPOT) / SPOT;
  const px = Math.max(0.35, 24.75 * Math.exp(-8 * lejos));        /* primas de dos dígitos cerca del dinero */
  opciones[c.codigo] = {
    codigo: c.codigo, ultimo: px, medio: px, bid: px - 0.48, ask: px + 0.48,
    volumen: Math.round(1850 * Math.exp(-6 * lejos)) + 7,
    interes_abierto: Math.round(12478 * Math.exp(-4 * lejos)) + 96,
    iv: 83.7, delta: esCall ? 0.4123 : -(0.5 - (SPOT - c.strike) / SPOT * 1.6),
    gamma: 0.0141, theta: -0.1837, vega: 0.2456, fecha_dato: "2026-08-18 18:10:00",
  };
});
/* velas con recorrido de verdad: de 61,44 a 329,88 en un año, que es lo que hace las etiquetas largas */
const VELAS = [];
{
  const inicio = Date.parse("2023-08-20T00:00:00Z");
  for (let i = 0; i < 1254; i++) {
    const t = i / 1253;
    const c = 61.44 + (329.88 - 61.44) * Math.pow(t, 3.2) * (0.86 + 0.14 * Math.sin(i / 9));
    VELAS.push({ f: new Date(inicio + i * 86400000).toISOString().slice(0, 10),
                 o: c, h: c * 1.021, l: c * 0.979, c, v: 9500000 });
  }
}
const VALORACION = { codigo: "US.MRVL", nombre: "Marvell Technology Inc", fundamentales_validos: true,
  capitalizacion: 189165547368, per: 74.23, per_ttm: 74.23, p_vc: 10.38, bpa: 3.07,
  valor_contable_accion: 20.7767, dividendo_ttm_pct: 0.1112, rotacion: 1.2345,
  max_52s: 329.88, min_52s: 61.44 };
const DINERO = { codigo: "US.MRVL",
  entra: { muy_grande: 28500000, grande: 60800000, media: 55950000, pequena: 105550000 },
  sale:  { muy_grande: 30260000, grande: 74590000, media: 73260000, pequena: 119780000 } };
const FICHA = {
  ticker: "MRVL", generado: "2026-08-19T02:00", precio: 215.665,
  financiero: { periodos: ["2026/Q3", "2026/Q2", "2026/Q1", "2025/Q4", "2025/Q3", "2025/Q2"],
                revenue: [2318000000, 2145000000, 1987000000, 1817000000, 1516000000, 1272000000],
                net_income: [672200000, 611400000, 559800000, 498300000, 402100000, 318700000],
                fcf: [2318000000, 2145000000, 1987000000, 1817000000, 1516000000, 1272000000],
                margen_neto_pct: 29.0432, margen_fcf_pct: 19.1276 },
  balance: { caja: 1284000000, deuda_total: 2718000000, deuda_neta: 1434000000,
             equity: 14872000000, ebitda_ttm: 2711000000 },
  multiplos: { market_cap: 188900000000, ev: 190334000000, ev_ebitda: 70.2145, pe: 74.2312, ps: 21.8,
               fcf_yield_pct: 0.9123, net_debt_ebitda: 0.5289,
               hist_ev_ebitda: { actual: 70.2145, min: 28.0412, max: 66.7238, mediana: 33.3129, n: 20 },
               hist_fcf_yield: { actual: 0.9123, min: 0.9123, max: 2.8471, mediana: 2.0134, n: 20 } },
  valoracion: { morningstar_fair_value: 235.0, moat: "Narrow", incertidumbre: "High",
                consenso_analistas: { medio: 276.4123, alto: 400.0, bajo: 195.0, n: 27,
                                      buy_pct: 85.185, hold_pct: 11.111, sell_pct: 3.704 },
                dcf_base: 383.17 },
  ownership: { instit_pct: 81.2345, instit_chg: -2.6512, instituciones: 2406, smart_money_m: -15.4123 },
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* UNA VENTANA NUEVA POR CADA ANCHO, y no `setViewportSize` sobre la misma.
   La app reancla el <meta viewport> al arrancar (el des-zoom de iOS), así que cambiarle el tamaño
   a una página ya cargada no reordena nada: la primera versión de esta prueba medía tres veces lo
   mismo y daba los tres anchos idénticos, 458 px en los tres. */
const probar = async (ancho) => {
  /* `screen` tiene que coincidir con la ventana. La app lleva un des-zoom que compara el ancho del
     lienzo con el de la PANTALLA física y, si no cuadran, ancla el <meta viewport> a la pantalla
     — en Playwright, por defecto, no cuadran, así que la primera versión de esta prueba medía una
     página anclada a un ancho que no era el de la ventana, y daba los tres tamaños idénticos. */
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: ancho, height: 900 },
                                         screen: { width: ancho, height: 900 },
                                         deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route(/finnhub\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: SPOT, dp: 0, pc: SPOT, h: SPOT }) }));
  await ctx.route(/puente\.alphavext\.com/, (route) => {
    const u = new URL(route.request().url());
    const J = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/cotiza") return J({ ok: true, cotizaciones: { "US.MRVL": { ultimo: SPOT, cierre_anterior: 211.4 } } });
    if (u.pathname === "/subyacente") return J({ ok: true, subyacente: { codigo: "US.MRVL", nombre: "Marvell Technology Inc", iv: 83.7123, hv_30d: 89.7412, iv_rank: 57.234 } });
    if (u.pathname === "/cadena") {
      const dias = Math.round((Date.parse(u.searchParams.get("hasta")) - Date.parse(u.searchParams.get("desde"))) / 86400000);
      if (dias > 90) return route.fulfill({ status: 400, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "El rango es demasiado largo: como mucho 90 días." }) });
      const dentro = VTOS.filter((v) => v <= u.searchParams.get("hasta"));
      return J({ ok: true, contratos: contratos.filter((c) => dentro.includes(c.vencimiento)), total: contratos.length, vencimientos: dentro });
    }
    if (u.pathname === "/opciones") return J({ ok: true, opciones, pedidos: 0, de_cache: 0, sin_datos: [] });
    if (u.pathname === "/velas") return J({ ok: true, simbolo: "MRVL", velas: VELAS, total: VELAS.length, fuente: "Yahoo Finance" });
    if (u.pathname === "/valoracion") return J({ ok: true, valoracion: VALORACION });
    if (u.pathname === "/dinero") return J({ ok: true, dinero: DINERO, columnas: [] });
    if (u.pathname === "/fundamentales") return J({ ok: true, codigo: "US.MRVL", ticker: "MRVL",
      generada: new Date(Date.now() - 5400000).toISOString(), edad_s: 5400, del_dia: true, ficha: FICHA });
    return J({ ok: true });
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "120000", margin: "46000" }, DEGIRO: { cash: "46018", margin: "0" } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_view_v1", "comparador");
    localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  });
  await page.goto(URL_APP, { waitUntil: "load" });
  await page.waitForTimeout(2400);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Análisis"); if (b) b.click(); });
  await page.waitForTimeout(500);
  await page.locator("label", { hasText: "Ticker" }).locator("input").first().fill("MRVL");
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Analizar/.test(x.textContent || "")); if (b) b.click(); });
  await page.waitForTimeout(2600);

  const m = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const malos = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right <= w + 1) return;
      /* las tiras que se deslizan a propósito (pestañas, chips de vencimiento) no cuentan */
      let p = el, enCarrusel = false;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const st = p === el ? null : getComputedStyle(p);
        if (st && (st.overflowX === "auto" || st.overflowX === "scroll")) { enCarrusel = true; break; }
      }
      if (enCarrusel) return;
      malos.push({ tag: el.tagName, ancho: Math.round(r.width), acaba: Math.round(r.right),
                   txt: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 46) });
    });
    /* OJO con `scrollWidth`: NO sirve para esto. Algo de la app recorta el desbordamiento, así que
       la página mide siempre lo que la pantalla mientras el contenido se sale igual — que es
       exactamente lo que veía Victor, y lo que hizo que la primera versión de esta prueba diera
       verde con 283 elementos fuera. Lo que vale es contar quién se pasa del borde. */
    return { pantalla: w, malos, errores: 0 };
  });
  await page.screenshot({ path: D + "/ancho-" + ancho + ".png", fullPage: true });
  /* y el gráfico aparte, recortado: es lo que Victor no podía leer */
  const cg = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll("svg")).find((x) => (x.getAttribute("aria-label") || "").indexOf("Precio con sus niveles") === 0);
    if (!s) return null;
    s.scrollIntoView({ block: "center" });
    const b = s.getBoundingClientRect();
    return { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.width + 16, height: b.height + 16 };
  });
  if (cg && cg.height > 20) { await page.waitForTimeout(300); await page.screenshot({ path: D + "/grafico-" + ancho + ".png", clip: cg }); }
  await ctx.close();
  return { ...m, errores };
};

console.log("=== con datos con la forma de los de verdad (MRVL) ===");
for (const ancho of [390, 375, 320]) {
  const m = await probar(ancho);
  console.log("\n  " + ancho + " px (lienzo real: " + m.pantalla + ")");
  m.malos.slice(0, 6).forEach((x) => console.log("     · " + x.tag + " ancho " + x.ancho + ", acaba en " + x.acaba + " | " + x.txt));
  if (m.malos.length > 6) console.log("     · … y " + (m.malos.length - 6) + " más");
  ok(m.malos.length === 0, ancho + " px: NADA se sale de la pantalla (" + m.malos.length + " elementos fuera)");
  ok(!m.errores.length, "  y sin errores de JS " + JSON.stringify(m.errores.slice(0, 2)));
}

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
