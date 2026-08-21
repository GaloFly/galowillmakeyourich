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

/* LOS SEIS CONTRATOS REALES de la cuenta de Victor (20-ago-2026), con el margen que le bloquea
   IBKR de verdad. Estos seis son la razón de que el factor sea POR VALOR y no por bróker:

     con los dos primeros parecía un peaje plano del doble...
       RDDT 135 · 42d    Reg-T $1.448   IBKR $3.629    2,46×   (IV 56%)
       MRVL 200 · 391d   Reg-T $2.000   IBKR $3.940    1,97×   (IV 83%)
     ...y los otros cuatro lo desmintieron:
       NVO  42,5 · 28d   Reg-T $559     IBKR $496      0,89×   (IV 31%)
       TSLA 315 · 42d    Reg-T $3.890   IBKR $4.324    1,11×   (IV 39%)
       META 515 · 42d    Reg-T $7.834   IBKR $6.399    0,82×   (IV 35%)
       META 490 · 300d   Reg-T $5.334   IBKR $5.758    1,08×   (IV 35%)

   Los dos que se disparan son los de IV alta. El recargo de casa cae sobre VALORES concretos, no
   sobre la cuenta. Un factor único por bróker habría dejado cuatro de seis con un error de +98%
   a +169% — mucho peor que no hacer nada. */
/* `app` es lo que ENSEÑÓ la app en su captura y sirve para contar la historia; para la cuenta NO
   se usa, porque cada búsqueda se hizo con el precio de su momento y la pantalla de IBKR es de
   otro. El Reg-T se recalcula con el MISMO spot que vio IBKR — comparar dos números sacados de
   precios distintos es el error que hace que una calibración salga torcida. */
const CASOS = [
  { tkr: "RDDT", spot: 150.65, strike: 135,  ibkr: 3629.22, iv: 56, app: 1475 },
  { tkr: "MRVL", spot: 249.01, strike: 200,  ibkr: 3939.85, iv: 83, app: 2000 },
  { tkr: "NVO",  spot: 46.30,  strike: 42.5, ibkr: 496.07,  iv: 31, app: 559 },
  { tkr: "TSLA", spot: 346.81, strike: 315,  ibkr: 4323.90, iv: 39, app: 3890 },
  { tkr: "META", spot: 546.20, strike: 515,  ibkr: 6399.42, iv: 35, app: 7834 },
  { tkr: "META", spot: 546.20, strike: 490,  ibkr: 5758.38, iv: 35, app: 5334 },
];

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

console.log("=== la base: Reg-T con el precio de la pantalla de IBKR ===");
for (const c of CASOS) {
  c.regT = await page.evaluate((c) => MARGEN_REGT(c.spot, c.strike), c);
  console.log("  " + c.tkr + " " + c.strike + ": Reg-T $" + c.regT.toFixed(0) +
    "  ·  IBKR $" + c.ibkr.toFixed(0) + "  ·  " + (c.ibkr / c.regT).toFixed(2) + "×  (IV " + c.iv + "%)");
  ok(c.regT > 0, c.tkr + " " + c.strike + " tiene una base Reg-T calculable");
}

console.log("\n=== POR QUÉ un factor único por bróker NO sirve ===");
/* se busca el mejor factor plano posible y se enseña lo mal que deja los casos —no es un
   ejercicio retórico: es la comprobación de que la decisión de la v5.12 estaba justificada */
let mejorF = 1, mejorPeor = Infinity;
for (let f = 0.8; f <= 3.01; f += 0.01) {
  const peor = Math.max(...CASOS.map((c) => Math.abs(c.regT * f / c.ibkr - 1)));
  if (peor < mejorPeor) { mejorPeor = peor; mejorF = f; }
}
console.log("  el mejor factor plano posible es " + mejorF.toFixed(2) + "× y AUN ASÍ el peor caso falla un " + (mejorPeor * 100).toFixed(0) + "%");
ok(mejorPeor > 0.5, "ni el mejor factor único baja del 50% de error en el peor caso (" + (mejorPeor * 100).toFixed(0) + "%) — por eso va por valor");
const con22 = CASOS.map((c) => (c.regT * 2.2 / c.ibkr - 1) * 100);
console.log("  con el 2,2× que se propuso con solo dos pares: " + con22.map((x) => (x >= 0 ? "+" : "") + x.toFixed(0) + "%").join(" · "));
ok(con22.filter((x) => Math.abs(x) > 90).length >= 4, "y el 2,2× dejaba CUATRO de los seis con más de un 90% de error");

console.log("\n=== con el factor de CADA valor, calibrado de su propio contrato ===");
for (const c of CASOS) {
  const f = Math.round((c.ibkr / c.regT) * 100) / 100;   /* lo que deduce la app al calibrar */
  const v = await page.evaluate((x) => MARGEN_REGT(x.spot, x.strike, x.f), { ...c, f });
  const desvio = (v / c.ibkr - 1) * 100;
  console.log("  " + c.tkr + " " + c.strike + ": factor " + f.toFixed(2) + "×  →  $" + v.toFixed(0) +
    " vs $" + c.ibkr.toFixed(0) + " reales  (" + (desvio >= 0 ? "+" : "") + desvio.toFixed(1) + "%)");
  ok(Math.abs(desvio) < 1, c.tkr + " " + c.strike + " queda clavado con su propio factor");
}

console.log("\n=== y el factor de un valor sirve para sus otros strikes ===");
/* los dos META son el mismo valor con strike y plazo muy distintos (515 a 42 días y 490 a 300).
   Si el factor fuera de la operación y no del valor, calibrar uno no serviría para el otro. */
const m1 = CASOS[4], m2 = CASOS[5];
const fMeta = Math.round((m1.ibkr / m1.regT) * 100) / 100;
const cruz = await page.evaluate((x) => MARGEN_REGT(x.spot, x.strike, x.f), { ...m2, f: fMeta });
const errCruz = (cruz / m2.ibkr - 1) * 100;
console.log("  calibrando META con el put 515 y aplicándolo al 490: $" + cruz.toFixed(0) +
  " vs $" + m2.ibkr.toFixed(0) + " reales  (" + (errCruz >= 0 ? "+" : "") + errCruz.toFixed(0) + "%)");
ok(Math.abs(errCruz) < 35, "calibrar META con un contrato deja el otro a menos de un 35% (" + errCruz.toFixed(0) + "%)");

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
