# Bloques — contexto de trabajo (leer antes de tocar nada)

App de gestión de cartera por bloques (B0 Liquidez · B1 Core · B2 Income · B3 High Risk).
Un solo archivo fuente: **`index.html`** (~12.300 líneas, JSX + React 18 compilado por `build.mjs`).

## El usuario

Victor (@vdonado), **piloto, no técnico**. Hablarle **en español, sin jerga**.
- **Él no toca el código ni GitHub.** Pide los cambios por el chat y Claude los hace de punta a
  punta: editar `index.html`, verificar, commit, PR, merge y confirmar que se publicó. Victor solo
  abre la app en el iPhone y acepta la actualización. (Antes subía él el archivo por la web de
  GitHub; ya no — lo dijo el 7-ago-2026: *"ya me lo haces tú lo de subir el nuevo index cada vez"*.)
- Corolario: si algo del despliegue requiere pulsar un ajuste en GitHub (permisos, Pages…), hay que
  dárselo **paso a paso y sin jerga**, y avisar de las consecuencias antes de que lo pulse.
- Trabaja desde el **iPhone**, con la app **guardada en la pantalla de inicio** (modo standalone).
  Casi todos los bugs de layout que reporta son específicos de ese modo — comprobarlos con
  Chromium en viewport iPhone antes de dar nada por bueno.
- Manda **capturas de pantalla** para reportar. Merecen medirse en píxeles (PIL) antes de
  diagnosticar: varias veces el problema real no era el que parecía a ojo.
- Cuando dice "está muy bien" es que está bien; cuando algo no le gusta lo dice claro y hay que
  revertirlo sin insistir (pasó con las bandas de color laterales y con el splash de arranque).

## Cómo se trabaja aquí

**Rama de desarrollo:** `claude/para-claude-review-3t26i1`. NUNCA commitear directo a `main`.

Ciclo por cada entrega (siempre el mismo):
1. Editar `index.html` (y `CHANGELOG.md`, `package.json`).
2. **Subir `APP_VERSION`** en `index.html` (regla del propio archivo: +0.01 en CADA entrega que se
   despliegue, sea UI, cálculo o arreglo) y la `version` de `package.json` en paralelo.
3. Anotar en **`CHANGELOG.md`** arriba del todo, en español y con el estilo de siempre:
   síntoma → causa → arreglo → verificación. Es el historial que él lee.
4. `npm run build` (debe imprimir `build <hash> ok — app vX.XX …`) + `node --check dist/app.js`.
5. Verificar en **Chromium con viewport iPhone** (Playwright en `/opt/pw-browsers/chromium`),
   sembrando posiciones en `localStorage` (`bloques_pos_v5`, `bloques_acc_v5`, `bloques_snapshots_v1`)
   y sirviendo `dist/` con `python3 -m http.server`. Capturar y MIRAR la captura.
6. Commit → push → PR → merge → esperar ~90 s y confirmar que el workflow acabó en verde.
7. Enviarle la captura al chat y avisarle de que abra la app y acepte la actualización.

Playwright: usar `serviceWorkers: "block"` en el contexto (si no, el SW sirve caché vieja) y
`ctx.route(/regex/)` para simular APIs — los globs no cubren la query string.

## Arquitectura

- **`build.mjs`**: compila el bloque `<script type="text/babel">` con @babel/preset-react, sustituye
  los CDN por `vendor/`, inyecta manifest + service worker, escribe `dist/`. Referencia `app.js` con
  su hash (`?v=…`) — sin eso, GitHub Pages sirve el app.js viejo y la actualización no aplica nunca.
- **Service worker**: red primero con `cache: "no-cache"` en TODOS los fetch (revalida siempre;
  sin esto la app resucitaba la versión vieja al reabrir), caché propia solo como respaldo offline.
- **Auto-actualización**: `UpdateOffer` comprueba al arrancar si hay versión nueva (busca por regex
  `const APP_VERSION = "x"` en el HTML servido) y OFRECE actualizar en una barrita — nunca recarga
  sola (eso causó un bucle). `build.mjs` inyecta ese marcador en el `<head>` compilado: no quitarlo.
- **Despliegue**: `.github/workflows/build-and-deploy.yml` en cada push a `main`. Compila y **empuja
  `dist/` a la rama `gh-pages`** (force-push de un commit único; esa rama es un espejo del compilado,
  no un historial). Pages sirve `gh-pages` / (root).
  No usar `actions/deploy-pages`: se quitó el 7-ago-2026 porque no empuja ficheros —crea un
  despliegue y espera en una cola compartida—, se rinde a los 10 min (techo duro, no se puede subir)
  y **al rendirse cancela el despliegue, dejando ese commit inservible para siempre**. Un mal día de
  Pages costó nueve intentos fallidos para ocho versiones, sin un solo fallo del código.
  El token del robot necesita permiso de **escritura**, fijado en la ORGANIZACIÓN (no en el repo; por
  eso la opción sale en gris en Settings del repo): organizations/GaloFly/settings/actions.

## La mudanza a dominio propio (13-ago-2026) — DOS sitios a la vez

Desde la v4.50 la app se publica en **dos** direcciones desde el MISMO commit de `main`:

| Dirección | Quién la publica | Estado |
|---|---|---|
| `galofly.github.io/galowillmakeyourich` | GitHub Actions → rama `gh-pages` | la vieja; se apagará |
| **`app.alphavext.com`** | **Cloudflare Pages** (proyecto `galowillmakeyourich`) | la definitiva |

Cloudflare Pages: rama `main`, framework **None**, `npm run build`, salida `dist`, Node 22 vía
`.nvmrc`. El CNAME `app` → `galowillmakeyourich.pages.dev` está proxied en la zona `alphavext.com`.

**Por qué hay prisa cero y a la vez cuidado:** el repo pasará a privado cuando los tres usuarios se
hayan mudado, y **GitHub Pages solo publica gratis desde repos públicos** — el día que se cierre, la
dirección vieja deja de abrir. Los datos no se pierden (viven en cada iPhone) pero **el botón de
Backup vive DENTRO de la app**: si no abre, no hay forma de sacarlos. De ahí `MudanzaAviso` (v4.50),
que solo se pinta si `location.hostname` acaba en `github.io` y no se puede descartar.

Dos trampas ya pisadas, para no repetirlas:

- **Cloudflare empuja al asistente de Workers, no al de Pages.** Se distinguen por un campo: Workers
  pide *Deploy command* + *API token*; **Pages pide "Build output directory"**. Si ese campo no está
  en pantalla, es el flujo equivocado. Enlace directo al bueno:
  `dash.cloudflare.com/?to=/:account/pages/new/provider/github`.
- **La franja "This project is disconnected from your Git account" NO es cosmética.** Con ella, el
  proyecto compila una sola vez (la del asistente) y **ningún push posterior dispara nada**: el sitio
  nuevo se queda congelado en silencio mientras el viejo sí se actualiza. Se arregla en
  Settings → Build → Git repository → **Manage** (que abre GitHub y re-concede el acceso al repo).
  **Nunca `Disconnect`**: eso desengancha el repo del proyecto y hay que rehacerlo con dominio y todo.

Comprobación de que la tubería está entera: subir a `main` y ver aparecer **una fila nueva** en
Deployments con ese commit. Si solo está la vieja, está cortada — el ✓ verde de una entrega anterior
no dice nada del enganche.

Falta: añadir `https://app.alphavext.com` a `BLOQUES_ORIGENES` en `/etc/bloques/entorno` del VPS y
reiniciar `bloques-puente`, o la app en el dominio nuevo no podrá hablar con el puente (CORS).

## Precios reales de opciones (v4.51–v4.52) y lo que falta

Con el puente conectado, el 🔄 Precios pregunta a OpenD cuánto vale AHORA cada contrato y el P&L deja
de ser una simulación. Código de Futu: `US.TICKER + AAMMDD + P|C + strike×1000`.

| Estructura | Estado |
|---|---|
| Short put · covered call · long call (una pata) | **real** desde v4.51 |
| Spread vertical (2 patas, `sK`/`lK`/`sP`/`lP`) | **real** desde v4.52 — antes era 100% manual |
| DC/DD (`dcdd.legs`, 4 patas, DOS vencimientos: shorts en `p.expiry`, longs en `dcdd.expiryLong`) | **real** desde v4.53 |
| PMCC / Diagonal (corta en `p.*`, larga en `p.long`, dos vencimientos) | **real** desde v4.53 |
| Iron Condor · Iron Fly · Broken Wing · Calendar suelto | manual (no guardan patas estructuradas) |

Reglas que gobiernan esto y no se tocan:

- **UN solo camino para todas las estructuras** (v4.53). `patasDePosicion(p)` devuelve la lista de
  patas —contrato, lo cobrado/pagado por acción, y signo (+1 corta, −1 larga)— y con eso dos fórmulas
  sirven para todo: P&L = Σ signo × (entrada − marca), y coste de cerrar = Σ signo × marca. Antes
  había un camino por estructura, casi idénticos: es donde se crían los bugs silenciosos.
- **O están TODAS las marcas de una posición, o no se usa ninguna.** Un P&L medio real y medio
  inventado es peor que el manual, porque parece exacto. (`marcasDeTodasLasPatas` devuelve null si
  falta una sola, y la posición cae a su cálculo de antes.)
- **Las primas se toman en valor absoluto.** Según por dónde entren (asistente, lector de capturas,
  campos antiguos) las de las patas cortas pueden venir con signo o sin él; el signo real lo pone
  `signo`, no el dato guardado.
- **Las marcas se guardan indexadas por código** (`p.optMarks`) y la tabla se **reemplaza** entera en
  cada refresco. Así una posición rolada descarta sola el precio del contrato que ya no tiene, sin
  código de migración ni limpieza.
- **Sin servidor propio no se hace ni una llamada.** Los otros dos usuarios ven la app de siempre.
- **Se dice en pantalla** (`vale X` en una pata, `cerrar X` en un vertical, y la etiqueta `P&L · REAL`
  en violeta). Cuando un número cambia de significado hay que avisar, o cambia a espaldas de quien mira.
- Una llamada por contrato DISTINTO y con pausa: el cupo de OpenD es de la cuenta compartida.

**Pendiente pedido por Victor (13-ago-2026):** *"estaría bien sacar de aquí el portfolio theta y delta,
saber qué theta diario sacamos, pero no sé dónde lo podríamos incluir"*. Delta, theta, IV e interés
abierto **ya se guardan** (`p.optGriegas`, por código). Falta (a) decidir dónde caben —en la fila NO:
`… · vale 3.10 · Δ -0.22` se parte y deja el número solo en una línea— y (b) que las estructuras
multi-pata den griegas, o el theta de la cartera saldría corto en silencio. Por eso va después.

## Sistema de diseño (v4.11–v4.29)

Regla base: **lo interactivo se ELEVA, lo estático se HUNDE.**

Tokens en `T_LIGHT` / `T_DARK`:
- `T.shadow` — tarjetas grandes (contacto 1-2px + ambiente 30-40px; bisel de luz arriba en oscuro).
- `T.raise` — sub-tarjetas: filas de posiciones, Exposición, filas del Resumen, filas de Ajustes.
- `T.raiseSm` — chips y filas pequeñas (selectores, totales por mes).
- `T.inset` — hundido: tiles de métricas del hero, fila de ratios, `Tile`.
- `T.edge` — filete hairline; va SIEMPRE con `T.raise` (blanco sobre blanco la sombra no basta).

Colores de bloque propios (no reciclan los semánticos del tema), validados para daltonismo en
claro y oscuro: B0 `#3E7CB1`/`#3D7FB8` · B1 `#128A45`/`#1F9C55` · B2 `#6F5BD8`/`#7A68DC` ·
B3 `#C2681E`/`#CE7226`.

Detalles ganados a base de iteración (no deshacer sin motivo):
- Filas deslizables (pestañas de bloque, chips de broker): `padding` interior + `margin` negativo
  equivalente, o el scroll recorta la sombra y deja una **línea recta** antiestética.
- iOS: `input/select/textarea` a **16px** bajo `@supports (-webkit-touch-callout: none)` — con menos,
  iOS hace zoom al enfocar y en standalone **se queda pegado**, desbordando el layout.
- Des-zoom automático: si `clientWidth` ≠ ancho físico de pantalla, se reancla el `<meta viewport>`.
- Rejillas de tarjetas: `gridTemplateColumns: "minmax(0, 1fr)"` — una columna `auto` se ensancha
  hasta el texto más largo sin envolver y desborda TODA la página (pasó en Ajustes).
- Banner de covered call: tile violeta fino con banda de 2px. Ya se probó "discreto sin recuadro"
  y lo rechazó: quiere el recuadro, pero delgado.
- Sin bandas de color laterales en las filas (probadas y rechazadas).

## Datos y APIs

- Todo vive en el dispositivo: `localStorage` + IndexedDB (autoritativo para lo grande).
- **Finnhub** (gratis): cotizaciones y earnings FUTUROS. No da dividendos.
- **Alpha Vantage** (gratis, 25/día): ex-dividend (`OVERVIEW`) y earnings pasados. Key en
  Ajustes → API keys → "Dividendos (Alpha Vantage)".
- **Gemini**: lector de capturas del Comparador.
- Las tres keys viajan en el backup JSON.

## El servidor propio (v4.43+) — la máquina es COMPARTIDA

VPS de Hetzner (Ubuntu). Ahí viven **tres sistemas de Victor**, no solo el nuestro:
`root` (earnings, y es quien corre OpenD), `agente` (venta de puts, sin sudo) y lo nuestro.
Antes de tocar nada en esa máquina, leer `servidor/README.md` y `INFRA_SERVIDOR.md` (que él pasa
por el chat). **Verificar con `ss -tlnp` / `systemctl status` antes de asumir que algo está montado**:
ya ha habido cuatro piezas documentadas como existentes que no existían.

Lo nuestro: `servidor/puente.py` (Flask, solo lectura) + `servidor/instalar.sh` (un comando, monta
el servicio `bloques-puente` en `127.0.0.1:8777`). La app se conecta en Ajustes → Avanzado →
Servidor propio. La clave **no viaja en el backup** a propósito (los backups se comparten por chat).

Las cuatro reglas que NO se saltan, porque los límites de la API de Futu son **por cuenta y no por
proceso** — lo que gaste nuestro puente se lo quita a los otros dos, en silencio:
1. **Caché siempre.** Precios 20 s, cadenas de opciones 6 h (`get_option_chain`: 10 llamadas/30 s
   para toda la cuenta).
2. **Ritmo a la mitad** del límite documentado. El margen es de root y del agente.
3. **Las suscripciones se devuelven** (máx 60, se sueltan a los 15 min sin usarse). El cupo también
   es de la cuenta; la v1 suscribía y no soltaba nunca.
4. **Ventanas de root sagradas**: 15:29-15:46 y 21:30-21:35 (Madrid) no se llama a OpenD.

Y además: **el túnel de Cloudflare YA EXISTE**, corre como root y se configura desde el panel web
(no hay `config.yml`). NUNCA crear un túnel nuevo ni reinstalar `cloudflared`. Ese túnel es el mismo que se montó para
**Super Calculator**, la otra app de Victor: desde el 8-ago-2026 esa app corre en otra máquina
(`minima-agent` ya no existe aquí), pero el túnel puede conservar sus rutas en el panel — destruirlo
o recrearlo puede tirar una app en uso. Añadir un *Public Hostname* (tipo HTTP, a `127.0.0.1:<puerto>`)
sí es seguro — es aditivo, en caliente y no toca las rutas que ya hay. Requiere que el dominio esté
en la MISMA cuenta de Cloudflare que el túnel.
El 11111 (OpenD) no se expone jamás: es la puerta a la cuenta de trading.

Desde el 13-ago-2026, `puente.alphavext.com` lleva delante una **regla WAF de Cloudflare** que exige
la cabecera `x-bloques-token` y bloquea todo lo demás **en el borde**, antes de tocar el VPS — con
excepción explícita para `OPTIONS`, o el preflight del navegador moriría y la app no conectaría
nunca. Se descartó **Cloudflare Access** a propósito: pone un login delante y al puente le habla la
app por `fetch`, no una persona. Detalle completo en `servidor/README.md`.

Puertos en esa máquina (verificado el 8-ago-2026: solo escuchaba el 11111): 8777 el nuestro ·
8779 puente-alertas · 11111 OpenD (root) · 22 SSH. Solo el 22 se asoma al exterior. El 8788 quedó
libre al mudarse Super Calculator.
RAM total 3,7 GB compartida entre los tres sistemas — de ahí el tope de memoria del servicio.

Dominio: **alphavext.com**. `puente.` es el nuestro (8777); `alertas.` es de otro servicio (8779).

OPRA ya está contratado y entra por OpenD — no hay que integrar nada nuevo, pero tampoco hay una
segunda vía: todo lo de arriba aplica igual a los datos de opciones.

## Semántica que confunde y ya se aclaró

- Barra apilada del hero = **reparto del capital desplegado** (cuota de cada bloque sobre la suma
  de los cuatro). NO es % NLV (con opciones sumaría >100) ni riesgo plausible (B0 sería 0).
  Por eso B0 sale ~9% ahí y ~17% en Exposición (ese sí es contra NLV).
