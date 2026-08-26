/* ---------------------------------------------------------------------------
   EL SPOT DE LA HERRAMIENTA DE EARNINGS (v5.14)

   Victor: *"no puede leer el spot en herramientas earnings"* — y en la captura, dos cosas:

     1. «No pude leer el precio: HTTP 429». Es el tope del plan gratis de Finnhub (60 consultas por
        minuto). Ni es una avería ni hay nada que arreglar: se pasa esperando. Pero "HTTP 429" no le
        dice eso a nadie.
     2. Y lo grave: el TICKER decía NVDA y el campo SPOT ponía **32,45** — el precio del ticker
        anterior, que se quedó ahí al fallar la lectura. De ese número cuelgan el movimiento
        esperado, las probabilidades y los strikes, así que toda la tarjeta estaba calculando sobre
        el precio de otra empresa, con toda la pinta de estar bien.

   Y por debajo, algo que ya no tenía sentido: Victor tiene OpenD en su VPS dando precios sin tope
   de nadie, y esta herramienta iba directa a Finnhub porque nació antes que el puente.

   Se comprueba, en este orden:
     · con servidor propio, el precio se le pide a ÉL y Finnhub no se toca;
     · sin servidor y con 429, el mensaje explica qué pasa y qué hacer;
     · un spot que no es del ticker en pantalla se BORRA al fallar la lectura, y mientras siga
       habiendo uno de otro valor, se avisa en rojo.

     node pruebas/earnings-spot.mjs
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
const PUERTO = 8337;
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
let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* NVDA vale 182,50 de verdad; 32,45 es el número de la captura de Victor, el del ticker anterior */
const NVDA = 182.5, VIEJO = 32.45;

const montar = async ({ conPuente, finnhub429 }) => {
  const c = await browser.newContext({ ...devices["iPhone 13"], screen: { width: 390, height: 844 }, serviceWorkers: "block" });
  const llamadas = { finnhub: 0, puente: 0 };
  await c.route(/finnhub\.io/, (r) => {
    llamadas.finnhub++;
    if (finnhub429) return r.fulfill({ status: 429, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ c: NVDA, pc: NVDA, dp: 0, h: NVDA, l: NVDA }) });
  });
  await c.route(/puente\.alphavext\.com/, (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/cotiza") {
      llamadas.puente++;
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, cotizaciones: { "US.NVDA": { ultimo: NVDA, cierre_anterior: NVDA } } }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript((cfg) => {
    localStorage.setItem("bloques_pos_v5", JSON.stringify([]));
    localStorage.setItem("bloques_acc_v5", JSON.stringify({ IBKR: { cash: "50000", margin: "20000" } }));
    localStorage.setItem("bloques_dark_override", "dark");
    localStorage.setItem("bloques_finnhub_key", "clave-de-prueba");
    if (cfg) localStorage.setItem("bloques_puente_v1", JSON.stringify({ url: "https://puente.alphavext.com", token: "clave" }));
  }, conPuente);
  await p.goto(URL_APP, { waitUntil: "load" });
  await p.waitForTimeout(2400);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((e) => (e.textContent || "").trim() === "Todo OK"); if (b) b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Herramientas"); if (b) b.click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Earnings"); if (b) b.click(); });
  await p.waitForTimeout(800);
  return { c, p, errs, llamadas };
};

/* rellena TICKER y SPOT y pulsa "Obtener spot" */
const pedirSpot = async (p, tkr, spotPrevio) => {
  await p.evaluate((v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const pon = (re, val) => {
      const i = Array.from(document.querySelectorAll("input")).find((x) => { const l = x.closest("label"); return l && re.test(l.innerText || ""); });
      if (i) { set.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); }
    };
    pon(/^ticker/i, v.tkr);
    if (v.spot != null) pon(/^spot/i, String(v.spot));
  }, { tkr, spot: spotPrevio });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Obtener spot|Leyendo/.test(x.innerText || "")); if (b) b.click(); });
  await p.waitForTimeout(1600);
  return p.evaluate(() => {
    const i = Array.from(document.querySelectorAll("input")).find((x) => { const l = x.closest("label"); return l && /^spot/i.test(l.innerText || ""); });
    return { spot: i ? i.value : null, texto: document.body.innerText };
  });
};

console.log("=== con servidor propio: el precio se le pide a ÉL ===");
{
  const { c, p, errs, llamadas } = await montar({ conPuente: true, finnhub429: true });
  const r = await pedirSpot(p, "NVDA", VIEJO);
  console.log("  spot: " + r.spot + "  ·  llamadas → puente " + llamadas.puente + ", finnhub " + llamadas.finnhub);
  ok(Number(r.spot) === NVDA, "lee el precio de verdad (" + r.spot + ") aunque Finnhub esté al tope");
  ok(llamadas.puente >= 1, "y se lo pregunta al servidor propio (" + llamadas.puente + " llamadas)");
  ok(!/No pude leer el precio/.test(r.texto), "sin ningún error en pantalla");
  ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
  await c.close();
}

console.log("\n=== sin servidor y con Finnhub al tope: se explica qué pasa ===");
{
  const { c, p, errs } = await montar({ conPuente: false, finnhub429: true });
  const r = await pedirSpot(p, "NVDA", VIEJO);
  const aviso = (r.texto.match(/No pude leer el precio[^\n]*/) || [""])[0];
  console.log("  " + aviso);
  ok(/minuto/.test(aviso), "el mensaje dice que es un tope POR MINUTO y que se pasa esperando");
  ok(!/^No pude leer el precio: HTTP 429$/.test(aviso), "y ya no es un «HTTP 429» a secas");
  ok(/servidor propio/.test(aviso), "y apunta a la salida de verdad: montar el servidor propio");
  /* aquí el spot estaba ESCRITO A MANO, así que la app no sabe de quién es. No se le borra
     —escribirlo a mano es un uso legítimo y quitárselo a alguien sería peor— pero sí se avisa. */
  console.log("  spot tras fallar: " + JSON.stringify(r.spot));
  ok(Number(r.spot) === VIEJO, "un spot escrito a mano NO se borra (eso sería peor que el fallo)");
  ok(/no se ha comprobado que sea de NVDA/.test(aviso), "pero se avisa de que no se ha comprobado que sea de NVDA");
  ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
  await c.close();
}

console.log("\n=== y si SÍ se sabe que es de otro ticker, se borra ===");
{
  /* primero se lee bien NVDA (así la app sabe de quién es el spot), luego se pide TSLA con
     Finnhub caído: ese precio es de NVDA y no puede quedarse. Es la situación de la captura. */
  const { c, p, errs } = await montar({ conPuente: false, finnhub429: false });
  await pedirSpot(p, "NVDA", null);
  await p.route(/finnhub\.io/, (r) => r.fulfill({ status: 429, contentType: "application/json", body: "{}" }));
  const r = await pedirSpot(p, "TSLA", null);
  const aviso = (r.texto.match(/No pude leer el precio[^\n]*/) || [""])[0];
  console.log("  spot: " + JSON.stringify(r.spot));
  console.log("  " + aviso);
  ok(!r.spot || Number(r.spot) === 0, "el precio de NVDA se BORRA al pedir TSLA y fallar (era " + NVDA + ")");
  ok(/era de NVDA/.test(aviso), "y se dice que se ha borrado y de quién era");
  ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
  await c.close();
}

console.log("\n=== y si cambias de ticker sin volver a pedirlo, se avisa en rojo ===");
{
  const { c, p, errs } = await montar({ conPuente: false, finnhub429: false });
  await pedirSpot(p, "NVDA", null);            /* lee bien: el spot es de NVDA */
  const r = await p.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const i = Array.from(document.querySelectorAll("input")).find((x) => { const l = x.closest("label"); return l && /^ticker/i.test(l.innerText || ""); });
    if (i) { set.call(i, "TSLA"); i.dispatchEvent(new Event("input", { bubbles: true })); }
    return null;
  });
  await p.waitForTimeout(600);
  const texto = await p.evaluate(() => document.body.innerText);
  const linea = (texto.match(/Ese spot[^\n]*/) || [""])[0];
  console.log("  " + (linea || "(no avisa)"));
  ok(/Ese spot/.test(texto), "avisa de que el precio que hay no es del ticker en pantalla");
  ok(/NVDA/.test(linea) && /TSLA/.test(linea), "y dice de quién es y de quién debería ser");
  ok(!errs.length, "sin errores de JS " + JSON.stringify(errs.slice(0, 2)));
  await c.close();
}

await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
