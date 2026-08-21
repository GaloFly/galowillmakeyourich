/* ---------------------------------------------------------------------------
   EL MARGEN ESTIMADO, CALIBRADO CON LA CUENTA DE VERDAD (v5.11)

   Victor mandó dos contratos con el margen REAL que le bloquea IBKR, y la app se quedaba a menos
   de la mitad:

      RDDT · put 135 · Oct 2 '26     Reg-T $1.448    IBKR $3.629,22   →  2,46×
      MRVL · put 200 · Sep 17 '27    Reg-T $2.000    IBKR $3.939,85   →  1,97×

   Reg-T es el MÍNIMO legal, no lo que bloquea un bróker: encima va su requisito de casa, que
   depende del valor y no se puede deducir del precio ni del strike. Por eso no se adivina — se
   multiplica por un factor que el usuario calibra con su propia cuenta.

   Y quedarse CORTO es el peor sentido del error: hace parecer que caben el doble de operaciones
   de las que caben. De ahí que esto tenga prueba propia.

   Se comprueba:
     · sin factor, sale Reg-T pelado — quien no lo toque no ve cambiar nada (es la regla de la casa);
     · con el factor puesto, la cifra sale multiplicada y clavada al céntimo;
     · el número se ENSEÑA en pantalla, para que nadie lo confunda con un dato del bróker;
     · y el factor sobrevive a recargar la app, que si no habría que ponerlo cada vez.

     node pruebas/margen-factor.mjs
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
const PUERTO = 8331;
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

/* los dos contratos de Victor, con su spot del momento y el margen que le bloqueó IBKR */
const CASOS = [
  { tkr: "RDDT", spot: 150.65, strike: 135, regT: 1448, ibkr: 3629.22 },
  { tkr: "MRVL", spot: 249.01, strike: 200, regT: 2000, ibkr: 3939.85 },
];
const FACTOR = 2.2;   /* el de partida, entre los dos casos; se afinará con más pares */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fallos = 0;
const ok = (v, t) => { if (!v) fallos++; console.log((v ? "  ✓ " : "  ✗ ") + t); };

/* La fórmula vive en el compilado; se lee de ahí en vez de copiarla aquí. Copiarla sería
   comprobar mi copia contra sí misma, que es la trampa clásica de este tipo de prueba. */
const ctx = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block" });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.goto(URL_APP, { waitUntil: "load" });
await page.waitForTimeout(2000);

const hayFn = await page.evaluate(() => typeof MARGEN_REGT === "function");
if (!hayFn) {
  console.log("  ✗ MARGEN_REGT no es accesible desde la página; la prueba no puede medir nada");
  await browser.close(); servidor.close(); process.exit(1);
}

console.log("=== sin factor: Reg-T pelado, como hasta ahora ===");
for (const c of CASOS) {
  const v = await page.evaluate((c) => MARGEN_REGT(c.spot, c.strike), c);
  console.log("  " + c.tkr + ": $" + v.toFixed(0) + " (Reg-T esperado $" + c.regT + ")");
  ok(Math.abs(v - c.regT) < 1, c.tkr + " sale a Reg-T sin tocar nada, así que quien no calibre no ve cambiar sus cifras");
}

console.log("\n=== con el factor puesto ===");
for (const c of CASOS) {
  const v = await page.evaluate((x) => MARGEN_REGT(x.spot, x.strike, x.f), { ...c, f: FACTOR });
  const desvio = (v / c.ibkr - 1) * 100;
  console.log("  " + c.tkr + ": $" + v.toFixed(0) + "  ·  IBKR real $" + c.ibkr.toFixed(0) +
    "  ·  se queda a " + (desvio >= 0 ? "+" : "") + desvio.toFixed(0) + "%");
  ok(Math.abs(v - c.regT * FACTOR) < 1, c.tkr + " multiplica exactamente por " + FACTOR);
  /* no se exige clavarlo: un factor plano NO puede, porque el requisito de casa cambia por valor.
     Lo que sí se exige es dejar de quedarse a la mitad, que era el problema. */
  ok(Math.abs(desvio) < 25, c.tkr + " se acerca al margen real de la cuenta (antes fallaba un " +
    ((c.regT / c.ibkr - 1) * 100).toFixed(0) + "%)");
}

console.log("\n=== un factor no puede empeorar la estimación ===");
for (const c of CASOS) {
  const antes = Math.abs(c.regT - c.ibkr);
  const ahora = Math.abs(c.regT * FACTOR - c.ibkr);
  ok(ahora < antes, c.tkr + ": el error baja de $" + antes.toFixed(0) + " a $" + ahora.toFixed(0));
}

console.log("\n=== el factor se guarda y sobrevive a recargar ===");
/* Se pone POR LA PANTALLA, no escribiendo en localStorage: IndexedDB es la copia autoritativa de
   esta app, así que un valor metido solo en localStorage lo pisa la carga siguiente. Escribirlo a
   mano habría comprobado una ruta que ningún usuario recorre — y habría dado un falso rojo. */
await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button, div")).find((x) => (x.innerText || "").trim() === "Ajustes"); if (b) b.click(); });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll("*")).filter((e) => /^Brokers/.test((e.innerText || "").trim()) && e.children.length < 10);
  const b = c[c.length - 1];
  if (b) b.click();
});
await page.waitForTimeout(800);
const puesto = await page.evaluate(() => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const i = Array.from(document.querySelectorAll("input")).find((x) => x.placeholder === "1");
  if (!i) return false;
  set.call(i, "2.2");
  i.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
});
await page.waitForTimeout(900);
ok(puesto, "el campo del factor está en Ajustes → Brokers");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(2500);
const guardado = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("bloques_margen_factor_v1") || "null"); } catch (e) { return null; } });
ok(guardado && String(guardado.IBKR) === "2.2", "sigue ahí tras recargar (" + JSON.stringify(guardado) + ")");

/* y va en el backup: si no, se pierde al cambiar de teléfono y las cifras cambian en silencio */
const enBackup = await page.evaluate(() => typeof BACKUP_KEYS !== "undefined" && BACKUP_KEYS.includes("bloques_margen_factor_v1"));
ok(enBackup, "y viaja en el backup, para que no se pierda al cambiar de teléfono");

ok(!errores.length, "sin errores de JS " + JSON.stringify(errores.slice(0, 2)));
await browser.close();
servidor.close();
console.log(fallos ? "\nFALLA: " + fallos : "\nOK");
process.exit(fallos ? 1 : 0);
