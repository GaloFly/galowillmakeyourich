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
4b. **`npm run prueba`** — la red de seguridad de los usuarios SIN servidor propio (ver abajo).
   Tiene que decir `OK`. Si dice `FALLA`, NO se publica hasta entender por qué.
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

### El día que la app no abría (15-ago-2026) — y NO era nuestra

Victor: *"no se abre la app"*, pantalla en blanco, cuatro horas de diagnóstico. La causa era
**Vodafone bloqueando el dominio `alphavext.com`** en datos móviles (su Secure Net); con VPN entraba.
`galofly.github.io` funcionaba porque no está bloqueado, y esa asimetría es la que me hizo perseguir
tres teorías equivocadas seguidas (la caché del teléfono, un despliegue viejo de Cloudflare, el
service worker). Lecciones, por orden de valor:

1. **Pedir el mensaje de error literal ANTES de teorizar.** Lo que resolvió esto fue abrir la
   dirección en Safari normal y leer lo que ponía. Se podía haber hecho en el minuto uno.
2. **Una pantalla en blanco no es un diagnóstico, es la ausencia de uno.** De ahí el cartel de
   arranque (v4.79) y `rescate.html` (v4.80): ahora un fallo así se explica solo.
3. **Un service worker NO puede devolver una respuesta redirigida** — el navegador la rechaza y deja
   la página en blanco. Y `cache.put` la rechaza igual, así que un `addAll` con un recurso redirigido
   **falla entero y el SW nuevo no se instala jamás**: el viejo se queda encerrado y no puede
   sustituirse a sí mismo. Arreglado en la v4.81 (`sinRedir` + instalación tolerante).
4. **Cloudflare Pages redirige `/algo.html` → `/algo`; GitHub Pages no.** Esa diferencia sola basta
   para que la misma app vaya en un sitio y no en el otro. Se neutraliza con `_redirects` y código
   200 (v4.82), que además es lo único que puede rescatar a un teléfono ya encerrado.
5. **Vodafone intercepta con una redirección a su portal**, así que un bloqueo del operador llega al
   service worker como... una respuesta redirigida. Los puntos 3 y 5 juntos explican por qué salía
   blanco en vez del aviso del operador.

Corolario operativo: **no apagar `galofly.github.io` hasta que `app.alphavext.com` abra sin VPN.**
Mientras el operador lo bloquee, esa dirección es la única salida — y el botón de Backup vive dentro
de la app.

Falta: añadir `https://app.alphavext.com` a `BLOQUES_ORIGENES` en `/etc/bloques/entorno` del VPS y
reiniciar `bloques-puente`, o la app en el dominio nuevo no podrá hablar con el puente (CORS).

## Precios reales de opciones (v4.51–v4.53) y lo que falta

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
- **Sin servidor propio no se hace ni una llamada, Y NO SE USA NI UNA MARCA** (candado `HAY_PUENTE`,
  v4.56). No basta con no llamar: el backup se lleva las marcas dentro (`...p`) y los backups se
  comparten por chat, así que un amigo con la copia de Victor habría visto `P&L · REAL` con precios
  congelados. Además, desde la v4.56 las marcas y griegas **ya no viajan en el backup**: son dato de
  mercado, re-descargable, como el % del día.
- **Se dice en pantalla** (`vale X` en una pata, `cerrar X` en un vertical, y la etiqueta `P&L · REAL`
  en violeta). Cuando un número cambia de significado hay que avisar, o cambia a espaldas de quien mira.
- Una llamada por contrato DISTINTO y con pausa: el cupo de OpenD es de la cuenta compartida.

**Theta y delta de la cartera (v4.54)** — lo que pidió Victor, hecho ya que las multi-pata dan
griegas. Tarjeta propia bajo el hero, `GriegasCard`, solo si hay griegas de verdad (quien no tiene
servidor no ve ni un hueco). Dos decisiones de fondo:

- **Theta en $/día** (`−signo × theta × qty`; la theta de OpenD es por acción y día). Sumar $/día
  entre tickers sí tiene sentido.
- **Delta en DÓLARES, no en acciones** (`−signo × delta × qty × spot`). Sumar "acciones
  equivalentes" de NVDA y SGOV no significa nada. Las acciones entran con delta 1: sin ellas una
  covered call saldría bajista y la cartera parecería lo que no es.
- **La cobertura se dice SIEMPRE**, no solo cuando falta algo: "de N de tus M posiciones". Un theta
  que dice 40 cuando son 70 es peor que no tenerlo, y si solo se avisara al fallar, el día que
  faltara una posición nadie se daría cuenta.
- **UNA sola llamada por refresco** (v4.58): `/opciones` del puente usa `get_market_snapshot`, que
  admite cientos de códigos de golpe. Antes era una llamada por contrato. Si el servidor es viejo y
  no conoce la ruta, la app vuelve sola al camino de uno en uno.
- **El snapshot SÍ da griegas con el mercado cerrado** (comprobado en el VPS el 14-ago-2026;
  `get_stock_quote` no). Lo de "OpenD no da griegas fuera de horario" era falso: se preguntaba por la
  puerta equivocada. Por eso la frescura se decide por **la hora que trae el dato**, no por si llegó.
- *(Histórico, ya no aplica)* **Fuera de horario `get_stock_quote` manda precio pero NO delta ni theta.** Desde la v4.57 se conservan las
  del contrato anterior en vez de sobrescribirlas con nulos, y la chapa pasa de `EN VIVO` a
  `DEL CIERRE` diciendo de cuándo son. Para saberlo se guarda **el hecho** (`optGriegasFrescas`), no
  una hora que luego haya que comparar con un margen inventado — eso ya falló una vez.
- **Y si NO hay ni una griega, la tarjeta tampoco desaparece** (v4.55, tras "no me salen las griegas
  de la cartera"): con servidor configurado se pinta igual y dice cuál de los dos motivos es —aún no
  se ha pulsado 🔄 Precios, o el servidor mandó precio pero no delta/theta (mercado cerrado)—, que
  tienen soluciones distintas. Tercera vez que el mismo fallo: **callarse no es un estado neutro,
  no se distingue de una avería** (precedente: la calculadora de earnings, v4.46).

Sigue pendiente: IV agregada, y las griegas por posición en la fila (`Δ -0.22` NO cabe ahí — se
probó en la v4.51 y parte la línea).

## Buscador de puts del Comparador (v4.59)

Tarjeta en Herramientas → Puts que **solo se pinta con servidor propio**. Ticker → `/cotiza` (spot) →
`/cadena` con rango (descubre vencimientos) → elige los más cercanos a 30/45/60 días → filtra puts
entre el 70% y el 100% del spot, 5 por vencimiento → `/opciones` con los ~15 códigos en UNA llamada.

- **Nunca se piden todos los contratos**: una cadena de NVDA trae 758. El cupo es de la cuenta
  compartida con root y el agente.
- **El margen se ESTIMA con Reg-T** (`max(20%·spot − OTM, 10%·strike) × 100`) y va marcado en ámbar
  con un aviso: OpenD no lo sabe, no es dato de mercado. Editable como cualquier campo.
- **Las candidatas no entran solas** en el comparador: lista aparte y botón Añadir por fila.
- **No hay criterio nuevo**: ordena y decide el `basis` que ya tuviera elegido Victor.
- **Filtra por DELTA, no por strike** (v4.61, Victor: *"los deltas están muy agresivos, deberían
  estar 0.3 para abajo"*). Se bajan ~15 strikes por vencimiento y se descartan los que pasan del
  umbral —editable, 0,30 por defecto—; de los que quedan se enseñan los 5 que más pagan. Filtrar por
  strike metía una casi ATM (Δ 0,49). Sin delta un contrato NO se cuela, pero se cuenta y se dice.
- La POP se deriva de la delta (`1 − |delta|`); sin delta se deja vacía, no se inventa.
- **Agrupado por VENCIMIENTO, no por strike** (v4.60, Victor: *"viene muy raw"*). Dentro de un
  vencimiento se elige cuánto riesgo quieres; entre vencimientos, si compensa irse más lejos. En una
  lista plana hay que hacer las dos comparaciones a la vez y por eso no se leía. El spot encabeza el
  resultado —es la referencia de cada strike— y la mejor va marcada según el `basis` elegido.

## Herramienta Double Calendar (v4.62)

Pestaña en Herramientas, **solo con servidor propio**, con las reglas del manual de OptionsKit que
pasó Victor el 14-ago-2026. Están citadas con su página en el comentario de `buscarDobles()`.

Lo que hay que tener presente:

- **OpenD NO conoce `US.SPX`, `US.SPXW` ni `US.VIX`** (comprobado en el VPS). Sí `US.QQQ` y
  `US.SPY`, que es lo que el manual dice que sirve igual. No perder tiempo reintentando el SPX.
- **El VIX no lo da nadie**: Finnhub responde *"Market data subscription required for CFD indices"*.
  Se probó a estimarlo con la IV ATM y Victor lo rechazó (*"quita el VIX que ese pseudo no
  funciona"*, v4.63): daba un número con pinta de dato que no lo era, y encima decidía un semáforo.
  Ahora solo hay un campo para teclearlo. **Un hueco honesto es mejor que una cifra inventada.**
- **DOS sellos, no un veredicto único** (v4.68, tras el péndulo). La v4.62 juzgaba solo por el ratio
  y pintaba verde con la IV en contra (Victor lo cazó). La v4.63 exigió las dos… y entonces salía
  `NO` en TODO: la curva de volatilidad **sube con el plazo casi siempre** —el contango de las págs.
  7-10, que el propio manual describe como el mercado tranquilo en el que quiere que entres—, así
  que con vencimientos a dos días pedir IV corta > IV larga es pedir algo que casi nunca pasa. Un
  semáforo que siempre dice lo mismo no informa. Ahora: sello `RATIO` con el veredicto del manual
  (única regla con número: ≥40%, ideal >50%) y sello `CURVA` aparte con la brecha en puntos. Ninguno
  tapa al otro.
- **El ratio NO se compara entre montajes** (v4.68). Depende sobre todo del hueco de días: entre 6 y
  7 días, √(6/7) = 93% de salida aunque las dos patas tengan la misma volatilidad. Marcando "la
  mejor" por ratio en bruto ganaba SIEMPRE el 6/7, por construcción y no por calidad. Se elige por
  la **brecha de IV**, que es dato de OpenD y no depende del hueco, entre las que pasan el ratio.
- **Los cuatro pares se cuentan DESDE EL VIERNES DE ENTRADA** (v4.67, Victor: *"las entradas son
  siempre en viernes… eso es 5/7, 6/7, 7/10, 7/14"*). No son "dos vencimientos que caigan en esos
  días de la semana": son 5/7, 6/7, 7/10 y 7/14 días contados desde ese viernes. Buscándolos por día
  suelto salían parejas de la semana siguiente (mié 26 → vie 28, a 12/14 días, que no es el montaje)
  y a la vez faltaba el 7/14, porque hacían falta ocho vencimientos y por cupo solo se pedían seis.
- **Los strikes, los MISMOS en los cinco vencimientos** (v4.67). La pata larga tiene que ser del
  mismo strike que la corta: eligiéndolos por separado en cada vencimiento, el montaje se caía en
  silencio en cuanto la escalera cambiaba. Se elige una lista única (los que existen en todos, dentro
  del 5% del precio, salteados si pasan de 16 por lado) y se pide entera: ~150 códigos en UNA llamada.
- **Varios strikes por par**, no uno: la banda tiene que llegar a delta 0,10, y con 12 strikes por
  lado se quedaba a ±4% del precio y todos los objetivos caían en el mismo.
- **Cada montaje se pliega, y el que no se puede montar se dice** (v4.67). Si falta un vencimiento
  por festivo, el montaje sale igual en gris explicando cuál falta — desaparecer no se distingue de
  "no compensa". Se abre solo el mejor de los que pasan las dos reglas; si ninguno pasa, ninguno.
- **Las semanas con festivo se detectan solas**: SPY/QQQ vencen todos los días hábiles, así que si
  falta un día entre semana, ese día el mercado estaba cerrado. Sin lista que mantener.
- **Estructura de volatilidad y movimiento esperado** (v4.69, Victor: *"estaría bien el volatility
  term structure y el expected move… para elegir strikes"*). Es la pieza que le faltaba: la pág. 6
  dice que esto no va de DTE sino de la curva. Gráfico de la IV en el dinero a 60 días (~10 puntos)
  con su lectura en una frase, y el movimiento esperado por vencimiento. **El movimiento esperado no
  se modela: es el precio de la straddle en el dinero**, dato de mercado, y se dice en pantalla.
  Cuesta CERO llamadas extra: dos contratos por vencimiento entran en la misma llamada (~160 de 200).
- **El modelador** (v4.75, Victor: *"un modelador en condiciones para modular todo: IV cortas,
  largas, media, strikes, y cómo evoluciona según pasa el tiempo"*). Cuatro mandos: strikes (por la
  ESCALERA de precios reales ya descargados, así el débito de cualquier combinación es de mercado),
  días de hoy al vencimiento de la corta, e IV de corta y de larga **por separado** — lo que decide
  un calendar es la DIFERENCIA entre las dos, y un mando único no la deja tocar.
- **La prueba de fuego del modelo se enseña en pantalla**: hoy, al precio de hoy y sin tocar nada,
  tiene que dar CERO, porque la IV de cada pata es la que explica su propio precio. Da −$0,41 sobre
  $180 en la prueba. Si algún día se desvía, se dice en ámbar en vez de callarlo.
- **El día que vence la corta, la IV de la corta no influye en nada** (no le queda tiempo). Solo
  pesa por el camino. La prueba esperaba lo contrario y estaba mal ella; ahora comprueba las dos.
- **Con strikes muy separados hay CUATRO equilibrios**, no dos: el centro se hunde bajo cero y
  aparece una zona de pérdida dentro de la de ganancia. Es correcto (el sag de la pág. 15 al
  extremo). Lo que nunca puede salir es un número impar.
- **La curva de resultado es lo ÚNICO de la herramienta que NO es dato, es un MODELO** (v4.74). Para
  dibujarla hay que valorar la pata larga el día que vence la corta con Black-Scholes, suponiendo una
  volatilidad; OptionStrat hace lo mismo y por eso lleva su control de IV. Se dice en pantalla y se
  parte la frontera: **débito y pérdida máxima = DATO** (mismo strike en las dos patas → lejos del
  dinero el spread vale 0 y pierdes lo pagado), **máximo, equilibrios y forma = MODELO**. El mando
  «si la IV de la larga baja 2 pts» no es un adorno: es el riesgo de la pág. 15, y mueve el centro de
  +$74 a +$4 en el ejemplo de la prueba.
- **Los STRIKES entran como puntos exactos de la rejilla** (v4.74). El máximo de un doble calendar es
  un pico anguloso justo en un strike: con rejilla regular salía ~$4,50 corto y los picos romos.
- `pruebas` de scratchpad `payoff.mjs`: BS contra valores de libro y paridad put-call, invariantes
  (lejos del dinero se pierde exactamente el débito), y los números de la app contra una
  implementación escrita aparte con otra función de error. Cazó las tres cosas de arriba.
- **La curva arranca con ZOOM en la ventana del montaje** (v4.73, Victor: *"que haga un poco más de
  zoom para ver claro dónde explorar DC"*). A 60 días, los quince primeros vencimientos —donde vive
  el montaje— caían en la quinta parte izquierda. Con zoom: 6 puntos y 4 fechas en el eje en vez de
  10 y 2. La vista larga sigue a un toque.
- **Una caída de menos de 0,1 puntos de IV NO es un tramo a la baja** (`BAJADA_MIN`, v4.73). Con el
  umbral en 0,01 salía "del 4 sep al 11 sep (−0.0)": verde, anunciado como favorable, y con la caída
  escrita a cero. Ruido disfrazado de señal, que invita a montar sobre una diferencia inexistente.
- **El bache de la curva se pinta y se nombra** (v4.72, Victor: *"que se vea mejor ese backwardation
  en fechas"*). El veredicto global de punta a punta ("de 3 a 49 días SUBE: contango") tapaba que POR
  EL CAMINO baja, que es lo único que importa: un tramo que cae es un tramo donde la corta es la
  cara. Tramo verde y grueso el que baja, su caída escrita encima, eje en FECHAS, y las del bache con
  prioridad sobre las de los extremos (los vencimientos de delante van tan juntos que solo caben dos
  o tres etiquetas). Los tramos que bajan se enumeran solo si son la EXCEPCIÓN: en backwardation
  entera bajan los nueve y enumerarlos era el párrafo ilegible que se quitó en la v4.70.
- **Calendario de dos toques** (v4.71, Victor enseñando OptionStrat: *"pulsas la primera y la
  segunda… para ir probando"*). Tira de vencimientos: un toque la corta (azul), otro la larga
  (violeta). Va por el MISMO `buscarDobles` con el parámetro `manual`, no por un camino paralelo:
  lo que se compara es un par contra otro, y dos caminos harían leer una diferencia de cálculo como
  una diferencia de mercado. Los días se cuentan desde el viernes de entrada, como los fijos. La
  cadena se pide con el mismo rango → caché del puente; solo 2 vencimientos → ~76 códigos.
- **La banda del EM se DIBUJA** (v4.70, Victor: *"cuesta leerlo, que sea muy visual"*). Gráfico de
  rangos con el eje en movimientos esperados: franja ±1 EM sombreada y una línea por candidata de su
  put a su call. Y el % del EM de cada pata en su propio chip. Lo que se repite igual en las cinco
  filas de un montaje (la frase de la IV) va UNA vez, en la cabecera: era la mitad del texto.
- **El detector de festivos solo mira las dos semanas del montaje** (v4.69). Con la ventana a 60 días,
  los vencimientos lejanos ya no son diarios (quedan los viernes), y "falta un día entre semana" ahí
  no significa festivo sino que la escalera se ensancha con el plazo.
- **La put solo por debajo del precio y la call solo por encima**, y nada con |delta| ≥ 0,5. Sin ese
  corte se colaba un strike dentro de dinero del otro lado con un |delta| parecido al buscado, y
  salía una "put" por encima del spot.

## La red de seguridad de los que NO tienen servidor (`npm run prueba`)

Preocupación de Victor (13-ago-2026): *"esto a la gente que no tenga el servidor le va a afectar,
porque si vamos a estar tocando cómo se graban los iron condors… les va a salir todo mal, ¿no?"*.
Tiene razón, y el riesgo no es del servidor: es de **tocar el formato de los datos**. Sus dos amigos
usan el MISMO `index.html` y no pueden avisar de nada.

`pruebas/sin-servidor.mjs` carga `pruebas/datos-amigo.mjs` —una cartera fea a propósito, con una de
cada tipo: acciones, cerrada, short put, covered call, long call, PMCC, Spread (con y sin pata
cerrada), DC, Iron Condor, Iron Fly, Calendar, P&L manual forzado y liquidez— **sin configurar el
servidor**, y compara todas las cifras de las seis pestañas contra `pruebas/linea-base.json`.

Decisiones del diseño de la prueba, para que no mienta:

- **Retrato numérico, no texto.** Se capturan todos los importes y porcentajes en orden. Así un
  cambio de redacción no la rompe, pero un número que se mueve sí. Se capturan además las etiquetas
  del P&L (`auto` / `REAL` / `MANUAL`): si algo dijera `REAL` sin servidor, salta.
- **Reloj congelado** (`HOY` en los datos): hay cifras que dependen de los DTE y una prueba que
  cambia de resultado cada mañana no sirve.
- **Cualquier llamada a un puente queda registrada** y hace fallar la prueba: sin servidor
  configurado tienen que ser CERO.
- **Control de que navega de verdad**: si dos pestañas dieran el mismo retrato, avisa — estaría
  midiendo la misma pantalla varias veces y pasando siempre.
- **Playwright NO es dependencia del proyecto** a propósito (`npm ci` lo instalaría en cada
  compilación de Cloudflare, +100 MB para nada). El script lo busca donde esté instalado.

Comprobado que detecta de verdad: con un céntimo por acción de más en el P&L de las cortas, 6 de 18
retratos se movieron; forzando un `REAL` falso, 2 de 18.

`npm run prueba -- --fijar` reescribe la línea base. Es un **acto deliberado**: si se cambia, hay que
decir en el CHANGELOG por qué, o nadie sabrá si fue a propósito.

Las tres reglas que esto protege, y que van con el formato de datos:
1. **Solo se añade, nunca se quita ni se reescribe** un campo guardado. (Precedente: la v5.09 dejó
   los campos planos `shortPremium`/`strikePut` como respaldo al pasar las DC/DD a cuatro patas.)
2. **Los campos nuevos son opcionales**: si faltan, la posición se comporta como antes. Nunca
   "falta un dato → sale mal".
3. **O están todas las marcas de una posición, o no se usa ninguna.**

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
