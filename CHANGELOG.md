# CHANGELOG — Bloques

Bloques v4.45 — El servidor propio hablaba en jerga de moomoo

## El síntoma
Primera conexión real del puente desde el iPhone, y el mensaje decía:

> ✅ Conectado. OpenD contesta · mercado US: **AFTER_HOURS_END**.

## La causa
OpenD devuelve el estado del mercado con el nombre interno de Futu, y la app lo pintaba tal cual.
`AFTER_HOURS_END`, `PRE_MARKET_BEGIN`, `WAITING_OPEN`… son etiquetas de programador; en pantalla no
dicen nada.

## El arreglo
Tabla de traducción: `AFTER_HOURS_END` → "after hours terminado", `CLOSED` → "mercado cerrado",
`MORNING`/`AFTERNOON` → "mercado abierto", y así.

Lo importante es qué pasa con lo que NO está en la tabla: **no se enseña el nombre crudo, se calla**.
Queda "✅ Conectado. OpenD contesta." y punto. Enseñar jerga es peor que no enseñar nada — si mañana
Futu añade un estado nuevo, el mensaje seguirá siendo legible en vez de escupir una constante.

## Verificación
- Con el puente simulado devolviendo `AFTER_HOURS_END`: *"✅ Conectado. OpenD contesta · after hours
  terminado."*
- Estados conocidos (`CLOSED`, `MORNING`) traducidos.
- Estados desconocidos (`FUTURE_DAY_OPEN`, `?`, vacío, nulo): la frase queda limpia, sin restos.
- El resto de desenlaces del botón (clave mala, OpenD mudo, servidor caído) siguen igual.

## Nota de contexto
Esta es la primera versión con el puente funcionando de verdad de punta a punta: iPhone → Cloudflare
→ túnel → VPS → puente → OpenD, con el mercado americano contestando en vivo.

Bloques v4.44 — En oscuro, el asistente de nueva posición se disolvía en la página

## El síntoma
Victor, con dos capturas del asistente: *"cuando abres nuevas posiciones con el modo oscuro no se
ven"*.

## La causa
Medido antes de tocar nada: **ningún texto fallaba de contraste** — todos por encima de 3:1 en los
tres pasos. El problema no era leer las letras, era que **el diálogo no se separaba de la página**.

Dos cosas que funcionan en claro y no hacen nada en oscuro:

- El **velo** de detrás era `rgba(20,18,14,0.5)`. Un velo negro al 50% sobre un fondo que ya es casi
  negro (`#0C0D10`) no oscurece prácticamente nada.
- La **sombra** del panel es negra. Sobre negro no dibuja ningún contorno.

Resultado: el cuadro flotante tenía el mismo color que las tarjetas de detrás, sin borde ni sombra
que lo delimitara, y se leía todo junto — el "VALOR DE LA CUENTA" de la página parecía parte del
asistente. Es el mismo fallo que las filas de posiciones en la v4.37, en otro sitio.

## El arreglo
Dos tokens nuevos, aplicados a los **20 diálogos** de la app de una vez (no solo al asistente: el
fallo era de todos):

- `T.veil` + `T.veilBlur` — en oscuro, velo al 72% **y desenfoque del fondo**. El desenfoque es lo
  que de verdad separa: lo de detrás pierde el foco y el diálogo salta a primer plano. En claro se
  queda como estaba (allí el velo ya bastaba) con un desenfoque leve.
- `T.modalEdge` — filete claro en el borde del panel. Misma lógica por la que existe `T.edge`: si
  blanco sobre blanco necesita un filete porque la sombra no basta, negro sobre negro también.

## Verificación
Chromium (viewport iPhone 390×844), midiendo el contraste real de cada texto contra el fondo que
tiene detrás, en los tres pasos del asistente:
- Antes y después: **cero textos por debajo de 3:1** — confirma que el fallo no era el texto.
- Capturas antes/después en oscuro: el panel pasa de fundirse con la página a recortarse contra un
  fondo desenfocado, con su filete visible.
- Modo claro comprobado: el diálogo sigue igual de legible, ahora con el fondo levemente
  desenfocado.
- Los otros diálogos (Servidor propio, Backup, Brokers…) revisados con el cambio. Sin errores de
  consola.

Bloques v4.43 — Conectar la app con tu propio servidor (el puente a OpenD)

## De dónde viene
Victor tiene OpenD corriendo en un VPS con su cuenta de moomoo, y lo prueban tres personas. Meter el
tiempo real de opciones para los tres sería repartir un dato que solo está pagado para uno, y eso es
justo lo que puede costar el acceso.

La salida no es mantener dos apps: es **una sola app con un interruptor**. El servidor solo contesta
a quien trae la clave, así que basta con que la clave esté en un único móvil. Para moomoo, del otro
lado solo hay una persona.

## Lo que trae
**Ajustes → Avanzado → Servidor propio**: dirección, clave y **Probar conexión**.

- **Se prueba antes de guardar**, sobre lo escrito en los campos. Si guardara primero, una dirección
  mal tecleada dejaría la app "configurada" contra un servidor que no existe.
- **Los cuatro desenlaces se distinguen y se explican**, en vez de un "error" genérico: conecta bien ·
  la clave no es correcta (y dice el comando exacto para verla en el servidor) · el puente vive pero
  OpenD no contesta · no se llega al servidor (dirección, túnel o CORS — el navegador no dice cuál,
  así que se nombran las tres).
- **Corta a los 10 segundos.** Sin eso, con el servidor apagado el botón se queda pensando para
  siempre y parece que la app se ha colgado.
- La clave viaja **en cabecera, no en la dirección**: así no acaba escrita en los registros del túnel
  ni en el historial del navegador. Y el campo es de tipo contraseña — se teclea una vez, y enseñarla
  en pantalla solo serviría para que se colara en una captura.

## La decisión que importa: la clave NO va al backup
Es la única credencial que abre una máquina suya, y los backups se comparten por chat — en este mismo
proyecto ya ha pasado. Así que se queda en el dispositivo y punto. Al cambiar de móvil hay que
volver a escribirla; son dos campos, y a cambio no viaja nunca dentro de un fichero. El texto del
Backup lo avisa.

En el móvil de quien no lo configure, la fila dice "Sin configurar" y no hace absolutamente nada.

## De paso
La fila de Dividendos (v4.06) llevaba desde entonces con el **cuadrado del icono vacío**: pasaba
`icon="dividend"`, que solo existía en `ActIcon` y no en `SetIcon`. Mismo despiste que el de `bolt`
en la v1.75. Dibujo añadido.

## En el servidor
`servidor/instalar.sh` (nuevo): monta el puente de un solo comando — usuario propio sin privilegios,
servicio que arranca solo y se levanta si se cae, clave generada una sola vez (reejecutar el
instalador no la regenera: dejaría el móvil desparejado sin avisar) y una comprobación final contra
OpenD que explica el fallo en vez de callarse.

## Verificación
Chromium (viewport iPhone 390×844), con el puente simulado en sus cuatro estados:
- Conecta bien → "✅ Conectado. OpenD contesta · mercado US: TRADING."
- Clave mala (401) → "La clave no es correcta — revísala en el servidor con: sudo grep TOKEN…"
- OpenD mudo (503) → "OpenD no contesta: conexión rechazada"
- Servidor caído → el mensaje con las tres causas posibles.
- Guardar → la fila pasa a verde con la dirección; sobrevive a recargar; "Desconectar" lo borra.
- **Backup generado con el servidor configurado: 2.011 bytes, y no contiene ni la clave, ni la
  dirección, ni la palabra "puente".**
- Claro y oscuro. Sin errores de consola.

Bloques v4.42 — Las ventas parciales de acciones no aparecían en el Histórico

## El síntoma
Victor pasó el backup de un amigo con el mismo problema del que veníamos: operaciones de compraventa
que no aparecen en Cerradas. En la v4.41 arreglamos la reapertura, pero en ese backup no había ni un
solo caso de ese fallo — y aun así faltaban operaciones.

## La causa
Una **venta parcial** —vendes parte de la posición y te quedas el resto— es una ida y vuelta
terminada, con su compra, su venta y su resultado. Pero vive colgada de una posición que sigue
**abierta**, así que:

- en **Cerradas** no salía (la posición no está cerrada), y
- en **Abiertas** la cifra que se enseña es el no realizado, así que ese dinero ya ganado tampoco
  aparecía ahí.

Resultado: dinero real, ya cobrado, invisible en todo el Histórico (solo contaba dentro de los
totales de MTM). En el backup del amigo eran **8 ventas y +$3.320,16**: ACHR $53,90 · FN $2.215,64 ·
FOXF $94,90 · MRVL $395,77 · OXY $559,95.

## El arreglo
Cada venta parcial pasa a ser **su propia operación cerrada** en el Histórico, con etiqueta verde
**"Venta parcial"** para distinguirla de un cierre completo cuando el mismo ticker sale varias veces.

- Es una entrada **derivada**: no se toca ni un dato de los guardados, se calcula al vuelo desde las
  ventas que ya estaban registradas. Nada que migrar, nada que se pueda corromper.
- Trae sus títulos, su precio de compra (el coste del lote), su precio y fecha de venta, su comisión
  y su resultado realizado, y entra en el conteo, en el profit total y en el desglose por ticker.
- No ofrece "Reabrir" ni "Volver a comprar" ni "Lotes": no es una posición, es el registro de una
  venta. Para tocarla se va a la posición de origen.
- La fecha de apertura es la del lote de origen (FIFO). La app no guarda de qué compra concreta salió
  cada venta, así que tres ventas de una misma compra dirán las tres esa fecha. Acordado así.
- Solo se generan desde posiciones **abiertas**: si la posición ya está cerrada del todo, sus ventas
  ya están contadas dentro de ella y duplicarlas sería contar dos veces.

De paso, dos cosas que salieron al verificar:

- En el Histórico, la cifra que va delante de "× N acc" era siempre el último precio de mercado,
  también en operaciones cerradas — o sea el precio de **hoy**, no el de la operación. Una venta de
  FN a $730 se leía "564.73". En cerradas se enseña ahora el **precio de salida**.
- El contador de la pestaña "Acciones" no contaba las ventas parciales: decía (27) mientras justo
  debajo Abiertas (23) + Cerradas (12) sumaban 35. Ahora cuadra.

## Verificación
Chromium (viewport iPhone 390×844) con los datos reales del backup del amigo:
- Histórico → Acciones: **Cerradas (4) → Cerradas (12)**; profit total **+$1.947 → +$5.267**;
  media por operación +$439.
- Aparecen los 9 tickers (SOI, RELY, AVGO, MRVL, FN, ACHR, OXY, GLW, FOXF); antes solo 4.
- Filas correctas y etiquetadas: FN +$1.294 y +$922, MRVL +$318 y +$78, ACHR +$54, OXY +$560.
- Ficha desplegada de la venta de FN: compra $622,08 → venta $730, +17,33% ROI, 27d, +$1.294.
- Sin botones de acción en las derivadas. Sin errores de consola.

Bloques v4.41 — Volver a comprar una acción borraba la operación anterior del Histórico

## El síntoma
Victor: *"los movimientos de compraventa de acciones del mismo ticker no quedan registrados en
operaciones cerradas; si cierras queda el último, pero si vuelves a entrar en esa posición desaparece
del histórico"*.

## La causa
En una acción vendida del todo, el Histórico ofrecía **un único botón: "Reabrir"**. Y `reopenPos` hace
literalmente `closed: false`. Con eso la operación terminada dejaba de ser una cerrada: se esfumaba de
Histórico → Cerradas y sus ventas se arrastraban a la posición reabierta, mezclando dos idas y vueltas
distintas en un solo registro con el BEP promediado.

El botón no estaba mal: "Reabrir" es para deshacer un cierre por error. Lo que faltaba era el botón
para lo que él quería hacer —volver a comprar—, así que usaba el único que había.

**Descartado por el camino** (verificado, no supuesto): crear la posición nueva desde el asistente
**sí** conserva la cerrada. El problema era solo la reapertura.

## El arreglo
En una acción cerrada con ventas registradas, el Histórico ofrece ahora dos botones en vez de uno:

- **"Volver a comprar"** — abre una operación **nueva** (mismo ticker, bloque y broker, sin las ventas
  ni los dividendos de la anterior) y salta directo al editor de lotes con la fila desplegada, para
  meter la compra en dos toques. La anterior se queda archivada con su resultado.
- **"Lotes"** — para corregir: ver las ventas y deshacer una, que sí reabre la posición.

Y el editor de lotes distingue las dos intenciones por sí solo: si se ha pulsado "Deshacer" en alguna
venta es una corrección (reabre); si las ventas siguen igual y aparecen lotes nuevos es una reentrada
(nace posición nueva, con aviso en pantalla explicándolo).

De paso, el lote nuevo **nace desplegado**: antes salía plegado y había que tocarlo antes de escribir.

## Verificación
Chromium (viewport iPhone 390×844), por la interfaz real:
- **Reentrada**: NVO cerrada (100 @ $40 → vendidas @ $50, +$1.000) → "Volver a comprar" 50 @ $55.
  Quedan **dos** posiciones: la cerrada intacta con su venta, y la nueva con 50 acciones, BEP 55 y
  **sin** ventas heredadas. Histórico → Cerradas la sigue mostrando.
- **Acumulación** (lo que él echaba en falta): con dos idas y vueltas cerradas, Histórico → Acciones
  marca **Cerradas (2)**, las lista por separado y suma **+$1.240** (+$1.000 y +$240), win rate 100%.
  "Por ticker" da el mismo acumulado.
- **Corrección**: abrir "Lotes" en la cerrada y pulsar "Deshacer" reabre **esa misma** posición con sus
  100 acciones y sin la venta — no crea ninguna nueva, y no sale el aviso de reentrada.
- Sin errores en consola. `npm run build` ok (`app v4.41`), `node --check dist/app.js` pasa.

Publicación — método nuevo en marcha (no toca la app)

## Qué se ha hecho
Se completó la migración empezada el 6-ago. Publicar ya no pasa por la cola de despliegues de
GitHub Pages: el robot **empuja la carpeta `dist/` a la rama `gh-pages`** y Pages sirve esa rama.

## Por qué costó dos días
Tres cosas, en este orden:

1. **El permiso.** El token del robot estaba en solo-lectura, así que el primer empujón fallaba en
   silencio. Y no se podía cambiar desde los ajustes del repositorio —la opción salía en gris—
   porque estaba fijado en la **organización**: organizations/GaloFly/settings/actions.
2. **Un fallo mío.** En el primer intento encadené el camino viejo detrás del nuevo con `needs:`.
   Si el nuevo fallaba, el viejo ni se intentaba y la app no se publicaba por ningún lado. Corregido:
   fueron independientes durante toda la transición.
3. **GitHub.** Los dos intentos siguientes ni llegaron a arrancar: 15 minutos en cola y cancelados
   solos.

## Estado final
- `gh-pages` creada y verificada: 10 ficheros, v4.40, compilado (0 rastros de `text/babel`, 0 CDN
  externos), `app.js?v=3dbc2428ec`, `vendor/` local, `sw.js`, `manifest.webmanifest` y `.nojekyll`.
- Settings → Pages apunta a `gh-pages` / (root).
- **Camino viejo borrado** del workflow: ya solo queda el job `publicar`.
- Comprobación previa reforzada: además de que `index.html` y `app.js` existan, no estén vacíos y
  lleven marcador de versión, ahora también se rechaza publicar si el HTML viniera **sin compilar**
  (con `text/babel`) — que es justo lo que se sirvió por error durante unos minutos al seleccionar
  `main` en Pages cuando `gh-pages` aún no existía.

## Verificación
- YAML validado; queda un único job y `contents: write`.
- Contenido de `gh-pages` inspeccionado fichero a fichero desde el repositorio.
- La app no se toca: `APP_VERSION` sigue en 4.40.

Publicación — se cambia el mecanismo (no toca la app)

## La pregunta
Victor: *"¿por qué está costando tanto hoy con este proyecto? Con mi otra app no tengo problemas con
nuestros updates"*.

## La respuesta
Ni una sola vez falló el código: las ocho versiones del día compilaron a la primera. Lo que falló
—nueve veces— fue siempre el mismo paso, el de **publicar en GitHub Pages**, de tres formas:
la cola de Pages parada cerca de una hora, un 503 del servicio de credenciales OIDC, y colas de
arranque de 6 minutos.

Y hay tres cosas propias de este proyecto que lo agravan:

1. `actions/deploy-pages` **no empuja ficheros**: crea un despliegue y espera en una cola compartida.
2. Se rinde a los 10 minutos —techo duro, ya se comprobó que no se puede subir— y **al rendirse
   cancela el despliegue**. Como GitHub lo identifica por el commit, ese commit queda inservible
   para siempre. Un fallo obligaba a un commit nuevo entero: un tropiezo se convertía en tres.
3. Se publicaron ocho versiones en un día. Ocho tiradas contra una cola atascada.

## El cambio
Publicar pasa a ser un `git push` de la carpeta `dist/` a la rama **`gh-pages`**, que es lo que
sirve Pages. Sin cola, sin tope de 10 minutos y sin quemar el commit: el mismo commit se puede
reintentar las veces que haga falta.

Se añade además una **red de seguridad** que el camino viejo cubría solo: antes de empujar se
comprueba que `dist/index.html` y `dist/app.js` existen, no están vacíos y llevan el marcador de
versión. Si algo falla, para y no publica, en vez de dejar la web en blanco.

## Transición
De momento conviven los DOS caminos a propósito, para que la web no se quede sin actualizar. Manda
el viejo mientras Settings → Pages siga en "GitHub Actions"; la rama `gh-pages` solo se va llenando.

**Pendiente de una persona:** Settings → Pages → Source: "Deploy from a branch" → `gh-pages` ·
carpeta `/ (root)`. En cuanto esté pulsado hay que **borrar el job `deploy`** del workflow, que a
partir de ahí daría error siempre.

## Verificación
- YAML validado con `yaml.safe_load`; los dos jobs y los permisos salen como toca.
- Ensayo en local de los comandos exactos de publicación sobre el `dist/` real: commit creado con
  los **10 ficheros** correctos (`.nojekyll`, `index.html`, `app.js`, `sw.js`, manifest, iconos y
  `vendor/`), y el marcador leído bien (`APP_VERSION = "4.40"`).
- Ensayo del caso malo: con `dist/index.html` vacío, la comprobación **para con código 1** y no
  publica.
- La app no se toca: `APP_VERSION` sigue en 4.40.

Bloques v4.40 — Fuera los nombres de proveedores de TODA la app

## La petición
Victor, sobre la nota de la v4.39 (*"las otras pantallas siguen nombrando a Finnhub… si también las
quiere sin nombre, es un momento"*): **"Quítalo sí"**.

## Lo que había
La v4.39 limpió el diálogo de rolar. Fuera de ahí quedaban **33 sitios** con el nombre del proveedor
a la vista: los títulos de Ajustes ("Precios (Finnhub)", "Dividendos (Alpha Vantage)", "Lector de
capturas (Gemini)"), las cabeceras de los tres modales de key, los mensajes de error del Comparador
("Finnhub HTTP 429", "Alpha Vantage: límite agotado", "Gemini falló…") y varios avisos sueltos.

Son nombres de fontanería. A él no le dicen nada: quiere saber **qué** no funciona, no **quién**.

## El arreglo
Todo pasa a nombrarse por su función:

| Antes | Ahora |
|---|---|
| `Precios (Finnhub)` | `Precios` |
| `Dividendos (Alpha Vantage)` | `Dividendos` |
| `Lector de capturas (Gemini)` | `Lector de capturas` |
| `Cotizaciones en vivo vía Finnhub` | `Cotizaciones en vivo del subyacente` |
| `API key de Finnhub` | `Key de precios` |
| `Falta la key de Finnhub (Ajustes)` | `Falta la key de precios — actívala en Ajustes → API keys → Precios` |
| `Finnhub HTTP 429` / `Finnhub saturado` | `servicio de earnings saturado (429)` |
| `Alpha Vantage: límite (25/día o 5/min) agotado` | `límite diario agotado (25/día o 5/min)` |
| `Gemini falló: …` | `El lector de capturas falló: …` |
| `Sin earnings de X en el calendario de Finnhub` | `Sin earnings de X en los próximos 60 días.` |

## Dónde SÍ se conserva, y por qué
En dos frases, y solo como **dirección web para conseguir o recopiar la key**:
- `Gratis en finnhub.io/register` (modal de la key de precios)
- `Gratis en alphavantage.co/support/#api-key` (modal de la key de dividendos)
- `Si dice "key inválida", cópiala de nuevo en finnhub.io/dashboard`

Sin esas direcciones el mensaje no se puede accionar: no sabría a qué web ir. Ahí el nombre no es una
firma al pie de un dato, es la señal de la carretera.

## Verificación
- **33 sustituciones** aplicadas (23 + 10), todas confirmadas una a una: el script aborta si alguna
  cadena no aparece tal cual.
- Barrido del `dist/app.js` compilado extrayendo **solo literales de texto**: las únicas apariciones
  que quedan son las tres direcciones web de arriba, los identificadores internos
  (`bloques_finnhub_key`, `gemini-2.5-flash`), las URLs de los endpoints y comentarios del código.
- Chromium (viewport iPhone 390×844) en Ajustes: la sección API keys muestra **Precios · Lector de
  capturas · Dividendos**, y el texto completo de la pantalla no contiene "Finnhub", "Alpha Vantage"
  ni "Gemini". Sin errores en consola.
- `npm run build` ok (`app v4.40`), `node --check dist/app.js` pasa.

Bloques v4.39 — Los avisos del roll, en su idioma y sin nombres de proveedores

## El síntoma
Victor, con captura del diálogo de rolar: *"el aviso de dividendo, que ponga solamente el ticker y
próximo dividendo en fecha y luego el aviso de cuidado a veces los ADRs no aparecen. Que no ponga
nada de Finnhub"*.

Lo que salía:
- `Sin earnings de TEP en los próximos 60 días (Finnhub). Ojo: los ADRs a veces no aparecen.`
- `TEP no reparte dividendo (según Alpha Vantage). ✓`

## La causa
Dos vicios de programador. Primero, **acreditar al proveedor** en cada línea: a él "(Finnhub)" o
"(según Alpha Vantage)" no le dicen nada, son ruido en mitad de la frase. Y segundo, cada caso tenía
**una redacción distinta** ("Sin earnings de X…", "X no reparte…", "Último ex-dividend de X:…"), así
que el ojo tenía que leer la frase entera para saber de qué iba.

Además la coletilla de los ADRs colgaba del aviso de EARNINGS, cuando es al dividendo al que más le
aplica: los ADRs europeos son justo los que suelen faltar en el dato de dividendo.

## El arreglo
Todos los avisos pasan a la misma forma: **`TICKER · qué pasa y cuándo`**.

| Antes | Ahora |
|---|---|
| `Sin earnings de TEP en los próximos 60 días (Finnhub). Ojo: los ADRs…` | `TEP · sin earnings en los próximos 60 días.` |
| `TEP no reparte dividendo (según Alpha Vantage). ✓` | `TEP · sin dividendo.` |
| `Último ex-dividend de TEP: 3 jun 2026 (ya pasado; el próximo aún no…)` | `TEP · último dividendo: 3 jun 2026. El próximo aún no está anunciado.` |
| `⚠️ Ex-dividend de TEP el 15 sept 2026 — DENTRO del nuevo vencimiento.` | `⚠️ TEP · próximo dividendo: 15 sept 2026 — DENTRO del nuevo vencimiento.` |

Y la advertencia de los ADRs se muda al aviso de dividendo, en una segunda línea en gris pequeño,
debajo de todas sus variantes. Ni una mención a Finnhub ni a Alpha Vantage en todo el diálogo. Donde
sí se conserva el nombre es en el aviso de "falta la key", porque ahí hace de indicación para llegar
al sitio: *Ajustes → API keys → Dividendos*, que es como se llama la fila en su pantalla.

## Verificación
Chromium (viewport iPhone 390×844) con una TEP 68P sembrada, abriendo el diálogo de rolar y simulando
las respuestas de las dos APIs (`ctx.route` con regex, que los globs no cubren la query):
- **Con dividendo dentro del nuevo vencimiento**: `⚠️ TEP · próximo dividendo: 15 sept 2026 — DENTRO
  del nuevo vencimiento. Ese día el precio abre descontando el dividendo.` + `Ojo: los ADRs a veces
  no aparecen.`
- **Sin dividendo**: `TEP · sin dividendo.` + la misma coletilla.
- Barrido del texto de la pantalla en los dos casos: **cero** apariciones de "Finnhub" y de "Alpha
  Vantage". Sin errores en consola.
- `npm run build` ok (`app v4.39`), `node --check dist/app.js` pasa.

## Lo que NO toca
Las otras pantallas (Herramientas → Earnings y la fila "Precios (Finnhub)" de Ajustes) siguen
nombrando a Finnhub. Ahí el nombre es el de la key que hay que activar, no una acreditación al pie de
un dato. Si también las quiere sin nombre, es un momento.

Bloques v4.38 — La cabecera "Posiciones · Ver P&L" iba pegada a la primera tarjeta

## El síntoma
Victor, sobre la v4.37: *"muy bien, lo único que Posiciones y Ver P&L se quedan un poco pegados"*.

## La causa
Esa cabecera llevaba `marginBottom: 2`. La equivalente de Exposición —la que él usa de referencia
porque "se lee mucho mejor"— lleva **12**. Medido en pantalla: 2 px contra 12.

Con las filas planas casi no cantaba. Pero la v4.37 acaba de devolverles la sombra, y una tarjeta con
relieve necesita aire alrededor para que el relieve se lea: pegada a 2 px, la cabecera parecía
apoyada encima de la primera tarjeta en vez de titularla.

## El arreglo
`marginBottom: 12`, igual que Exposición. Un número.

## Verificación
Chromium (viewport iPhone 390×844), midiendo el hueco entre el borde inferior de la cabecera y el
borde superior de la primera tarjeta: pasa de **2 px a 12 px**. Sin errores en consola.
`npm run build` ok (`app v4.38`), `node --check dist/app.js` pasa.

## Nota de despliegue
Primer intento caído otra vez con la cola de Pages parada (ver la nota de la v4.35). Reintento con
commit nuevo, sin tocar la app: mismo `APP_VERSION` 4.38 y mismo hash de compilación.

Un efecto secundario que sí funcionó: gracias al `cancel-in-progress: false` de esa misma nota, la
v4.38 **esperó su turno** detrás de la v4.37 en vez de cancelarla. La v4.37 se publicó limpia.

Bloques v4.37 — Las filas de Posiciones cambiaban de forma, y su relieve nunca se llegaba a pintar

## El síntoma
Victor, con dos capturas (Posiciones de B3 y Exposición): *"el menú de las posiciones de cada bloque
es difícil de leer, se pierde uno un poco; el de las exposiciones se lee mucho mejor, ¿igual por el
relieve?"*.

## La causa (no era el relieve)
Las dos pantallas tienen el mismo relieve desde la v4.17. Lo que cambia es la **silueta**:
- **Exposición** tiene siempre tres pisos idénticos: identidad + cifra · franja de chips de bloque ·
  rejilla de métricas. El ojo coge el hábito en dos tarjetas.
- **Posiciones** metía el detalle del contrato en la MISMA línea del ticker, con `flexWrap`. Según lo
  largo que fuera, unas veces cabía al lado de la insignia y otras saltaba solo. En su propia captura:
  MRLN (texto largo) baja a su línea, la QQQ de debajo (texto corto) se queda arriba. Dos tarjetas
  seguidas, dos siluetas distintas. Eso es perderse.

Tres agravantes:
1. En los spreads la estrategia salía **dos veces**: la insignia decía "Call Debit Spread" y la línea
   de debajo volvía a empezar por "Call Debit Spread 12,5/7,5 · JAN 15 '27".
2. `× 10 contr.` ocupaba una línea entera él solo, separado del contrato que describe.
3. Todo gris sobre gris, sin una sola mancha de color que anclara la mirada — mientras que Exposición
   tiene los chips de bloque.

## El arreglo
Silueta fija de tres pisos, igual que Exposición:
- **Piso 1** — identidad: ticker + insignia (ahora con el **color del bloque**, el ancla que faltaba)
  y, a la derecha, capital y % NLV.
- **Piso 2** — contrato **y** cantidad, juntos y siempre en su propia línea, sin el eco del nombre de
  la estrategia.
- **Piso 3** — la rejilla de métricas de siempre.

Más un filete fino sobre las métricas, el mismo recurso que usa Exposición: la tarjeta crece ~8 px y
se lee en dos mitades limpias.

## Y el relieve, que llevaba desde la v4.14 sin verse
Victor, sobre la propuesta: *"la B, pero ¿puedes darle el mismo relieve que tienen en Exposición?"*.

Aquí estaba lo bueno: la fila de posición **ya traía `boxShadow: T.raise`**, exactamente el mismo que
Exposición, desde la v4.14. Nunca se pintó. La culpa es de `SwipeDelete`, el envoltorio que permite
deslizar la fila para eliminarla: lleva `overflow: hidden` (necesario para esconder el botón rojo
mientras no se desliza) y la sombra, que se dibuja FUERA de la caja de la fila, quedaba recortada al
ras del borde. Es el mismo fallo que ya nos comió las sombras en las filas deslizables de pestañas.

Medido en las capturas de Victor, muestreando la luminancia del hueco entre dos tarjetas:
- Exposición: `45 · 9 10 11 12 13 14 15 16 17 · 46` — el degradado de la sombra, caída de 37.
- Posiciones: `46 · 24 24 24 24 24 24 24 24 24 · 46` — plano. Ni rastro.

El arreglo: sombra y filete pasan al envoltorio `SwipeDelete`. `overflow: hidden` recorta a los
descendientes, **no** la sombra del propio elemento, así que ahí sí se pinta.

## Verificación
Chromium (viewport iPhone 390×844) con las cinco posiciones de B3 de su captura sembradas (MRLN Call
Debit Spread, tres QQQ DD/DC y una SPX DC):
- Las cinco tarjetas salen con la misma silueta, el eco de "Call Debit Spread" desaparece y la línea
  larga de la QQQ (`P 665/660 · C 715/720 JUL 31 '26 · ×1 contr.`) entra en una sola línea.
- El hueco entre tarjetas mide ahora `9 9 9 10 10 11 11 12 13 13 13 14 15 15 15…`, **idéntico** al de
  Exposición en la misma escala. Caída de 37 en las dos.
- Sin errores en consola. `npm run build` ok (`app v4.37`), `node --check dist/app.js` pasa.

Bloques v4.36 — "Resolver → Editar" tampoco hacía nada

## El síntoma
Victor, probando la v4.35: *"Resolver y cerrar funciona pero Resolver y editar no hace nada"*.

## La causa
La v4.35 arregló Cerrar y Rolar, pero **Editar se quedó fuera**, y por el mismo motivo. Editar no
abre ninguna ventana propia: despliega el formulario **dentro de la fila** de la posición, y esa fila
solo existe en la pestaña de su bloque. Desde Vencimientos se marcaba la posición como editable… y
no había ninguna fila en pantalla donde verlo.

(`Lotes` y `Dividendos` no sufren esto: esos sí abren su propia ventana por encima de todo.)

## El arreglo
Editar hace ahora el mismo viaje que Cerrar y Rolar: salta a la **pestaña del bloque**, cambia a
Portfolio y **desplaza la fila hasta la vista**.

Con una trampa que hubo que esquivar: el atajo que cambia de pestaña tiene un re-tap deliberado
—"volver a tocar la pestaña activa cierra todas las ediciones abiertas"— que aquí habría cerrado la
edición recién abierta si ya estabas en ese bloque. Ahora solo se cambia de pestaña cuando de verdad
hace falta.

Y el desplazamiento se ajusta al caso: para Cerrar/Rolar la fila se **centra** (la hoja es pequeña);
para Editar se alinea **arriba** y con algo más de espera, porque el formulario es largo y centrarlo
dejaría su cabecera fuera de pantalla.

## Verificación
Chromium (viewport iPhone 390×844), dos escenarios:
- **Desde Vencimientos** → Resolver en la TMDX (B2) → Editar: aterriza en Portfolio, pestaña
  **Bloque 2 · Income**, con "Editar posición" abierto sobre la TMDX.
- **Ya dentro de B2**, tocando la fila → Editar: la edición se abre y **no** se borra por el re-tap.
- Sin errores en consola. `npm run build` ok (`app v4.36`), `node --check dist/app.js` pasa.

## Nota de despliegue
GitHub Pages seguía inestable ese día (ver la nota de la v4.35). El primer intento de publicar esta
v4.36 volvió a morir con la cola parada a los 10 minutos, así que hizo falta un commit nuevo para
reintentarlo — el anterior queda inservible en cuanto el robot cancela su despliegue. Nada de la app
cambia entre uno y otro: mismo `APP_VERSION` 4.36 y mismo hash de compilación (`7a3df6ed03b3`).

Bloques v4.35 — Los botones "Resolver" de Vencimientos no hacían nada

## El síntoma
Victor, con captura del banner ⏰ *"2 opciones vencieron y siguen abiertas"*: *"los botones de
Resolver no hacen nada, deberían llevarte al movimiento y marcarlo, o al menú de cerrar / editar /
rolar"*. Se pulsaba y no pasaba absolutamente nada — ni menú, ni error, ni aviso.

## La causa (dos fallos encadenados)
1. **El menú no llegaba a abrirse.** `openSheet()` espera la POSICIÓN entera y hace `p.id` dentro.
   El banner le pasaba el id ya suelto: `openSheet(pp.id)`. Dentro salía `undefined.id` →
   `undefined`, el estado quedaba a nulo y el menú simplemente no se montaba. Silencioso.
2. **Aunque se abriera, "Cerrar" y "Rolar" se perdían.** Esas dos acciones no abren nada ahí mismo:
   dejan una *acción pendiente* y navegan a Portfolio, porque el formulario vive en la fila de la
   posición. Pero la acción pendiente solo la recoge la tarjeta del bloque correspondiente, y
   Portfolio abre siempre en **Resumen** — donde no hay ninguna tarjeta de bloque. La acción se
   quedaba colgada y el efecto seguía siendo "no hace nada".

## El arreglo
- El banner pasa la posición entera. Y `openSheet()` acepta ya indistintamente la posición o su id,
  para que un llamador despistado no vuelva a fallar en silencio.
- Al elegir Cerrar / Rolar / operar una pata, la app **salta a la pestaña del bloque** de esa
  posición antes de navegar a Portfolio.
- La fila **se desplaza sola hasta quedar centrada en pantalla** al abrirse su formulario: si el
  bloque tiene muchas posiciones, antes el formulario se abría fuera de la vista.

## Verificación
Chromium (viewport iPhone 390×844), sembrando las dos QQQ vencidas de su captura más una short put
vencida:
- El banner sale con sus 3 botones; al pulsar **Resolver** se abre el menú de la posición.
- Un DC/DD ofrece *Cerrar · Editar · Eliminar*; una short put ofrece además **Rolar** (correcto: un
  riesgo definido no se rola).
- Pulsando **Cerrar** en la QQQ (B3) → Portfolio, pestaña **Bloque 3**, formulario "Cerrar QQQ"
  abierto. En la short put (B2) → pestaña **Bloque 2**, formulario "Cerrar TMDX". Sin errores.
- `npm run build` ok (`app v4.35`), `node --check dist/app.js` pasa.

## Nota de despliegue (mismo día, sin tocar la app)
La publicación de esta v4.35 falló **cinco veces seguidas**, y no por el código: GitHub Pages se quedó
**10 minutos con el despliegue en cola** hasta que el robot abortó por tiempo. Al abortar, canceló
el despliegue — y GitHub identifica cada despliegue por el commit, así que ese commit quedó marcado
como cancelado **para siempre**: todos los reintentos contestaban ya "Deployment cancelled" y hacía
falta un commit nuevo para desatascarlo.

Retocado `.github/workflows/build-and-deploy.yml`, sin tocar ni una línea de la app:
- **`cancel-in-progress: false`**: si llega otro empujón mientras hay un despliegue en vuelo, ahora
  espera su turno en vez de cancelarlo. Cancelar era justo lo que envenenaba el commit.
- Se intentó subir la espera de 10 a 20 minutos y **no se puede**: la propia acción lo rechaza
  ("timeout set to the maximum of 600000 milliseconds"). 10 minutos es techo duro. Queda anotado en
  el propio workflow para no volver a intentarlo.

Con eso, si Pages se atasca más de 10 minutos no hay ajuste que valga: toca esperar a que el
servicio se recupere y empujar un commit nuevo. Lo que pasó ese día: la cola de Pages estuvo
**cerca de una hora** sin mover ficha, con cinco intentos seguidos muriendo igual.

**Reintento** (a petición de Victor, "haz commit"): este commit no cambia nada de la app —
`APP_VERSION` sigue en 4.35 y el código compilado es idéntico. Existe solo para estrenar un commit
limpio con el que Pages pueda publicar, ya que los anteriores quedaron marcados como cancelados.

Bloques v4.34 — Relieve en las fichas de fecha de Vencimientos (se veían planas en oscuro)

## El síntoma
Victor, con captura en modo oscuro: *"se ve un poco mal aquí, ¿darías algo de relieve?"*. Las fichas
de cada fecha eran rectángulos grises planos pegados al fondo casi negro, sin nada que las separase.

## La causa
Esa vista se quedó fuera del repaso de relieve de la v4.11–v4.29. Las fichas de fecha iban en
`T.tile` **sin sombra ni filete**, pese a que son pulsables (se despliegan). Rompían la regla de la
casa: *lo interactivo se ELEVA, lo estático se hunde*. Y dentro, las filas sin semáforo (las que no
tienen precio, como un DC/DD) iban con fondo `transparent`, así que flotaban sueltas al lado de las
tintadas de rojo/verde.

## El arreglo
- **Fichas de fecha**: mismo trato que las filas de Exposición, que él ya aprobó — `T.card` +
  `T.raise` + `T.edge`. El filete es lo que de verdad las dibuja en oscuro; la sombra las despega.
- **Filas de dentro**: todas pasan a ser sub-tarjetas con `T.raiseSm`, y las que no tienen semáforo
  usan `T.tile` en vez de transparente. El color sigue siendo el único canal del semáforo (rojo =
  strike superado, verde = a salvo, gris = sin precio); el relieve solo las hace tangibles.

## Verificación
- Chromium (viewport iPhone 390×844) en **oscuro y en claro**, con las posiciones de la captura más
  un DC sin precio para probar la fila sin semáforo: las fichas se despegan del fondo en los dos
  temas y las filas grises ya no flotan. Sin errores en consola.
- `npm run build` ok (`app v4.34`), `node --check dist/app.js` pasa.

Bloques v4.33 — En Vencimientos, el BEP ya no se parte por la mitad

## El síntoma
Victor, con captura de Vencimientos: *"el BEP se salta de página"*. En las filas desplegadas de cada
vencimiento, el salto de línea caía JUSTO entre la palabra "BEP" y su cifra: arriba quedaba
`B2 · ASTS · x 1 63P · Últ $68.38 · BEP` y solo debajo, huérfano, `$56.75`.

## La causa
Toda la fila era UNA sola frase corrida ("bloque · ticker · x N strike · Últ $X · BEP $Y") dentro de
un span con envoltura libre (v5.10, que arregló otro problema: antes el texto largo se salía del
cuadro). Con el ancho del iPhone esa frase no cabe en una línea, así que el navegador la parte por
donde le toca — y le tocaba entre la etiqueta y el número.

## El arreglo
La fila pasa a tener **dos líneas fijas** en vez de una frase que se parte por donde caiga:
- Arriba, **qué es** la posición: `B2 · ASTS · x 1 63P`, con su riesgo alineado a la derecha.
- Abajo, los **precios**: `Últ $68.38  BEP $56.75`, en tono secundario (11px, color apagado).

Cada pareja etiqueta+cifra lleva `nowrap`, así que ninguna puede partirse por la mitad; si algún día
no cupieran las dos juntas, el BEP bajaría entero a la línea siguiente. Las filas sin precio ni BEP
siguen ocupando una sola línea. Ni un cálculo tocado, solo la maquetación.

Al separar el BEP se vio que el mismo salto afectaba también a "Últ" (quedaba arriba y su cifra
sola abajo), por eso los dos precios se han bajado juntos.

## Verificación
- Chromium (viewport iPhone 390×844) con las cinco posiciones de la captura sembradas (ASTS 63P,
  MRVL 195P, ORCL 190P, TMDX 70P, MRLN 7,50P): las cinco filas ocupan exactamente dos líneas y
  ninguna etiqueta se separa de su cifra. Medido en el DOM: cada línea de precios, 15 px de alto = 1
  línea. Sin errores en consola.
- `npm run build` ok (`app v4.33`), `node --check dist/app.js` pasa.

Bloques v4.32 — "Riesgo apertura" y "BEP actual" en la tarjeta del Histórico

## La duda
Victor, sobre una TMDX 70P rolada: *"el riesgo debería bajar igual que el BEP, ¿no? Ahora mismo
solo cuenta el inicial"*. En su tarjeta: Riesgo $6.428 · BEP $62,28.

## Lo que pasaba (y no era un fallo)
Los dos números convivían en el mismo tile SIN decir de cuándo era cada uno:
- **Riesgo $6.428** = el de la APERTURA (strike 70 − prima inicial 5,72 = 64,28 × 100). Es la base
  del ROI, fijada a propósito desde la v5.15: si encogiera con cada roll, el ROI subiría solo por
  rolar, sin haber ganado nada extra, y dejaría de ser comparable entre operaciones.
- **BEP $62,28** = el VIGENTE tras la cadena (70 − 7,72 de prima acumulada).

Y en Portfolio el riesgo SÍ baja con cada roll: esa misma posición cuenta **$6.228** (BEP vigente
× 100), que es lo que alimenta % NLV, EL/NLV, objetivos de bloque y la barra del hero. Verificado
sembrando la posición: cartera $6.228 · histórico $6.428 · ROI +11,99%, idéntico a su captura.

## El arreglo
Solo rótulos, ni un cálculo tocado: el riesgo de las cortas pasa a **"Riesgo apertura"**, y el BEP
a **"BEP actual"** cuando hay cadena de rolls. Se rotula solo cuando de verdad difieren, para no
meter ruido en una posición sin rolar.

## Verificación
- Chromium (viewport iPhone) con la TMDX de la captura sembrada: la tarjeta muestra "Riesgo
  apertura $6.428" y "BEP actual $62,28"; una short put sin rolar sigue diciendo "Riesgo" y "BEP".
- `npm run build` ok (`app v4.32`), `node --check` pasa.

Bloques v4.31 — En oscuro apenas se veía QUÉ estaba seleccionado

## El síntoma
En modo oscuro (captura de Victor en Movimientos → Histórico): "Por estrategia", "Iron Condor",
"Cerradas (45)"… la opción elegida se distinguía a duras penas de las no elegidas.

## La causa
El token `T.dark` es el fondo de lo seleccionado (píldoras, chips, pestañas) y de los botones de
acción. En claro es tinta casi negra sobre crema y canta. En oscuro valía **#2C2D33**, a un paso
del tile de las inactivas (**#1E1F24**): 14 puntos de diferencia, invisible en una pantalla al
sol. El error de base era pensar el modo oscuro como "lo mismo pero más oscuro": ahí lo
seleccionado tiene que ir MÁS CLARO que el fondo, como hace iOS.

## El arreglo
- `T_DARK.dark` pasa a **#4A4C55** — gris medio que se despega del fondo, con blanco encima a
  7,4:1 de contraste. Al ser el token compartido, se arreglan de una vez TODAS las selecciones
  (píldoras de Histórico, filtros de estrategia, chips de broker, USD/EUR, sub-menú de
  Movimientos, barra inferior) y de paso los botones de acción ganan presencia.
- Las píldoras refuerzan la selección por partida doble: la activa en negrita 800 y la inactiva
  en tinta secundaria. Así se lee cuál está elegida aunque el fondo no se aprecie.

## Verificación
- Chromium (viewport iPhone) en oscuro: Histórico con sus cuatro filas de filtros — la opción
  activa se distingue de un vistazo en todas. Revisado también en claro: sin cambios (el token
  claro no se toca). Sin errores de consola.
- `npm run build` ok (`app v4.31`), `node --check` pasa.

Bloques v4.30 — Relieve en oscuro: barras, botones de bloque, histórico y tarjeta de puts

Cuatro cosas que Victor reportó con capturas del modo oscuro.

**1 · Las barras de cada bloque, apagadas.** Medida sobre su captura, la banda roja de la barra
de rango salía en rgb(72,43,45) sobre un fondo de rgb(30,31,36): casi el mismo tono que la
tarjeta. Causa: `bandZones()` era la ÚNICA barra con los rgba del tema CLARO escritos a mano,
así que no pasaba por el refuerzo de oscuro que sí usan las barras EL del Comparador. Ahora usa
el rojo/oro/verde del tema activo, y ese refuerzo sube de +0.24 a +0.36 de opacidad. La banda
roja pasa a rgb(160,67,64) y la verde a rgb(48,120,86). Además la barra crece de 10 a 13px en
los dos sitios donde es protagonista (rango del bloque y EL post) y gana un aro hundido por
encima de los tramos, para que deje de parecer una pegatina plana.

**2 · Los botones de bloque, difuminados.** El botón activo proyectaba un halo de su propio
color de 14px de desenfoque al 38% — de lejos parecía que el botón estaba desenfocado. Se
sustituye por una sombra de contacto nítida de 1px más un resto de color corto y bajo: mantiene
el relieve y recupera el borde limpio.

**3 · El histórico de Movimientos, plano.** Las operaciones eran filas separadas solo por un
filete de 1px; en oscuro no se veía dónde acababa una y empezaba la siguiente. Pasan a
sub-tarjeta elevada (T.raise + filete), el mismo formato que ya usan las filas de posiciones de
Portfolio y las tarjetas de Exposición.

**4 · La tarjeta de puts.** Sus dos barras EL se benefician de todo lo del punto 1. Los cuadros
(Position Size, Return on margin, anualizado) quedaban en rgb(30,31,36) sobre una tarjeta de
rgb(22,23,27) — 8 niveles de diferencia y la sombra interior invisible. Se les añade filete; en
los de color el filete es del propio color, que el gris del tema encima de verde o ámbar
ensucia. El cuadro Riesgo/BEP, que era el único de la tarjeta sin ningún relieve, se hunde
igual que los demás.

## Verificación
- `npm run build` ok (`app v4.30`), `node --check dist/app.js` pasa.
- Chromium en viewport iPhone 13, oscuro y claro, con posiciones y candidatas sembradas en
  localStorage: revisadas la pestaña B1 (barra + botones), el histórico de Short Puts cerradas
  y las tarjetas del Comparador. Sin errores de consola.

Bloques v4.29 — Rótulo de la barra del hero, recortado

Con la mecánica ya entendida (el 9% de B0 = liquidez ÷ capital total en juego, que con
opciones supera el NLV), Victor pide dejar el rótulo en solo "Reparto del capital desplegado"
— fuera la coletilla "· B0 = liquidez".

## Verificación
- `npm run build` ok (`app v4.29`), `node --check` pasa.

Bloques v4.28 — La barra de bloques del hero, rotulada

Victor leyó los % de la barra apilada del hero como "riesgo plausible" y el B0 no le cuadraba
(la liquidez no arriesga). Con razón: la barra reparte el CAPITAL DESPLEGADO — cuánto de lo
que hay en juego vive en cada bloque (B0 = liquidez, B1 = valor de acciones, B2/B3 = capital
comprometido en opciones), como cuota de la suma. Es el mismo reparto que el donut del
Resumen. No es % NLV (con apalancamiento sumaría >100 y la apilada mentiría) ni plausible
(B0 sería siempre 0). Ahora un micro-rótulo sobre la barra lo dice: "Reparto del capital
desplegado · B0 = liquidez".

## Verificación
- `npm run build` ok (`app v4.28`), `node --check` pasa; hero revisado en Chromium.

Bloques v4.27 — El cuadro de fecha del editor, a tamaño

El campo "Fecha de entrada" del editor de posición ocupaba el ancho entero y con más altura
que el resto de campos (captura de Victor). Pasa a media columna y 36px de alto — el mismo
formato que los EditField de al lado — con appearance:none para que iOS no le imponga su
tamaño intrínseco. La celda derecha queda vacía, igual que en la fila de BLOQUE de arriba.

## Verificación
- `npm run build` ok (`app v4.27`), `node --check` pasa; editor revisado en Chromium.

Bloques v4.26 — Signo negativo en el precio de cierre de opciones

Al cerrar un spread (double diagonal, vertical…) el neto puede ser NEGATIVO, pero el teclado
decimal de iOS no tiene tecla "−" y el campo no dejaba ponerlo (captura de Victor cerrando su
DD de QQQ). El campo "Precio recompra $/acc" de la hoja de cierre gana el botón +/− que ya
usan otros campos con signo (el mecanismo `signed` de WizInput) — solo para opciones; el
precio de venta de acciones sigue igual. El resultado estimado y el guardado ya trataban bien
los negativos (todo pasa por `n()`).

## Verificación
- Chromium (viewport iPhone): hoja de cierre de una opción con el botón +/− funcionando —
  alterna el signo y el resultado estimado cambia en consecuencia. Sin errores de consola.
- `npm run build` ok (`app v4.26`), `node --check` pasa.

Bloques v4.25 — Ajustes: filas más juntitas

Ajuste fino sobre la v4.24 a petición de Victor: las filas de Ajustes se compactan — padding
vertical de 14 a 11px y separación entre filas de 10 a 6px — para el ritmo apretado del Setup
de su app de vuelos.

## Verificación
- `npm run build` ok (`app v4.25`), `node --check` pasa; revisado en Chromium, sin errores.

Bloques v4.24 — Ajustes, acabado limpio: filas claras como las tarjetas de posiciones

La v4.23 usaba el tile beige para las filas de Ajustes y, comparado con el Setup de la app de
vuelos de Victor, quedaba menos profesional. Ahora las filas usan el FONDO DE TARJETA (claro)
con filete, la sombra de sub-tarjeta y más aire (radio 16, padding 14, separación 10px) — el
mismo acabado exacto que las tarjetas de posiciones y Exposición. Una sola familia de
superficies en toda la app.

## Verificación
- Chromium (viewport iPhone): Ajustes con filas claras y elevadas, claro y noche, sin errores.
- `npm run build` ok (`app v4.24`), `node --check` pasa.

Bloques v4.23 — Ajustes con relieve: cada fila es su propia tarjetita

Petición de Victor con captura del Setup de su app de vuelos: el menú de Ajustes pasa de
filas planas separadas por filetes a TARJETITAS elevadas — tile con borde hairline, sombra
mínima y aire de 8px entre filas, dentro de cada tarjeta de sección como hasta ahora. Aplica
a todas las secciones (General, Datos, API keys y Zona de riesgo) porque es el componente
compartido SettingsRow.

## Verificación
- Chromium (viewport iPhone): Ajustes con las filas en tarjetita, claro y noche, sin errores.
- `npm run build` ok (`app v4.23`), `node --check` pasa.

Bloques v4.22 — Relieve para los selectores y las filas de totales (Movimientos)

Petición de Victor con capturas de Movimientos: relieve también para estos botones y tiles.
- **Selectores de píldoras** (Todos/B1/B2/B3, Bloque/MKT VL/NLV/Margen, Aportación/Retiro…):
  la opción activa se eleva con sombra propia y bisel de luz; las inactivas, elevación mínima.
  Es el componente compartido, así que TODOS los selectores de la app lo heredan a la vez.
- **Sub-menú de Movimientos** (Primas · MTM · Rendimiento · Histórico): la píldora activa lleva
  ahora relieve también en reposo (antes solo lo tenía al arrastrarla como lente).
- **Filas de totales de Primas/MTM**: las de año (oscuras) con sombra y bisel; las de mes con
  la elevación mínima. Nuevo token `raiseSm` para chips y filas pequeñas.

## Verificación
- Chromium (viewport iPhone): Movimientos → Primas con totales y selectores en relieve, sin
  errores de consola. `npm run build` ok (`app v4.22`), `node --check` pasa.

Bloques v4.21 — FIX: la misma línea recta, ahora bajo los botones de broker

El selector de brokers (Todos · IBKR · DEGIRO) es otra fila deslizable y recortaba la sombra
de sus chips igual que las pestañas de bloques en la v4.20. Mismo arreglo: padding interior
para que la sombra muera suave + márgenes negativos para no mover nada.

## Verificación
- Chromium (viewport iPhone): chips de broker con sombra degradada, sin filo recto.
- `npm run build` ok (`app v4.21`), `node --check` pasa.

Bloques v4.20 — FIX: la línea recta bajo las pestañas de bloques

Con el relieve de la v4.12, la fila deslizable de pestañas (Resumen · B0 · B1…) RECORTABA la
sombra de las píldoras en el borde del contenedor de scroll y quedaba una línea recta antiestética
bajo ellas (captura de Victor). Arreglo: la fila gana padding interior (la sombra muere suave
dentro del área desplazable) y márgenes negativos equivalentes para que la posición visual de las
pestañas no se mueva ni un píxel.

## Verificación
- Chromium (viewport iPhone): pestañas con sombra degradada natural, sin filo recto; el deslizado
  lateral sigue igual. `npm run build` ok (`app v4.20`), `node --check` pasa.

Bloques v4.19 — El banner de covered, mucho más delgado

Mismo banner violeta de siempre (v4.18), pero en versión fina: padding vertical mínimo
(2px), banda de 2px, tipografía un punto menor y el detalle de la call en una sola línea
con recorte si no cabe. Ocupa la mitad de alto y sigue leyéndose igual.

## Verificación
- `npm run build` ok (`app v4.19`), `node --check` pasa; verificado en Chromium con posición
  cubierta — banner de una línea fina, sin errores de consola.

Bloques v4.18 — El banner de covered call, de vuelta al original

La línea "discreta" de la v4.17 no era lo que Victor pedía: quería el banner ORIGINAL (captura
en mano) — tile violeta con banda de 3px y "COVERED" en versalitas + detalle de la call en la
misma línea. Restaurado tal cual estaba antes del rediseño. El resto de la v4.17 (posiciones
con el formato de Exposición) se queda.

## Verificación
- `npm run build` ok (`app v4.18`), `node --check` pasa; verificado en Chromium con posición
  cubierta: banner violeta original de una línea, sin errores de consola.

Bloques v4.17 — Covered discreto + posiciones con el formato de Exposición

Dos peticiones de Victor al ver la v4.16 en vivo:
- **La línea de covered call vuelve a ser discreta**: texto pequeño en violeta ("🛡️ Covered ·
  call vendida: 60C · AUG 28 '26 · 14 contratos"), sin el recuadro morado con banda que gritaba
  más que la propia posición. Con varias coberturas, una línea por call, igual de sobria.
- **Las tarjetas de posiciones adoptan el formato exacto de las de Exposición** (que le
  gustaron): radio 16, aire interior 12 — el swipe de eliminar acompaña con la misma esquina.

## Verificación
- Chromium (viewport iPhone): posición cubierta con la línea discreta y tarjetas idénticas a
  Exposición; sin errores de consola. `npm run build` ok (`app v4.17`), `node --check` pasa.

Bloques v4.16 — Relieve + separación: filete hairline en las filas elevadas

En pantalla real, tarjeta blanca sobre tarjeta blanca: la sombra sola no definía el contorno
y las posiciones parecían haber perdido los separadores (captura de Victor). El remedio es el
de su app de vuelos: **relieve Y borde** — cada fila elevada (posiciones, Exposición, Resumen)
lleva ahora un filete hairline (crema en claro, gris carbón en noche) además de una sombra un
punto más presente. Elevadas, separadas y limpias — sin bandas de color.

## Verificación
- Chromium (viewport iPhone): filas nítidamente separadas en claro y noche, sin errores.
- `npm run build` ok (`app v4.16`), `node --check` pasa.

Bloques v4.15 — Fuera las bandas laterales de color

Las bandas de 4px al borde izquierdo de la v4.14 (posiciones, Exposición y filas del Resumen)
no convencieron — se retiran las tres. Queda el relieve elevado limpio, que era lo que gustaba.
La información que llevaban no se pierde: el color del bloque sigue en el punto y el badge de
cada fila, y el semáforo de concentración de Exposición sigue en su punto junto al ticker.

## Verificación
- `npm run build` ok (`app v4.15`), `node --check` pasa; revisado en Chromium (viewport iPhone)
  sin errores de consola.

Bloques v4.14 — Las filas de las listas, en relieve ELEVADO con banda de color (como un roster)

Victor, con captura de su app de vuelos: las duty cards elevadas con banda de color al borde
quedan mejor que el hundido de la v4.13 para las listas. Cierto — y deja una regla clara:
**lo interactivo se ELEVA (invita a tocar), lo estático se HUNDE (informa)**.

- **Posiciones de cada bloque**: tarjeta elevada (sombra propia de sub-tarjeta, más suave que la
  de tarjeta grande) con banda de 4px a la izquierda del COLOR DE SU BLOQUE.
- **Exposición por subyacente**: elevadas; su banda izquierda es el SEMÁFORO DE CONCENTRACIÓN
  (verde ≤12% NLV · ámbar ≤20% · rojo por encima) — el punto de color de siempre, ahora visible
  de refilón sin mirar.
- **Filas de bloque del Resumen**: elevadas con banda del color del bloque.
- Los tiles de métricas del hero y la fila de ratios SIGUEN hundidos: son lectura, no botón.
- En modo noche la sub-tarjeta lleva su bisel de luz arriba, como las tarjetas grandes.

## Verificación
- Chromium (viewport iPhone), claro y oscuro: posiciones, Exposición y Resumen con tarjetas
  elevadas y su banda; swipe-eliminar intacto; sin errores de consola.
- `npm run build` ok (`app v4.14`), `node --check` pasa.

Bloques v4.13 — Relieve también en las listas: posiciones y Exposición

Extensión del relieve de la v4.12 a las dos listas que seguían planas (capturas de Victor):
- **Posiciones dentro de cada bloque**: cada posición pasa de "línea con filete" a TILE hundido
  con aire entre filas — se diferencian de un vistazo. El deslizar-para-eliminar conserva la
  esquina redondeada (radius en SwipeDelete, como ya hacía el Comparador).
- **Exposición por subyacente**: sus tarjetitas ganan el mismo hundido.

## Verificación
- Chromium (viewport iPhone), claro y oscuro: lista de posiciones de un bloque y Exposición
  con tiles hundidos y separados; swipe-eliminar sigue funcionando con esquinas redondeadas;
  sin errores de consola. `npm run build` ok (`app v4.13`), `node --check` pasa.

Bloques v4.12 — Relieve: tarjetas que se elevan, huecos que se hunden

Remate del rediseño v4.11, pedido al verlo en vivo ("le metemos un poco de relieve a los menús").
El sistema es de dos capas opuestas:

- **Lo elevado** (tarjetas, pestañas, barra inferior, FAB): sombra doble — una de CONTACTO
  (1-2px, nítida, pega la pieza al suelo) y una AMBIENTE (30-40px, suave, da la altura). En modo
  noche además un bisel de luz de 1px en el borde superior, que es lo que hace que una tarjeta
  oscura sobre fondo oscuro se "despegue".
- **Lo hundido** (tiles de métricas, fila de ratios, filas de bloque del Resumen, tiles genéricos):
  sombra INTERIOR arriba + labio de luz abajo — parecen grabados en la tarjeta.
- La pestaña activa (Resumen/B0/B1…) proyecta ahora sombra de su propio color, como si el color
  del bloque irradiara.
- Barra inferior y FAB: mismo tratamiento (bisel superior + contacto + ambiente más profundo).

## Verificación
- Chromium (viewport iPhone), claro y oscuro, con cartera sembrada: capturas revisadas — el
  relieve se percibe sin ensuciar; sin errores de consola.
- `npm run build` ok (`app v4.12`), `node --check` pasa.

Bloques v4.11 — Rediseño "cabina": jerarquía, color con criterio y micro-detalles (fases A–E aprobadas)

Rediseño visual aprobado sobre maqueta (artefacto "Bloques — Propuesta de rediseño").
Ni una fórmula ni un dato cambian — esto es piel, no motor.

## A · Tarjeta de cuenta
- El valor manda: 33px, dígitos tabulares, y "aterriza" con un contador de 0,4 s al refrescar
  precios o cambiar USD/EUR (con "reducir movimiento" de iOS, quieto).
- El cambio del día pasa a chip verde/rojo ("▲ +$849 · 1,13% hoy").
- Línea de 30 días bajo el valor (snapshots diarios + el valor vivo de hoy como último punto;
  con menos de 2 puntos no se pinta — la app no inventa historia).
- Distribución por bloques compacta: barra apilada con separadores + leyenda B0–B3. Es CUOTA
  DEL DESPLEGADO (no % NLV: con apalancamiento sumarían >100% y una apilada mentiría); el %
  contra objetivo sigue en las tarjetas del Resumen. El donut de abajo no cambia.
- Métricas en rejilla 2×2 (P&L abierto entra; antes flotaba arriba compitiendo con el valor).
  Liquidez (cash/NLV) baja a la fila de ratios como "· liq X%".

## B · Colores de bloque propios
B0 pasa de gris invisible a AZUL ACERO (#3E7CB1); B1 verde profundo #128A45; B2 violeta
#6F5BD8; B3 naranja tierra #C2681E — ya no reciclan los colores semánticos del tema. Las dos
cuaternas (clara y oscura) pasan el validador de visión de color sobre sus fondos.

## C · Tarjetas de bloque del Resumen: identidad ≠ estado
La barra lleva el COLOR DEL BLOQUE, la banda objetivo se dibuja ENCIMA del relleno (antes el
relleno la tapaba) y hay una marca en el valor actual. El estado va en chip: ✓ verde en banda ·
▲/▼ ámbar si el desvío cabe en la banda de tolerancia del bloque · rojo solo si la supera.
Antes, cualquier desvío pintaba la barra ENTERA de rojo y todo gritaba igual.

## D · Modo noche "cabina"
Negro azulado profundo (#0C0D10) con tarjetas elevadas (#16171B), tiles y filetes recalibrados,
verde nocturno #3FBF7F — en vez de la inversión directa anterior.

## E · Micro-detalles
- Todo botón se encoge un 4% mientras lo tocas (transición 0,12 s; respeta "reducir movimiento").
- Cabecera compacta: al bajar ~120px aparece una barra fina de cristal esmerilado con el título
  de la vista y, en Portfolio, el NLV vivo.
- El contador del valor (ver A).
- Los "esqueletos de carga" de la propuesta se descartaron a conciencia: los datos son locales
  y nunca hay pantalla vacía que tapar — habrían sido teatro.

## Verificación (Chromium, viewport iPhone, cartera sembrada + 29 snapshots)
- Claro y oscuro: hero con chip del día, sparkline, barra apilada y rejilla — sin errores de
  consola. El chip del día requiere snapshots con desglose por bróker (los reales lo tienen).
- Resumen: banda visible sobre el relleno de identidad, chips ✓/▲ con el matiz ámbar/rojo según
  la banda de tolerancia de cada bloque.
- Cabecera compacta aparece al bajar y no interfiere con hojas ni modales.
- `npm run build` ok (`app v4.11`) y `node --check` pasa.

Bloques v4.10 — FIX del descuadre REAL: las tarjetas de Ajustes se ensanchaban solas

## El diagnóstico correcto (por fin)
Tu pista del menú deslizador de abajo fue la clave. Medido sobre la captura de las 08:50:
- **Barra inferior: 41px/41px — perfectamente centrada.** O sea, el viewport está BIEN
  (el des-zoom de la v4.09 hizo su parte o nunca fue el problema completo).
- **Tarjetas de Ajustes: 42px/15px** — las tarjetas en sí miden ~9pt de más y sobresalen
  por la derecha. El descuadre era del CONTENIDO de Ajustes, no de la pantalla.

## La causa
Las tarjetas de Ajustes viven en una rejilla CSS con columna automática, y una columna así
se ensancha hasta el texto sin envolver más largo de sus filas. La fila nueva de la v4.06
("Dividendos (Alpha Vantage)", con su subtítulo largo de cuando no hay key) superó el ancho
disponible y estiró TODAS las tarjetas de la página ~9-14pt — por eso el desborde cambió de
tamaño al guardar la key (cambió el texto) y por eso solo pasaba en Ajustes.

## El arreglo
- La rejilla de Ajustes pasa a columna `minmax(0, 1fr)`: clavada al ancho de la página,
  imposible que el contenido la ensanche; los textos largos se recortan dentro.
- El título de cada fila gana el mismo recorte con puntos suspensivos que ya tenía el
  subtítulo, por si algún título futuro no cabe.
Los mecanismos anti-zoom de la v4.07–v4.09 se quedan (protegen del zoom real de iOS, que
también ocurrió — había dos problemas superpuestos, por eso costó aislarlo).

## Verificación
- Chromium (viewport iPhone 390pt): en Ajustes, tarjetas y barra inferior quedan con el
  MISMO ancho; márgenes simétricos verificados midiendo el DOM (14px/14px en ambas).
- `npm run build` ok (`app v4.10`), `node --check` pasa, sin errores de consola.

Bloques v4.09 — FIX definitivo del descuadre: detección por medida y anclaje del viewport

## El síntoma (captura, 08:37)
Seguía descuadrado: contenido pegado a la derecha. Medido con precisión sobre las capturas:
- Portfolio antes del problema: márgenes 42px/42px (14pt/14pt) — perfecto.
- Justo tras usar el modal de la key: 42px/0px — contenido 14pt más ancho que la pantalla.
- Tras la v4.07 y reinicio: 42px/15px — recuperado a medias, pero el lienzo seguía ~9pt
  más ancho que la pantalla física.

## La causa fina
El zoom de iOS no solo amplía: puede dejar el **viewport de layout** (el lienzo donde se
dibuja la app) más ancho que la pantalla, y ese estado sobrevive a recargas e incluso a
reinicios. En esa situación la señal que usaba el des-zoom de la v4.08 (la escala de
visualViewport) puede marcar "todo normal" y no actuar.

## El arreglo
La detección pasa de "escala" a **medida directa**: si el ancho del lienzo
(`documentElement.clientWidth`) difiere del ancho físico de la pantalla (`screen.width`,
ajustado por orientación), el `<meta viewport>` se ancla al número EXACTO de puntos de la
pantalla (p. ej. `width=402` en vez de `width=device-width`) — eso fuerza a WebKit a
recomponer el lienzo a su tamaño real. Se comprueba al arrancar, al cerrar el teclado, al
girar el móvil y **al volver la app del segundo plano**. El toggle de escala de la v4.08 se
mantiene para el caso de zoom simple.

## Verificación
- `npm run build` ok (`app v4.09`), `node --check` pasa, el script llega a dist/.
- Chromium (viewport iPhone): lienzo y pantalla coinciden → el script no toca nada; la app
  arranca y opera sin errores de consola.

Bloques v4.08 — La app se des-zoomea sola (remate del zoom fantasma de iOS)

## El síntoma (captura, 08:30)
Aun con la v4.07, la pantalla seguía viéndose descuadrada: más margen a un lado que a otro y
el menú inferior corrido. No son los márgenes de Ajustes (usa el mismo contenedor que todas
las páginas, 14px por lado): es el **zoom residual** que iOS dejó pegado ANTES del arreglo —
la v4.07 evita zooms nuevos, pero no despega el que ya estaba puesto, y cerrar la app no
siempre lo borra (iOS restaura el estado).

## El arreglo
La app ahora se lo quita sola: si `visualViewport` detecta escala distinta de 1, se re-escribe
el `<meta viewport>` con `user-scalable=0` un instante y se restaura — WebKit recalcula y
devuelve la pantalla a escala 1. Se comprueba en tres momentos: al arrancar, al cerrar el
teclado (focusout, por si un input colara un zoom pese a los 16px) y al girar el móvil.

## Verificación
- `npm run build` ok (`app v4.08`), `node --check` pasa; el script de des-zoom llega a
  `dist/index.html`.
- Chromium (viewport iPhone): la app arranca y opera igual, sin errores de consola (en
  Chromium visualViewport.scale es 1 y el script no toca nada — solo actúa en iOS con zoom).

Bloques v4.07 — FIX: el zoom fantasma de iOS que "desformateaba" el menú de Ajustes

## El síntoma (captura, 08:24)
Tras pegar la key de Alpha Vantage, TODA la app quedaba ampliada y desbordada por la derecha:
etiquetas cortadas ("Cambia…", "Activa…"), el menú inferior recortado, el título fuera de sitio.

## La causa
No era el formato del menú: era **zoom residual de iOS**. Al tocar un campo de texto con letra
menor de 16px, iOS amplía la pantalla automáticamente "para ayudar a escribir" — y en apps
guardadas en pantalla de inicio esa ampliación SE QUEDA PEGADA al cerrar el teclado. El
`maximum-scale=1` del viewport (que ya estaba) no lo impide en modo standalone: iOS lo ignora.
Podía pasar desde siempre con cualquier campo de la app (los de las keys tienen letra de 14px);
tocó justo ahora al estrenar el modal de Alpha Vantage.

## El arreglo
Regla CSS solo para iOS/WebKit (`@supports (-webkit-touch-callout: none)`): **todos los campos
de texto, número, fecha y selectores pasan a 16px** — el umbral a partir del cual iOS no amplía
nunca. En ordenador no cambia nada (la regla no aplica fuera de WebKit táctil).

## Si el zoom ya está pegado en tu pantalla
Una vez: cierra la app del todo (desliza hacia fuera en el selector de apps) y ábrela de nuevo.
El zoom residual se borra con el arranque; con la v4.07 ya no vuelve a aparecer.

## Verificación
- `npm run build` ok (`app v4.07`), `node --check` pasa.
- Chromium (viewport iPhone): la app pinta igual que antes (la regla es solo-WebKit) y los
  modales de keys abren y guardan sin errores de consola.

Bloques v4.06 — Aviso de ex-dividend en la hoja de Rolar (vía Alpha Vantage)

## Qué hace
Al abrir "Rolar" en una posición, debajo del aviso de earnings aparece otro con la **fecha
ex-dividend del subyacente**:
- Si cae DENTRO del nuevo vencimiento → aviso ámbar. En una call corta añade el riesgo real:
  una call ITM con extrínseco menor que el dividendo tiene papeletas de asignación la víspera.
  En una put, recuerda que ese día el precio abre descontando el dividendo.
- Si es posterior al vencimiento → línea neutra con ✓.
- Si la última ex-div ya pasó y la próxima no está anunciada → lo dice tal cual (suelen repetir
  cadencia trimestral).
- Si el ticker no reparte dividendo → también lo dice, y no molesta más.

## De dónde sale el dato
**Finnhub gratis NO da dividendos** (su endpoint de dividendos es de pago) — la fuente es
**Alpha Vantage** (OVERVIEW → ExDividendDate), gratis con 25 consultas/día. La app ya tenía
reservado el hueco para esa key desde la v2.08 pero sin interfaz: ahora hay fila propia en
**Ajustes → API keys → "Dividendos (Alpha Vantage)"** (gratis en alphavantage.co, solo pide un
email). La key viaja en el backup como las de Finnhub y Gemini. Caché por ticker y sesión para
no quemar el cupo; si el cupo diario se agota, el aviso lo dice en vez de callar.

## Verificación (Chromium, viewport iPhone, Alpha Vantage simulado)
- Short put sembrada en B2 → hoja Rolar: con ex-div dentro del vencimiento sale el aviso ámbar;
  con fecha posterior, la línea neutra ✓; sin key, la pista de activarla en Ajustes.
- Ajustes → API keys: la fila nueva abre su modal, guarda la key y cambia a "Key guardada".
- `npm run build` ok (`app v4.06`) y `node --check` pasa. Sin errores de consola.

Bloques v4.05 — FIX: al reabrir, el iPhone resucitaba la versión vieja y re-ofrecía la actualización

## El síntoma (capturas del iPhone, 08:05)
Ya actualizado a la v4.04, cada apertura volvía a enseñar el splash de la v4.03 ofreciendo
"Actualizar a v4.04" — como si la actualización nunca hubiera quedado aplicada.

## La causa
La caché HTTP del navegador. GitHub Pages sirve los archivos con permiso de caché de 10
minutos, y el service worker pedía la red con `fetch(req)` a secas — petición que el navegador
puede responder desde su caché HTTP sin salir a internet. La apertura normal de la app pide
siempre la puerta de entrada "./", cuya copia guardada era la v4.03; la actualización, en
cambio, navega a una URL con parámetros anticaché (una "puerta lateral"), así que la entrada
"./" de la caché nunca se renovaba. Resultado: abrir → arranca la v4.03 de la caché → detecta
la v4.04 → la ofrece → actualizas por la puerta lateral → reabres → otra vez la v4.03.

## El arreglo
El service worker pide ahora TODO con `cache: "no-cache"`: revalida contra el servidor en cada
apertura (si el archivo no cambió, el servidor responde "304, usa lo tuyo" — baratísimo) y la
caché propia del SW queda solo como respaldo sin red, que era su papel. También la
pre-descarga de la instalación revalida, para no sembrar la caché del SW con copias rancias.

## Verificación
- `npm run build` → `build ok — app v4.05`; `node --check` pasa; `dist/sw.js` contiene los
  `cache: "no-cache"` y el manejo especial de navegaciones (mode "navigate" no admite init).
- Chromium (viewport iPhone): arranque online normal, y arranque OFFLINE servido por el
  service worker nuevo — ambos sin errores de consola.

## Transición en el teléfono
La primera apertura tras este deploy aún puede pasar una vez por la caché vieja (el robot
nuevo se instala en segundo plano en esa misma apertura). Desde la segunda apertura, la
puerta de entrada se revalida siempre y el síntoma desaparece.

Bloques v4.04 — Fuera el splash: la app abre directa; el aviso de versión nueva pasa a ser una barrita

El splash de arranque (v4.00–v4.03) se retira entero — con la app compilada la carga ya es
rápida y la pantalla intermedia no aportaba. La app abre directamente en la cuenta.

Lo único que se conserva es lo útil: al arrancar se sigue comprobando en segundo plano si hay
versión nueva y, SOLO si la hay, aparece una barrita discreta arriba con el icono, "Versión
nueva: vX.XX", el botón **Actualizar** (la baja con parámetros anticaché, el arreglo de la
v4.03 sigue intacto) y una ✕ para descartarla (se vuelve a ofrecer en la próxima apertura).
Si no hay nada nuevo, no se ve absolutamente nada.

## Verificación
- `npm run build` → `build ok — app v4.04`; `node --check` pasa; `app.js?v=<hash>` y marcador
  APP_VERSION presentes en `dist/index.html`.
- Chromium (viewport iPhone): sin versión nueva la app abre directa, sin splash ni overlay
  alguno. Simulando un servidor con v9.99: aparece la barrita con "Actualizar" (navega con
  anticaché) y ✕ (la cierra). Sin errores de consola en ningún caso.

Bloques v4.03 — FIX: la app se quedaba clavada en "actualizando…" · ahora pregunta antes de actualizar

## El síntoma
Al abrir la app tras publicarse una versión nueva, el splash se quedaba fijo con "Hay una
versión nueva — actualizando…" y de ahí no pasaba (captura del iPhone a las 07:52).

## La causa (dos mitades)
1. **GitHub Pages cachea los archivos hasta 10 minutos.** El detector de versiones pide el
   index.html por red saltándose la caché (con `?_cachebust`), así que VEÍA la versión nueva…
   pero al recargar la página, el `app.js` (donde vive el código de verdad desde el pipeline
   v4.00) volvía a salir de la caché con la versión VIEJA. Resultado: detecta nueva → recarga
   → sigue corriendo la vieja → detecta nueva → recarga… bucle hasta que la caché caducara.
2. El script de auto-actualización recargaba SOLO, sin preguntar — por eso el bucle se veía
   como una pantalla clavada en vez de como un aviso.

## El arreglo (dos mitades, como la causa)
1. **`build.mjs` referencia app.js con su hash** (`app.js?v=abc123…`): cada index.html nuevo
   exige exactamente su app.js, la caché no puede colar el viejo. La actualización aplica a la
   primera.
2. **Ahora la actualización se OFRECE, no se impone** (como pediste): si el splash detecta
   versión nueva, se queda abierto con dos botones — "Actualizar a vX.XX" (la descarga y
   recarga) y "Ahora no" (sigues con la actual y te lo volverá a ofrecer en la próxima
   apertura). La recarga automática del final del body se retira; el botón manual "buscar
   actualización" de Ajustes sigue igual.

## Verificación
- `npm run build` → `build ok — app v4.03`; `node --check` pasa; `dist/index.html` referencia
  `app.js?v=<hash>` y conserva el marcador APP_VERSION.
- Chromium (viewport iPhone), simulando un servidor con versión más nueva: el splash se queda
  abierto ofreciendo "Actualizar a v9.99" / "Ahora no"; "Ahora no" cierra y deja la app usable;
  "Actualizar" navega con parámetros anticaché. Sin versión nueva: "Estás en la última versión"
  y el splash se retira solo a los 2 s. Sin errores de consola en ningún caso.

Bloques v4.02 — Splash aún más traslúcido: la app se ve casi nítida detrás

Tercer ajuste fino del splash: el velo baja de 35% a 15% de opacidad y el difuminado de
22px a 7px — ahora la cuenta se ve claramente detrás del icono, solo con un suavizado
ligero, como pediste ("casi se pueda ver la app").

## Verificación
- `npm run build` compila (`build ok — app v4.02`) y `node --check` pasa.
- Chromium (viewport iPhone): la cuenta se distingue con claridad detrás del splash
  (velo 15% + blur 7px), icono y "v4.02" legibles, y desaparece a los 2 s sin errores.

Bloques v4.01 — Splash: sin título y con la app difuminada de fondo

Dos retoques al splash de la v4.00, pedidos nada más verlo:
- **Fuera el texto "Portfolio + Comparador"** — queda el icono, la versión y el estado de
  actualización, nada más.
- **El fondo ya no es opaco**: el velo pasa de 82% a 35% de opacidad, así el difuminado deja
  ver la cuenta (la app real) detrás, como un cristal esmerilado de verdad. La versión y el
  mensaje pasan a color tinta para que se lean bien sobre el velo más claro.

## Verificación
- `npm run build` compila (`build ok — app v4.01`) y `node --check` pasa.
- Chromium (viewport iPhone): el splash muestra solo icono + "v4.01" + "Estás en la última
  versión", el contenido de la app se distingue difuminado detrás, y desaparece a los 2 s.

Bloques v4.00 — Aportaciones editables (con comisión) + splash de arranque con versión

## Aportaciones y retiros: ahora editables
Cada movimiento ya registrado en 💶 Aportaciones tiene un botón de editar (lápiz) junto a la ✕.
Al tocarlo se abre el mismo formulario que al añadir un movimiento nuevo — fecha, Aportación/Retiro,
Efectivo/Acciones, importe, bróker, **comisión** y nota — y los cambios se aplican al instante
(no hace falta un botón de guardar aparte, "Hecho" solo cierra el panel). Antes, si te equivocabas al
apuntar un importe o una comisión, la única forma de arreglarlo era borrar el movimiento y crearlo de
nuevo. Los totales (Aportado, Retirado, Neto, Comisiones) y el gráfico acumulado se recalculan solos
con cada edición.

## Splash de arranque
Al abrir la app aparece dos segundos una pantalla con el icono de Bloques sobre el fondo difuminado,
la versión instalada (v4.00) y si es la última disponible — usa la misma comprobación de red que
"buscar actualización", solo que aquí es automática y no hace falta pulsar nada. Pasados los 2 segundos
se retira sola y se ve la app de siempre debajo. Es solo informativo: si detecta una versión más nueva,
la recarga real la sigue haciendo el aviso de auto-actualización de siempre (sin cambios ahí).

## Verificación
- **build**: `npm run build` compila sin errores (`build ok — app v4.00`), `node --check` sobre el
  JS compilado pasa.
- **Chromium (viewport iPhone)**: splash visible desde el primer frame con el icono, "v4.00" y
  "Estás en la última versión", y desaparece a los 2 segundos exactos, sin errores de consola.
- **Aportaciones**: registrado un movimiento con comisión, edición en vivo de importe, comisión,
  bróker, fecha y del tipo (Aportación ↔ Retiro, invierte el signo del importe correctamente) —
  totales y lista se actualizan solos tras cada cambio.

Bloques v3.99 — FIX: no se podía añadir Cash al Bloque 0

## El síntoma
Portfolio → ＋ → **B0 · Liquidez → Cash → Cash** → paso 3: el botón **"Añadir a Bloque 0"** salía
gris y no respondía, por mucho importe que se escribiera.

## La causa
El ticker del cash **no es un campo editable**: en el paso 3, cuando la naturaleza es `CASH`,
se pinta un `div` fijo con el texto "CASH" (v2.15, decisión tuya). Alguien tiene que escribir
`wizForm.tkr = "CASH"` por detrás.

El único sitio que lo hacía era el botón **"Continuar"** del caso *"esta naturaleza no tiene
estrategias"* (`STRATS[wizBlock].filter(...).length === 0`). Pero **B0 sí tiene estrategias**
(`STRATS[0] = ["Treasury ETF", "Money Market", "Cash"]`), así que ese botón nunca aparece: se
entra al paso 3 por la *pill* de estrategia "Cash", que fijaba `wizStrat` y `wizStep` pero
**no tocaba el ticker**.

Resultado: `wizForm.tkr` vacío → `disabled={!(wizForm.tkr || "").trim()}` → botón muerto para
siempre, sin ninguna forma de rellenarlo desde la interfaz. `wizSave()` estaba bien (ya guarda
`tkr: "CASH"` por su cuenta); el bloqueo era puramente de la validación.

## El arreglo (dos capas)
1. **Siembra en la pill de estrategia**: al elegir una estrategia cuya naturaleza es `CASH`,
   el `setWizForm` que ya limpiaba `er` ahora también escribe `tkr: "CASH"`.
2. **Cinturón y tirantes en el botón**: la condición de habilitado pasa a
   `wizNat === "CASH" || natFromStrat(wizStrat) === "CASH" || ticker escrito`.
   Aunque cualquier otra ruta futura llegue al paso 3 sin sembrar, el cash se puede guardar.

El resto de estrategias siguen exigiendo ticker exactamente igual que antes.

## Verificación
- **babel OK** (compilación completa del bundle JSX).
- **Reproducción previa**: el mismo test corrido contra la v3.98 falla en 3 puntos —
  botón deshabilitado, nada guardado, wizard sin cerrar.
- **Test jsdom del flujo Cash (v3.99)**: FAB → B0 → Cash → Cash → paso 3 → botón habilitado →
  importe 7960 → guardar → posición en `bloques_pos_v5` con `tkr: "CASH"`, `block: 0`,
  `nat: "CASH"`, `mktValue: "7960"`, broker IBKR, y wizard cerrado. 13/13.
- **Test de regresión**: B1 → Crédito → Short Put → el botón sigue deshabilitado sin ticker y
  se habilita al escribir AAPL. 5/5.


## Bloques v3.98 — Todo en POP cruda al open: filtro, chip y tarjeta

Revierte la decisión de la v3.97 (que unificó hacia la suavizada) y unifica hacia el otro lado, el que querías: **la cifra visible es la POP CRUDA al open** (1 − roturas/N), la misma con la que filtras.

- **Screener**: filtra y muestra la cruda. Rótulo: "POP open cruda ≥ N% (la misma del calendario)".
- **Chip del calendario**: la cruda. Ya no depende de si el ticker tiene idea guardada (esa venía suavizada), así el número no cambia según el estado del ticker.
- **Tarjeta**: la barra dice "POP open · cruda" y muestra la misma cifra que el chip.
- **La suavizada (Laplace) sigue viva donde toca**: el EV, el veredicto GO/CAUTION y la fila "POP open · crudo → usada" de Earnings, que es el sitio donde se explica la diferencia. Ese es el punto: la usas para decidir tamaño y veredicto, pero ya no aparece como cifra suelta que contradiga a otra.

En el detalle del Screener las 4 POP por serie siguen crudas con su X/N, y la línea de debajo aclara "Filtro y calendario usan la cruda · suavizada (la del EV/veredicto)".

## Verificado (jsdom)
Ticker borde (82% cruda / 77% suavizada) y limpio (100% / 92%):
- El corte del filtro cae en la **cruda**: con 80% el borde ENTRA (82 ≥ 80), con 85% queda fuera.
- Screener muestra 82% y en ningún sitio aparece 77% como cifra principal.
- Chip 82%, barra de la tarjeta "POP open · cruda 82%", detalle con "POP open · 9/11".
- La fila "crudo → usada" sigue enseñando 82% → 77% al cargar el ticker.


## Bloques v3.96 — Cuenta compacta y quitar un día ya no se dispara por error

## El número, formateado
- Fuera el chip largo "16 en calendario". En su lugar, una **fracción compacta alineada a la derecha**: `✓ 16/18` — cifras tabulares y ancho fijo, así queda en la misma columna en todas las filas en vez de empujar la fecha a una posición distinta según lo largo del número.
- **Color con significado**: verde si el día está completo, ámbar si va a medias, gris si no has añadido nada. El total ya no se repite dos veces.

## El botón del día
- **Quitar un día pide confirmación.** Antes borraba N tickers de golpe con un solo toque, y el botón caía pegado a la cabecera del día siguiente: de ahí las deselecciones accidentales. Ahora el primer toque arma ("¿Quitar 2?", en rojo) y el segundo ejecuta, con 3 segundos de ventana tras los cuales se desarma solo. Añadir sigue siendo un toque — no destruye nada.
- Textos más cortos ("＋ Añadir día", "✓ Añadidos") y **más aire**: cada fila de día tiene su propio padding y, plegada, fondo propio, de modo que el botón de un día no invade el área táctil del siguiente.

## Verificado (jsdom, 13 comprobaciones)
Chip largo eliminado · añade los 2 del día · fracción "✓ 2/2" · el primer toque en "✓ Añadidos" NO borra · arma con "¿Quitar 2?" · el segundo toque sí borra · el armado caduca a los 3 s y el día sigue intacto · estado parcial muestra "＋ Añadir día (1)" y "✓ 1/2" en ámbar.

## Bloques v3.95 — Días colapsables en el Screener

- **La fecha es el botón**: tocar la cabecera de un día pliega o despliega su lista de tickers. El chevron gira para indicar el estado.
- **Plegado plegado, cuenta a la vista**: con el día cerrado, la cabecera muestra un chip verde "N en calendario" — sabes cuántos de ese día ya has añadido sin abrirlo. El botón "＋ Añadir el día" sigue accesible con el día plegado.
- **Plegar / desplegar todos** (arriba a la derecha, solo si hay más de un día), para no ir uno a uno cuando el barrido trae cuatro o cinco.
- **Persistente**: se guarda la lista de días *plegados*, no de abiertos — así un día nuevo del siguiente barrido llega abierto en vez de aparecer escondido sin que te enteres.

## Verificado (jsdom, 11 comprobaciones)
Cabecera pulsable · plegar oculta solo ese día · el resto sigue visible · persiste en localStorage · desplegar restaura · "Plegar todos" alterna a "Desplegar todos" · el botón de añadir el día funciona plegado · aparece el chip "N en calendario" · al reabrir la app respeta lo guardado y el día nuevo llega abierto.


## Bloques v3.94 — Arreglado el gráfico desaparecido + botón de día en el Screener

## El gráfico y los cuadros (arreglo)
No estaban borrados: el gráfico y la fila de promedios colgaban de `hist[ticker]`. Con un ticker cargado en el **formulario** pero sin entrada en el histórico local (lo que pasa, por ejemplo, si lo quitas del calendario con la ✕ — los campos M/X/U siguen guardados, y por eso las 4 POP seguían pintando), ambos bloques desaparecían en silencio. Eso es lo que se veía con RIVN.

- Ahora hay respaldo: **histórico local primero y, si no está, los events del propio screener.json** que ya está en caché. El gráfico se ve mientras el dato exista en algún sitio.
- Si de verdad no hay histórico en ninguna parte, **se avisa en pantalla** ("Sin histórico de X cargado…") en vez de dejar un hueco mudo.
- El gráfico se dibuja desde **2 earnings** (antes exigía 3).
- Los cuadros son los pedidos: **Ø IV crush · Ø |open| · Ø EM · EM actual**, con el EM actual teñido verde/rojo según pague más o menos vol que la media, y la línea "EM actual ±X.X pts vs Ø EM".

## Screener
- Cada día tiene su botón **"＋ Añadir el día"**: mete de una vez los tickers visibles de ese día (los que pasan tus filtros y traen histórico). Si ya están todos, pasa a "✓ Día en el calendario" y otro toque los quita. Si faltan algunos, el botón lo dice: "＋ Añadir el día (3)".
- El botón de cada subyacente ahora dice **"＋ Añadir al calendario de aperturas"** / "✓ En el calendario de aperturas · tocar para quitar".

## Verificado (jsdom, tres escenarios)
A) Formulario con RIVN e histórico vacío pero screener en caché → gráfico, los 4 cuadros y "EM actual +0.8 pts vs Ø EM" presentes. B) Sin dato en ningún sitio → sale el aviso. C) Screener → botón de día añade los 2 con fecha/sesión, alterna a "Día en el calendario", el segundo toque los quita, y el botón por ticker lleva el texto nuevo.


## Bloques v3.93 — Promedios en cuadros con EM actual, celda ancha en la tarjeta y POP alineada

## Probabilidad · histórico
Nueva fila de cuadros bajo las 4 POP: **Ø IV crush · Ø |open| · Ø EM · EM actual**.
- El EM actual sale del campo EM (que la tarjeta rellena al cargar), sin esperar al spot.
- El cuadro del EM actual se tiñe: **verde** si paga más que la media del histórico, **rojo** si paga menos, con una línea debajo tipo "EM actual +1.0 pts vs Ø EM — este trimestre te pagan más volatilidad que de costumbre".

## Tarjeta
La celda **Ø|open| / ØEM** es más ancha que las otras dos (1fr·1fr·1.45fr): valor y etiqueta entran en su línea sin partirse.

## Calendario
La **POP va en columna fija centrada**: todos los porcentajes alineados en vertical aunque el ticker sea corto o largo — ticker a la izquierda con elipsis, fecha·sesión cerrando a la derecha.

## Verificado (jsdom)
POP en columna fija centrada · tarjeta bajo el chip · cuadros nuevos presentes · "EM actual +1.0 pts vs Ø EM" con histórico de ØEM 5.5 y EM próximo 6.5 · celda ensanchada.

## Bloques v3.92 — Selección manual in situ, chips refinados y Probabilidad arriba

## Fuera la auto-alta (revierte v3.91)
Actualizar el screener **ya no toca el calendario**: los borrados no reaparecen en cada carga. La selección vuelve a ser manual, pero sin fricción:

## "Añadir" sin cambiar de pantalla
- El botón del detalle del screener añade el ticker al calendario **y te quedas en el Screener** para encadenar el siguiente.
- El mismo botón hace de indicador y de quitar: "＋ Añadir al calendario de Earnings" ⇄ "✓ En el calendario · tocar para quitar".
- Guarda fecha y sesión del JSON, así el ticker cae directo en su día.
- Si el ticker no trae histórico del servidor, se mantiene el salto clásico "Añadir a Earnings →" para subir su tabla a mano.

## Recuadros del calendario
- **POP antes que la fecha**: `ADP · 85% · 29·BMO`.
- Van en **columna** y la tarjeta se despliega **justo debajo del recuadro pulsado**, no al final del panel.
- Cada recuadro lleva su **✕** (dos toques: ✕ → "¿Quitar?") que lo saca del calendario — hasta que lo re-añadas desde el Screener con un toque.

## Probabilidad · histórico sube
La sección entera (las 4 POP, la direccional, el gráfico de barras con banda EM, crudo→usada, últimos 6) pasa a estar **justo debajo de Subyacente y expected move**: cargas el ticker y ves el gráfico antes de obtener el spot. Estructura, Sizing y Plan B siguen después.

## Verificado (jsdom)
Cargar screener no auto-añade · añadir in situ guarda calDate/calHour y no navega · botón pasa a "quitar" · chip con POP antes de la fecha · tarjeta justo debajo del chip · ✕ arma y el segundo toque borra · orden de secciones Subyacente → Probabilidad → Estructura.

## # Bloques v3.91 — Chips con fecha·sesión + POP, y auto-alta desde el screener

## Recuadros del calendario
- Cada recuadro pasa a ser **TICKER · 29·AMC · 77%**: día del earnings + sesión y POP open.
- El día del badge es el del **earnings**, no el del panel: en el panel del mié 29 conviven `29·AMC` y `30·BMO` — se ve de un vistazo qué reporta esa tarde y qué reporta a la mañana siguiente.
- La POP es la misma que enseña la tarjeta (la de la idea si existe; si no, la suavizada del histórico), con su color por tramos (≥70% verde, ≥50% ámbar, resto rojo).

## Auto-alta al actualizar el screener
- Al pulsar **Cargar semana / Actualizar** en el Screener, los tickers que **pasan los filtros vigentes** (cap, volumen, POP, día, sesión) se añaden solos a Earnings — te saltas el paso de "Añadir a Earnings" ticker a ticker.
- No contradice la v3.33 (que quitó el volcado indiscriminado de los 164): la selección ahora son tus filtros. Solo entran los que traen histórico del servidor, no se borra nada de lo ya añadido, y el 🗑️ de Earnings sigue siendo la escoba.
- Aviso tras cada carga: "📅 Al calendario de Earnings: N nuevos · M actualizados (según filtros vigentes)".
- Tanto la auto-alta como el botón "Añadir todos" guardan ahora **calDate/calHour del propio JSON**, así el ticker cae directo en su día del calendario (antes el botón masivo los dejaba sin fecha).

## Verificado (jsdom)
Carga del screener con fetch simulado: auto-alta respetando filtros (entra CMG y KO, se queda fuera el de cap baja), calDate/calHour bien guardados, aviso visible, un solo panel de día con `30·AMC` y `31·BMO`, y POP en ambos 

## # Bloques v3.90 — Calendario de aperturas en Earnings

## Qué cambia
El carrusel de tarjetas "Earnings por ticker" se sustituye por un **calendario de aperturas** deslizable por días (mismo gesto de deslizar, mismos dots).

- **Agrupación por día de APERTURA, no de earnings**: el miércoles 29 contiene los AMC del miércoles **y** los BMO del jueves — responde a "¿qué abro hoy a las 15:30?". BMO / en sesión / sesión desconocida se agrupan en la tarde hábil anterior (lunes BMO → viernes).
- Cada día es un panel con su fecha, chip **HOY** cuando toca, "abrir 15:30–16:00 ET · N" y los tickers como **recuadros compactos** ticker + AMC (verde) / BMO (ámbar) / SES.
- **Tocar un recuadro despliega la tarjeta completa bajo ese día** (la tarjeta de siempre: veredicto, POP, crédito/EV/contratos, Ø IV crush, botones Abrir / ⓘ / ✕). Tocar de nuevo la repliega.
- Los tickers sin earnings próximo van al grupo **"Sin fecha"** al final.
- La sincronía se hereda: cargar un ticker desde el Resumen por ticker o llegar con el salto del Screener navega el calendario a su día y despliega su tarjeta.

## Sin cambios
Resumen por ticker, formulario, comparador de anchos, contabilidad y el resto de la app quedan intactos. La tarjeta expandida es byte a byte la del carrusel anterior (ahora función `erCard`).

## Verificado
- Babel transpila OK (script 931KB).
- Test node de la agrupación (10 casos: AMC hoy, BMO víspera, salto de fin de semana, sesión desconocida, fecha pasada, sin fecha).
- Smoke jsdom: montaje, navegación a Herramientas → Earnings, sección visible, badges AMC/BMO, grupo Sin fecha, desplegar y replegar tarjeta.


## Bloques — CHANGELOG v3.88 (27-jul-2026)

## El selector de cristal, también en Movimientos y Herramientas

Los dos eran el mismo patrón que la barra inferior (fila de botones, el activo
con fondo `T.dark`), así que en vez de copiar el efecto dos veces vive ahora en
un componente único, **`GlassSegmented`**, que usan los dos:

- **Movimientos** — Primas · MTM · Rendimiento · Histórico
- **Herramientas** — Puts · Earnings · Screener · Alertas

Mismo comportamiento que la barra de abajo desde la v3.87: en reposo el pill
sólido de siempre; al arrastrar, lente esférica que crece, se redondea,
desenfoca el fondo y aumenta la pestaña de debajo; sigue al dedo en posición
continua —si paras entre dos, se queda ahí— e imanta solo al soltar; y el
estirón depende de la velocidad, relajándose al frenar.

### Dos diferencias deliberadas con la barra inferior

Estos selectores viven **dentro de la página**, no fijos al viewport:

- **`touch-action: pan-y`** en vez de `none`. Con `none`, empezar un scroll
  vertical con el dedo sobre el selector se habría quedado muerto — el gesto
  vertical sigue siendo del scroll y solo el horizontal es nuestro.
- **Crecimiento algo menor** (1,08 × 1,30 frente a 1,10 × 1,38) porque la fila es
  más baja que la barra de navegación.

`GlassSegmented` va **a nivel de módulo** (lección de la v3.73): definido dentro
de otro componente se remontaría en cada render.

## Verificación

- Babel 0 errores, montaje jsdom 0 errores.
- 14 comprobaciones sobre el componente: reposo sólido y en la pestaña activa;
  `touch-action` que no bloquea el scroll; al arrastrar redonda, crecida, con
  blur y sin halo de color, sin animar el transform, con la lupa aumentando la de
  debajo y encogiendo a las vecinas; **no** selecciona hasta soltar; parada entre
  dos se queda en la posición 1,50 y deja de estirarse; al soltar imanta a la más
  cercana; y el tap simple sigue seleccionando.
- SSR de `MovimientosView` con los datos reales del backup: las 4 pestañas
  siguen ahí, usa el selector nuevo y la burbuja parte en la activa.
- Render de `HerramientasView`: sus 4 pestañas sobre el mismo componente.
- Regresión de barra inferior, rendimiento, alertas, distintivos y orden de
  earnings.

`APP_VERSION` 3.87 → **3.88**.


## Bloques — CHANGELOG v3.87 (27-jul-2026)

## 1. Fuera el halo de color

Los `inset` cian y magenta del borde, eliminados. Se queda el relieve en blanco
—especular arriba, rebote abajo y un aro interior tenue— que es lo que da el
volumen de esfera sin teñir nada.

## 2. La burbuja sigue el dedo de verdad

Antes se imantaba: `navHover` guardaba un **índice de celda** (`Math.floor` de la
posición del dedo), así que la burbuja solo podía estar en una de las cinco
posiciones. Si parabas a medio camino, saltaba a la más cercana.

Ahora `navHover` es una **posición continua** — 2,37 significa entre la celda 2 y
la 3 — y la burbuja va exactamente donde está el dedo. **Si paras entre dos
pestañas, se queda ahí.** El imantado ocurre solo al soltar, saltando a la
pestaña más próxima.

Tres cambios que van con esto:

- **`posFromX`** sustituye a `idxFromX`: devuelve la posición en unidades de
  celda con decimales, con el centro de la burbuja bajo el dedo y tope en los
  extremos para que no se salga de la barra.
- **El `transform` no se anima mientras arrastras.** Antes tenía una curva de
  0,30 s con sobreimpulso, que con seguimiento continuo se traduce en la burbuja
  yendo por detrás del dedo. Ahora va fotograma a fotograma, y la curva se
  reserva para el imantado al soltar — que es donde sí se quiere ver.
- **El estirón pasa a depender de la velocidad**, no del cruce de celda. Cuanto
  más rápido mueves el dedo más se alarga la gota; al frenar se relaja sola. Es
  lo que hace que parar a medio camino se vea quieto y redondo en vez de
  estirado.

La lupa sigue igual: la pestaña bajo la burbuja (la más cercana a la posición
continua) se agranda y los vecinos se encogen.

## Verificación

- Babel 0 errores, montaje jsdom 0 errores.
- 20 comprobaciones simulando el arrastre, con el caso que pediste medido
  explícitamente: dedo parado justo entre la pestaña 2 y la 3 → la burbuja se
  queda en la posición 2,50 sin imantarse, deja de estirarse al frenar
  (sx 1,40 → 1,10) y sigue siendo lente; al soltar salta a la 3, vuelve a pill
  sólido y rectangular, y el transform recupera su animación.
- Comprobado que ya no queda rastro de cian ni magenta en el borde.
- Regresión de rendimiento, alertas, distintivos y orden de earnings.

`APP_VERSION` 3.86 → **3.87**.


## Bloques — CHANGELOG v3.84 (26-jul-2026)

## Los mini-gráficos de earnings iban al revés

El almacén guarda los eventos **con el más reciente primero** (ver
`mergeErEvents`), y así se queda: hay consumidores que dependen de ese orden.
Lo que estaba mal era la **lectura para pintar** — `ErMiniChart` recibía la
serie tal cual, así que el eje iba de reciente a antiguo y la columna `próx.`
quedaba pegada al evento **más viejo** en vez de al más nuevo.

Con tus datos de NEM/AXP:

```
almacén :  2026/Q1 2025/Q4 2025/Q3 … 2023/Q4 2023/Q3   (+ 2026/Q2 al final)
antes   :  2026/Q1 2025/Q4 2025/Q3 … 2023/Q4 2023/Q3  próx.   ← al revés
ahora   :  2023/Q3 2023/Q4 2024/Q1 … 2025/Q4 2026/Q1  próx.   ✓
```

Nuevo `erChrono` / `erEvsAsc` a nivel de módulo: devuelve una copia en orden
cronológico ascendente, por `date` ISO y, si falta, por `periodo` AAAA/Qn. Los
eventos sin fecha van al final. No muta el array original ni toca el almacén.

## Dos bugs que salieron con el mismo hilo

Los dos venían de código que decía "los últimos N" sobre una serie descendente,
así que cogía **los más antiguos**:

- **`lastP5`** (`erExtraStats`) — el `slice(-4)` que alimenta *post5Red* estaba
  tomando los 4 post-5d más viejos creyendo que eran los 4 últimos.
- **`rec6`** — el contraste "últimos 6 vs histórico" que usas para detectar
  cambio de régimen funcionaba de casualidad: dependía en silencio de que el
  almacén viniera descendente. Ahora la serie va en orden cronológico y
  `rec6 = slice(-6)`, explícito y a prueba de que una fuente cambie el orden.

También queda arreglado el `slice(-12)` del gráfico: con la serie descendente
tomaba los 12 **más antiguos** de un histórico largo. Con 11 eventos no se
notaba; con 20 sí.

## Verificación

- Babel 0 errores, montaje jsdom 0 errores.
- 16 comprobaciones sobre los datos reales de NEM y AXP (incluido el evento
  pendiente `2026/Q2` que el almacén guarda al final y que el filtro descarta
  por no tener `open`): serie ascendente por fecha, primero el más antiguo,
  último el más reciente con datos, ningún evento perdido ni duplicado, y las
  etiquetas del SVG en ese mismo orden con `próx.` al final.
- Comparador: `date` ISO, fallback a `periodo`, sin fecha al final, no muta el
  original, tolera vacío/no-array, y `slice(-12)` sobre 20 eventos devuelve los
  12 más recientes.
- Regresión de las pruebas de rendimiento, alertas y distintivos.

`APP_VERSION` 3.83 → **3.84**.


## # Bloques — CHANGELOG v3.79 → v3.81

## ## v3.83 (25-jul-2026)
La tarjeta **CAGR (TWR)** vuelve a un solo número. Fuera la línea
`total +41,5% · 390 d` de la v3.82.

Estado de la fila de tarjetas:

| Tarjeta | Número | Segunda línea |
|---|---|---|
| CAGR (TWR) | +38,3% | — |
| Máx drawdown ▸ | −31,7% | `= en curso · 55 d` |
| MAR | 1,21 | — |

## v3.82
Eliminados el caption "Vida de la cuenta…" bajo las tarjetas y el cuadro ámbar
"Calidad de la serie". Los distintivos por fila de la lista de snapshots
(`del 26 may`, `≈ reconstr.`) se mantienen.


## v3.81 (25-jul-2026) — Avisos de calidad de la serie de snapshots

Dos cosas distintas que la app calculaba pero no enseñaba, y que importan
porque el pico que fija el Máx DD puede estar apoyado justo en un punto así.

### 1. Snapshots reconstruidos

Los que llevan `nlvEstimated: true` no son fotos de la cuenta: su NLV sale de un
cálculo hacia atrás (`nlvMethod`, p. ej. `backsolve_from_2026-03` con el income
mensual del Excel). Razonable, pero no medido.

### 2. Snapshots con la fecha corrida

Cuando `sourceSnapshotDate ≠ date`, el valor es de otro día del que dice la
etiqueta — el del 31-may guarda el del 26-may, el del 30-jun el del 26-jun. El
tramo que el TWR mide como "un mes" no lo es, y quedan días de mercado entre
medias que no se miden nunca.

### Cómo se ve

- **Resumen ámbar** sobre la lista de snapshots, solo si hay algo que avisar:
  cuántos están reconstruidos, hasta qué fecha, cuántos llevan la fecha corrida
  y un ejemplo concreto. En la serie actual: 12 de 28 reconstruidos y 3 con la
  fecha corrida.
- **Distintivos por fila** al desplegar la lista: `del 26 may` (ámbar) y
  `≈ reconstr.` (gris). Las filas de datos reales salen limpias.

Ningún cálculo cambia. Es información sobre el dato, no una corrección del dato.

---

## v3.80 (25-jul-2026) — Máx drawdown + actual, y las tarjetas dicen de qué periodo son

El Máx DD se queda con el peor de toda la historia, y así debe seguir: es el que
alimenta el MAR. Pero solo con ese número, un −40% ya recuperado hace un año
taparía el −20% que estás pasando hoy — que es el dato con el que se decide.

La tarjeta enseña ahora **dos**:

- **Máx drawdown** — el peor de la vida de la cuenta. Sin cambios.
- Debajo, en pequeño:
  - `= en curso · N d` cuando el peor de la historia es el que se está viviendo.
    **Es el caso hoy: −31,7%, 55 días desde el pico del 31-may.**
  - `actual −X%` cuando el máximo ya se recuperó y hay una caída menor abierta.
  - `en máximos` en verde cuando el último punto es el techo.

Y bajo las tres tarjetas: *"Vida de la cuenta · desde AAAA-MM-DD (N d) — no
siguen al filtro de abajo"*. Estaban encima del selector de periodo y parecían
suyas; no lo son y no deben serlo (anualizar 7 días convierte un 2% en un CAGR
de +181%, y un Máx DD re-basado al mes esconde el techo de verdad).

---

## v3.79 (25-jul-2026) — Alertas: persistencia reforzada

Las alertas ya viajaban en el backup. El problema estaba en de dónde salían.

1. **Eran el único dato de usuario que vivía solo en localStorage.** Todo lo
   demás (posiciones, snapshots, aportaciones) se escribe también en IndexedDB.
   Perdido el localStorage por un desalojo de Safari, se perdían las alertas *y*
   el siguiente backup se exportaba vacío — un borrado temporal convertido en
   permanente. Ahora `saveAlerts` escribe también en IDB, y al arrancar se
   rehidrata localStorage desde IDB si viene vacío.
2. **La herramienta abierta podía deshacer una restauración.** Leía las alertas
   solo al montarse. Ahora cada escritura emite `bloques-alerts-changed` y la
   vista se resincroniza con ese evento y al volver a la app.
3. `saveAlerts` con un valor no válido guarda `[]` en vez de romper.

---

## Verificación (v3.81)

- Babel: 1 bloque, 0 errores. Montaje jsdom: 0 errores.
- SSR de `RendimientoCard`, 19 comprobaciones: datos reales del backup del
  25-jul (CAGR +38,3%, DD −31,7%, MAR 1,21, "en curso · 55 d", 12 de 28
  reconstruidos, 3 con fecha corrida, ejemplo "26 jun"), escenario con el peor
  drawdown ya recuperado, escenario en máximos, serie limpia sin avisos, y las
  guardas de <60 días, 1 snapshot y 0 snapshots.
- Test interactivo jsdom: despliega la lista y comprueba los distintivos por
  fila, incluido que las filas de datos reales salen sin marcas.
- Regresión de las 11 pruebas de alertas de la v3.79.

`APP_VERSION` 3.78 → **3.81**.

## v3.77 — rediseño de la barra de navegación inferior (pedido por Victor)
Tres males, tres arreglos:
	1.	COLOR: fuera el gris-azulado con acento #4C9AF5 ajeno a la paleta. La barra
pasa a crema translúcido del tema (oscuro en tema oscuro) con borde y sombra
suaves, y el pill activo es T.dark con texto blanco — el mismo lenguaje de
chips que usa toda la app.
	2.	AIRE: barra y pill más altos (padding 8px, pill inset 5px, radio 28/22),
label a 10px con más peso — el icono y el nombre ya no van justos.
	3.	FLUIDEZ: el pill deja de animarse con left (fuerza layout en cada frame —
esa era la falta de fluidez) y pasa a transform:translateX(idx·100%) con
willChange — animación en GPU, curva 0.32s con leve sobreimpulso. El
arrastre con el dedo (navHover) se mantiene idéntico, ahora suave.
El punto rojo de Vencimientos toma el borde del color de la barra. Babel +
montaje jsdom con el translateX verificado (v3.77).
v3.78 — retoque de la barra: etiquetas con aire (captura de Victor)
“Vencimientos” a 10px llenaba su celda: tocaba el borde del pill y a las
etiquetas vecinas. Fix: etiquetas a 9px sin tracking, 3px de margen lateral en
cada pestaña y clip de seguridad (nowrap + overflow hidden) para pantallas
estrechas. Babel + montaje jsdom OK (v3.78).

## v3.75 — crédito mínimo DINÁMICO con ideal y ficha ⓘ (caso AXP de Victor)
Problema: la regla del tercio está calibrada para POP ~70% y sobre-exige a los
nombres de POP alta — en AXP (POP suavizada 92.3%, ala 2.5) pedía $0.83 y el
mercado paga ~$0.45: nunca llenaba.
Regla nueva (IC y Credit spread): mín = ancho × (1 − (POP − 10 pts)), con
suelo del 15% del ancho. El colchón fijo de 10 pts entre la POP suavizada y el
win rate mínimo hace que la regla se adapte sola: AXP → $0.44 (llenable);
POP 70% → $1.00 (MÁS exigente que el tercio, como debe). La probabilidad usada
es la QUE MANDA en cada estrategia: IC → POP open suavizada; spread ATM →
direccional suavizada del lado; spread Δ30 → Δ empírica suavizada (opens que
respetaron la corta). Sin histórico → manda el estático.
UI: el panel del ala muestra “mín $X · ideal ⅓ $Y” (el ideal como referencia:
si lo pagan, mejor); el tile del spread “≥ $X · mín sugerido · ideal: $Y”;
check verde/rojo y banner de calidad del sizing juzgan contra el dinámico
(“por debajo del mín — no malvender”). Botón ⓘ en ambos → hoja explicativa con
los números vivos: probabilidad usada, colchón de 10 pts, fórmula, suelo,
ideal, y el aviso de asimetría (una rotura ≈ N ganadores).
Verificado: AXP $0.44 / POP70 $1.00 / suelo $0.38 (sanity), babel, jsdom OK.
v3.76 — fuera el editor manual del histórico + mayor movimiento por serie
	•	ELIMINADO el desplegable “Editar histórico a mano (M · fuera del EM ·
verdes)” — pedido por Victor: ya no tiene sentido, esos campos los rellenan
las tarjetas, la reconstrucción y el screener.json. Los campos siguen en el
estado (applyHist) — solo desaparece el editor de pantalla.
	•	El strip bajo las POP sale ahora en LAS CUATRO series y añade el MAYOR
MOVIMIENTO de la serie seleccionada (magnitud máxima con signo y periodo):
Open/Close mantienen además la direccional verde/rojo; High/Low muestran
“Serie High · mayor +18% (oct24)”.
Babel + montaje jsdom OK (v3.76). (Nota: los histOpens que quedan en código
son otra variable — el array de opens del plan B, sin relación con el editor.)

## v3.74 — FIX del crash “Can’t find variable: sgn” (captura de Victor)
Secuela del movimiento de la v3.73: StrikeTile, ya a nivel de módulo, seguía
usando el helper sgn que es LOCAL de EarningsToolContent → crash al pintar la
pestaña Herramientas. Fix: el signo se calcula inline en StrikeTile (sin
dependencias locales). Añadido al arsenal de verificación el SSR directo del
componente movido — el montaje jsdom no lo cazaba porque la pestaña no se
renderiza al cargar; el SSR del componente sí lo habría cazado (y ahora pasa
con raw vacío y con strike escrito).
Babel + SSR StrikeTile + montaje jsdom OK (v3.74).
v3.75 — crédito mínimo DINÁMICO con ideal y ficha ⓘ (caso AXP de Victor)
Problema: la regla del tercio está calibrada para POP ~70% y sobre-exige a los
nombres de POP alta — en AXP (POP suavizada 92.3%, ala 2.5) pedía $0.83 y el
mercado paga ~$0.45: nunca llenaba.
Regla nueva (IC y Credit spread): mín = ancho × (1 − (POP − 10 pts)), con
suelo del 15% del ancho. El colchón fijo de 10 pts entre la POP suavizada y el
win rate mínimo hace que la regla se adapte sola: AXP → $0.44 (llenable);
POP 70% → $1.00 (MÁS exigente que el tercio, como debe). La probabilidad usada
es la QUE MANDA en cada estrategia: IC → POP open suavizada; spread ATM →
direccional suavizada del lado; spread Δ30 → Δ empírica suavizada (opens que
respetaron la corta). Sin histórico → manda el estático.
UI: el panel del ala muestra “mín $X · ideal ⅓ $Y” (el ideal como referencia:
si lo pagan, mejor); el tile del spread “≥ $X · mín sugerido · ideal: $Y”;
check verde/rojo y banner de calidad del sizing juzgan contra el dinámico
(“por debajo del mín — no malvender”). Botón ⓘ en ambos → hoja explicativa con
los números vivos: probabilidad usada, colchón de 10 pts, fórmula, suelo,
ideal, y el aviso de asimetría (una rotura ≈ N ganadores).
Verificado: AXP $0.44 / POP70 $1.00 / suelo $0.38 (sanity), babel, jsdom OK.

## v3.71 — FIX tamaño de las tiles POP selectoras (captura de Victor)
El anillo de selección de la v3.70 (outline en un envoltorio) no coincidía con
la tile y las cuatro tenían alturas distintas (la de Open, con etiqueta a dos
líneas, era más alta). Fix: las 4 tiles pasan a markup propio idéntico —
estiran a la celda del grid (misma altura siempre) y el borde de selección va
DENTRO, transparente cuando no está activa, así seleccionar no cambia ni un
píxel el tamaño. Colores/tonos como antes (Open coloreada por valor).
Babel + montaje jsdom OK (v3.71).
v3.72 — probabilidad direccional al tocar Open o Close (pedida por Victor)
Al seleccionar la POP Open o la POP Close, sobre el gráfico aparece un strip
con la probabilidad DIRECCIONAL de esa serie: “Abre en verde 5/11 (45%) · rojo
6/11 (55%)” o “Cierra en verde/rojo” — verde y rojo coloreados. Es la dimensión
que la POP no cuenta (permanencia dentro del EM ≠ dirección), y la que manda si
el trade fuera un spread. High/Low no llevan strip (su dirección no aplica).
Babel + montaje jsdom OK (v3.72).

## v3.70 — gráfico histórico interactivo bajo las POP de la herramienta
Consultado por Victor (¿gráfico según la POP tocada, o fijo open+close como el
screener?), se eligió el interactivo: las 4 tiles de POP (open/close/high/low)
son ahora un SELECTOR — tocar una pinta debajo el gráfico de esa serie (barras
verde/rojo por earnings, banda ±EM, columna del EM próximo — el mismo
ErMiniChart del screener). Open por defecto (la serie de su salida); High/Low
sirven para el “aguanta o cierra” (hasta dónde llegó el susto intradía). Marco
visual: borde en la tile activa + título del chart con la serie y el hint
“toca otra POP para cambiar”. Requiere ≥3 earnings con datos del ticker cargado.
Verificado: las 4 series renderizan (SSR), babel 0 errores, montaje jsdom OK.

## v3.68 — el selector EUR alcanza Riesgo, cash y P&L abierto (pedido por Victor)
En modo EUR se traducen ahora también: el tile Riesgo, el P&L abierto, y en el
estado desplegado el Cash y Margin consolidados y el Excess Liq. Los RATIOS
(Liquidez %, EL/NLV, apalancamiento) no cambian — son adimensionales. Los
CAMPOS EDITABLES (cash negativo / margin por bróker) siguen guardándose en USD,
con aviso ámbar visible cuando el selector está en EUR. El tile Excess Liq de
la otra vista (línea 10215, fuera de AccountHero) queda en USD a propósito.
Babel 0 errores + montaje jsdom OK (v3.68).
v3.69 — strikes escribibles a mano en la herramienta Earnings (pedido por Victor)
El número del strike en las tiles (Short put / Short call del IC, y corta/larga
del panel de spread) pasa a ser un CAMPO EDITABLE además de los botones −/+:
	•	Escribir un valor activa el modo manual (subrayado punteado en dorado) y ese
strike manda sobre el automático — sin restricción de escalón (vale 1642.5
aunque el modelo estime escalones de 5).
	•	Los botones −/+ siguen funcionando en modo manual: mueven el valor escrito
un escalón.
	•	VACIAR el campo devuelve el strike al automático (EM/colocación + offsets).
	•	En el IC, escribir el corto reescribe también el spread de esa pata con el
ancho vigente (igual que hacían los −/+); “Generar spreads” y “Limpiar”
resetean el modo manual. En el panel de spread, cambiar lado o colocación
también lo resetea.
Babel 0 errores + montaje jsdom OK (v3.69).

## v3.66 — selector USD/EUR en el valor de cuenta (solo visualización)
Victor descartó el sistema de conversión por posición (”¿no se va a liar mucho
todo?”) en favor de la versión ligera: un toggle USD | EUR junto a “Valor de la
cuenta” que traduce SOLO lo que se ve — el valor de cuenta (NLV), el cambio del
día en importe y el tile MKT VL. Nada se guarda ni se calcula en euros: el motor
sigue 100% USD. Defecto: USD (persistido en localStorage).
Tipo de cambio: referencia oficial del BCE vía api.frankfurter.app (sin key,
sin CORS), cacheado un día en localStorage; bajo el importe se muestra
“1 USD = 0.XXXX € · BCE fecha”. Si la llamada falla y no hay caché, se queda en
USD con aviso. El Riesgo se mantiene en USD a propósito (métrica de sizing).
NOTA: el problema original (posiciones REGISTRADAS en euros mezclando divisas
en las sumas) sigue existiendo — el parche acordado es meterlas ya convertidas
a USD al tipo del día de la operación.
Babel 0 errores + montaje jsdom con toggle verificado (v3.66).
v3.67 — FIX del tipo de cambio (“no ha funcionado”)
Causa más probable: Frankfurter migró su API a api.frankfurter.dev y el
endpoint antiguo (.app) puede fallar según red/navegador. La llamada pasa a
CASCADA de 3 fuentes sin key (frankfurter.dev → frankfurter.app → er-api.com);
la primera que devuelva un número gana y se cachea con su fuente en la leyenda.
Si fallan las tres, la leyenda lo dice en claro (“sin conexión con las fuentes
de cambio — mostrando USD, reintenta con el toggle”) y el reintento es
automático al volver a tocar EUR. Babel + jsdom OK.

## v3.65 — recolocación pedida por Victor
	•	La “Estrategia sugerida” del histórico sube ANTES del botón “Seleccionar
estrategia”: se lee la recomendación y luego se elige.
	•	Las ESTADÍSTICAS (editar histórico a mano, 4 tiles de POP, suavizada
crudo→usada, últimos 6 earnings y sus notas) quedan fuera del modo: se ven
igual con Iron Condor que con Credit spread. Solo strikes/ala/comparador y
el bloque de sizing/EV/Abrir posición siguen siendo exclusivos del IC.
Babel 0 errores + montaje jsdom OK (v3.65).

## v3.64 — Earnings con spreads: submenu, filtro del histórico y panel en la herramienta

**Wizard:** tocar "Earnings" en el bloque 3 abre submenu Iron Condor / Spread.
IC = el calco de siempre (tipo "Earnings"). Spread = el MISMO flujo del wizard
de spreads (tipo "Spread") con la marca er:true, que lo agrupa en el histórico
de Earnings. Elegir cualquier otra estrategia limpia la marca.

**Histórico (Estrategias → Earnings):** chips Todo / Iron Condor / Spreads.
Los spreads de earnings (er:true) viven en la categoría Earnings, no en Spreads.

**Herramienta Earnings:**
- FUERA el botón "Leer tabla de earnings" (cerrando la decisión del 17-jul:
  los datos llegan del screener.json del servidor). runTableOcr queda en código.
- Nuevo selector "Seleccionar estrategia" bajo spot/EM: Iron Condor (defecto,
  todo el panel de siempre) o Credit spread.
- Panel Credit spread: lado PUT/CALL + colocación ATM/Δ30. Corta automática —
  ATM en el spot; Δ30 estimada del EM sin greeks (spot ∓ 0.65·EM, con aviso de
  contrastar con la delta del bróker). Larga siempre a 1 EM de la corta. Ambas
  con steppers al escalón. Crédito mínimo pintado según colocación (ATM ≥50%
  del ancho, Δ30 ≥⅓) con check verde/rojo al apuntar el crédito del bróker y
  riesgo por contrato. Stat que MANDA en un spread: la direccional del
  histórico (abrió/cerró a favor del lado X/N) y, en Δ30, cuántos opens reales
  habrían respetado la corta → la "Δ empírica" del ticker.

Verificado: babel 0 errores, montaje jsdom OK, aritmética TSLA (spot 379,
EM 5.6%): Δ30 PUT corta 365 / larga 345 / mín $6.67 · ATM corta 380 / larga
360 / mín $10.00.

## ## v3.61 — anchos de ala 1 y 1.5 (pedidos por Victor)

El selector del ala gana "1" y "1.5" (antes 2/2.5/3/5/10). Todo lo demás
(generar spreads, steppers, comparador, barra de riesgo, % sobre riesgo) los
acepta sin cambios porque trabaja con el ancho como número.

Marco para juzgarlos (regla del tercio + binario a POP 70%):
- Ala 1 → crédito mínimo $0.33 por regla; $0.35-0.40 en la práctica (fees ~5-8%
  del crédito, franja de pérdida parcial casi inexistente → comportamiento
  binario; la fricción de 4 patas vs ~$33-40 de crédito suele ser el NO-GO real).
- Ala 1.5 → $0.50 por regla; $0.48-0.55 en la práctica. Punto medio más operable
  en nombres muy líquidos.

Nuevo AVISO (ámbar) cuando el ala elegida es menor que el escalón de strikes
estimado del ticker (la app asume $5 con spot ≥$200, $2.5 en $100-200, $1 en
$25-100, $0.5 por debajo): con spot alto el strike largo de un ala 1/1.5 puede
no existir — confirmar en la cadena del bróker. Aviso, no bloqueo: los strikes
escritos a mano siguen mandando.

Babel: 1 bloque, 0 errores (v3.61).

## v3.62 — el detalle del screener replica la tarjeta F10 del agente (pedido por Victor)

Todo derivado de los events que YA viajan en screener.json — cero llamadas,
cero tokens. Al expandir una tarjeta:
- POP open/close/high/low con FONDO que sigue al número (verde ≥75 / ámbar ≥50 /
  rojo <50, antes verde fijo) y contador X/N en la etiqueta.
- Ø actual gana la mediana; fila nueva: cierra por encima X/N · abre en verde
  X/N · peor move con su periodo (el open o close de mayor magnitud).
- Fila Ø pre-5d / Ø post-5d / "últ. post-5d en rojo X de Y" — SOLO si el agente
  añade pre5/post5 a los eventos (spec entregada aparte); si no, se oculta.
- Dos mini-gráficos SVG (≥3 eventos): APERTURA y CIERRE por earnings, barras
  verde/rojo con banda ±EM detrás y columna final con el EM próximo — la misma
  lectura que los charts de la tarjeta del agente, en 96px de alto.

Verificado con SSR (react-dom/server): nulls de JSON.parse no rompen
(Number.isFinite en todo), mediana/peor move/contadores correctos, chart pinta
bandas+barras+próximo. Babel: 1 bloque, 0 errores (v3.62).

## v3.63 — retención de impuestos en dividendos (pedida por Victor)

Algunos brokers retienen impuestos en origen sobre el dividendo. El editor de
dividendos gana el campo "Retención $" entre Importe y Comisión (fila de tres),
y el NETO pasa a ser importe − retención − comisión en los cuatro sitios que
suman dividendos: el neto de cada fila y el total del editor, el evento de
Primas y el de MTM (la retención va en la NOTA del movimiento — "Dividendo ·
retención $X · comisión $Y" — no en la columna fee, porque es impuesto, no
comisión), la réplica mtmSumOfPos y la fila "Dividendos" de Estrategias.

Dividendos antiguos sin el campo: n(d.ret) = 0, nada cambia. Derivado en render.
Babel: 1 bloque, 0 errores (v3.63).


## v3.59 — estrategias de "neto al cierre"

IC/Earnings/Broken Wings, débitos genéricos B3 y Long Call no registran evento
al abrir y materializan el neto al cerrar — pero el cierre solo restaba
`closeComision`. La comisión de apertura (`p.comision`, en DC/DD la suma de las
fees de las 4 patas) quedaba guardada y NUNCA entraba en la cuenta: Primas y MTM
inflados en esa cantidad por estructura cerrada. Lo mismo con la apertura
original de un vertical cerrado por patas (cada pata solo restaba el fee de su
operación).

Fix en 4 sitios con fórmulas idénticas: derivador de Primas/MTM (nuevo
`openFee` restado en `cashClose`/`realizedClose`; el `fee` del evento muestra el
total apertura+cierre), verticales por patas (`p.comision` imputada UNA vez, en
la primera operación realizada), y las réplicas `primaSumOfPos`/`mtmSumOfPos`.
Las opciones de crédito simples no cambian (su fee ya se restaba al abrir).

## v3.60 — PMCC (confirmado por Victor: cada pata lleva su comisión)

La comisión de apertura de la pata LARGA (`lg.comision`) tampoco se restaba en
el cierre combinado. Sigue el modelo neto-al-cierre igual que su débito: se
resta en el cierre (Primas combinado y MTM "Cierre long"), no al abrir. La de la
corta ya se restaba en su evento de apertura y las de los rolls en los suyos; la
corta expirada sin valor sigue sin fee (v3.46), como opera Victor. Réplicas
actualizadas igual.

## Efecto al desplegar

Todo es derivado en render → los históricos se autocorrigen sin migración.
El total de Primas BAJARÁ en la suma de esas comisiones nunca restadas — es la
corrección, no una pérdida nueva; el trade de earnings cuadrará con el bróker.

## Verificación

Babel: 1 bloque, 0 errores (v3.60).


> Reconstruido el 19-jul-2026 a partir del registro de chat, tras perderse la copia del repo. Desde v3.44 en adelante: pegar cada fragmento nuevo al PRINCIPIO de este archivo.
sizing."

# v3.57 — "Expira sin valor" en cierre de opciones cortas, nota en Expirar corta del PMCC, y BEP de patas en spreads

## 1. Cerrar posición · opciones cortas — "Expira sin valor"
- En la hoja de "Cerrar posición" de cualquier opción corta (Short Put, Covered Call, Iron Condor, Spread sin tocar aún…), un botón nuevo **"Expira sin valor · $0, sin comisión"** rellena de un toque el precio y la comisión a cero. El campo de nota sigue disponible para explicar el cierre.

## 2. PMCC / Diagonal — nota en "Expirar corta"
- Diagonal ya comparte el mismo modelo que PMCC en la app (una call larga + corta), así que el cambio le afecta automáticamente sin tocar nada más.
- El botón "Expirar corta" ya no ejecuta al toque: abre una pequeña confirmación con un campo de nota opcional antes de cerrar la pata a $0 sin comisión. La nota queda guardada en la cadena de rolls y se ve en el historial ("💬 nota").
- **Calendar** no tiene esta opción porque, a diferencia de PMCC/Diagonal, en la app no está modelado con una pata corta separada — es una posición de débito genérica de una sola pieza. Si se quiere lo mismo para Calendar, habría que darle primero ese modelo de dos patas.

## 3. Spreads (verticales) — BEP/neto tras cada cierre de pata
- La hoja de pata (y el historial "Ciclo por pata" del editor y de la tarjeta de cierre) ahora muestra, bajo cada operación, el **"Neto en juego tras esto"** — el crédito o débito que queda vivo en la posición después de esa operación, igual que el BEP que se ve tras cada roll de puts y calls.
- Se reconstruye históricamente a partir de los precios de cada pata en cada momento (no solo el estado actual), así que las filas antiguas muestran el neto correcto aunque la pata se haya tocado varias veces después.

## Notas técnicas
- `p.legOps` guarda cada operación con `cash` (ya con la comisión restada) cuando es un cierre/roll, y sin `cash` cuando es una apertura pendiente.
- El crédito neto de las patas actualmente vivas (para mostrar "cuánto queda en juego") se calcula al vuelo a partir de los strikes/primas vivos — no se acumula en `p.prima`, que vuelve a ser el campo simple de siempre para los verticales sin tocar.


# v3.55 — "Spread" visible también bajo el botón Débito del asistente

## Qué cambia
- En el paso 2 del asistente (elegir bloque → elegir Crédito/Débito/Acción → elegir estrategia), **"Spread" ahora aparece bajo los DOS botones: Crédito y Débito** — antes solo salía bajo "Crédito", así que si Victor iba buscando montar un debit spread y tocaba "Débito" primero, no lo encontraba ahí.
- No cambia nada más: sigue siendo la misma estrategia, el mismo formulario de patas, y sigue calculándose sola si acaba en crédito o en débito una vez metidas las primas.

---

# v3.56 — quitadas las notas editables "sueltas" de corta/larga

## Qué cambia
- Se elimina el campo editable "Nota corta"/"Nota larga" del editor de la posición — era una nota persistente sin ligar a ningún momento concreto.
- Las notas de las patas se quedan SOLO donde tienen sentido: la de **apertura** (las que se meten en el asistente al crear la posición) y la de **cada cierre o roll de pata** (el campo Nota de la hoja de pata, que ya se guardaba en el historial).
- Para que la nota de apertura no desaparezca de la vista, ahora se muestra como primera fila del historial "Ciclo por pata" (editor y tarjeta de cierre), con la fecha de entrada.

## Notas técnicas
- `p.legOps` guarda cada operación con `cash` (ya con la comisión restada) cuando es un cierre/roll, y sin `cash` cuando es una apertura pendiente.
- El crédito neto de las patas actualmente vivas (para mostrar "cuánto queda en juego") se calcula al vuelo a partir de los strikes/primas vivos — no se acumula en `p.prima`, que vuelve a ser el campo simple de siempre para los verticales sin tocar.


# v3.50 — Verticales (Credit Spread) con ciclo por pata

## Qué cambia
Hasta ahora un Credit Spread se metía con **un solo precio neto** y se cerraba/rolaba entero. Desde v3.50 la pata corta y la pata larga tienen vida propia.

## Entrada (wizard)
- Nuevos campos por pata: **Strike corta / Strike larga**, **Prima corta cobrada / Prima larga pagada** ($/acc) y **Nota corta / Nota larga** (opcionales).
- El campo único "Open price · crédito cobrado" desaparece para Credit Spread: el **crédito neto = prima corta − prima larga** se calcula solo y se muestra en la vista previa (junto al crédito total y el ROI de siempre).
- El resto de spreads (Iron Condor, Earnings, Broken Wings, Iron Fly) siguen exactamente igual.

## Gestión por pata (hoja de la posición)
Dos botones nuevos en la hoja de un vertical abierto:
- **Pata corta** → Cerrar (recompra) o Rolar (recompra + nueva venta con nuevo strike, crédito y vencimiento opcional).
- **Pata larga** → Cerrar (venta) o Rolar (venta + nueva compra).
- Con una pata cerrada, la posición sigue abierta con chip ámbar **"Sin pata corta/larga"** y el botón pasa a **"Vender corta nueva" / "Comprar larga nueva"** — se puede recomprar la corta hoy y volver a venderla unos días después.
- Cada operación pide fecha, precio $/acc, comisión y **nota**; la hoja enseña en vivo cómo queda el crédito neto acumulado.

## Contabilidad (sin cambiar el modelo de siempre)
- `p.prima` pasa a ser el **crédito neto ACUMULADO**: cerrar la corta resta la recompra, vender corta suma, vender la larga suma, comprar larga resta (mismo patrón que los rolls del PMCC).
- Las comisiones de las operaciones por pata van a `p.legFees` y se restan del realizado en el cierre (Primas, MTM, tarjeta de cierre y export).
- **Nada se apunta en Movimientos hasta el cierre**, como siempre en los credit spreads.
- Si las dos patas quedan cerradas, la posición **se cierra sola** (closePrice 0): realizado = neto acumulado × contratos − comisiones de patas. "Cerrar posición" entero sigue disponible mientras las dos patas estén vivas; con una pata cerrada, el remate se hace desde la hoja de la otra pata (así los signos siempre cuadran).

## Historial y visibilidad
- Nueva tabla **"Ciclo por pata"** (fecha · acción · strike · nota · ±$/acc) visible en el editor de la posición y en la tarjeta de cierre de Estrategias.
- La descripción del vertical y el subtítulo de la hoja muestran ahora los strikes corta/larga (ej. "Put credit spread 715/710").
- Editor: campos Strike/Prima/Nota por pata; la prima principal se relabela "Crédito neto acum. $/acc".
- Export de análisis: añade strikeCorta, strikeLarga y nº de operaciones por pata.

## Notas
- Solo aplica a **Credit Spread de 2 patas** (decisión de Victor); condors de 4 patas quedan como estaban.
- Roll de la corta puede cambiar el vencimiento de la posición (sale/entra en Vencimientos con el nuevo).
- Posiciones antiguas de Credit Spread siguen funcionando: sin strikes por pata hasta que se editen, y su prima se interpreta ya como neto acumulado (que para ellas coincide con el open price de siempre).
- Pendiente futuro si se quiere: que el lector de capturas rellene también los campos por pata.

---

# v3.51 — Credit Spread en Bloque 2 + aclaración contable

## Qué cambia
- **Credit Spread ya está disponible en el Bloque 2** (antes solo aparecía en B3): sale en el desplegable del wizard al abrir posición en B2, y el selector de Bloque del editor permite mover una posición de este tipo entre B2 y B3.
- **Aclaración pedida por Victor**: cuando cierras o rolas solo una pata (corta o larga) de un vertical, ¿ese resultado entra ya en MTM o espera al cierre completo?
  → En v3.51 se contestó que esperaba. **v3.52 lo cambia**: tiene más sentido reservarlo ya. Ver más abajo.

---

# v3.52 — cada cierre de pata se reserva ya en Primas/MTM; abrir a crédito espera a su cierre

## El cambio de fondo
- **Cerrar o rolar una pata (recompra de la corta, venta de la larga)** genera **su propio evento en Primas y MTM en ese momento**, con esa fecha — ya no espera al cierre total de la posición.
- **Abrir una pata nueva a crédito** (vender la corta otra vez, comprar una larga nueva, o la parte de apertura de un roll) **no se apunta hasta que esa pata se cierre a su vez** — mismo criterio de siempre: el crédito de una venta abierta nunca se registra hasta que se recompra.
- Si ambas patas acaban cerradas, la posición se cierra sola **sin generar un evento adicional** — cada cierre ya quedó reservado por separado en su momento, así que un evento de "cierre total" duplicaría el resultado.
- La hoja de pata ahora muestra en vivo el importe exacto que se va a reservar (o "pendiente" si es una apertura a crédito).
- El historial "Ciclo por pata" muestra el resultado real de cada cierre; las aperturas aparecen como "pendiente".

## Por qué
Con el modelo de v3.50/v3.51 (esperar al cierre total), el resultado de cerrar la corta hoy y abrir otra en unos días quedaba invisible en Movimientos hasta que TODA la posición se cerrara — podía ser semanas después. Con v3.52 cada decisión de cerrar una pata se refleja en su fecha real, que es más fiel a cuándo ocurrió el dinero.

## Notas técnicas
- `p.legOps` guarda cada operación con `cash` (ya con la comisión restada) cuando es un cierre/roll, y sin `cash` cuando es una apertura pendiente.
- El crédito neto de las patas actualmente vivas (para mostrar "cuánto queda en juego") se calcula al vuelo a partir de los strikes/primas vivos — no se acumula en `p.prima`, que vuelve a ser el campo simple de siempre para los verticales sin tocar.

## v3.49 — FIX: “Vender call” (y Rolar/Cerrar desde el sheet) mandaba la app a Herramientas
	•	Bug introducido en v3.46: al lanzar roll/cierre desde el sheet, la navegación de vuelta usaba el id “portfolio” — que es el nombre del ICONO, no de la pestaña (el id real es “bloques”). La app caía a una vista inexistente → fallback Herramientas, con la acción pendiente colgada (pantalla en blanco/limbo). Afectaba a Vender call, Rolar y Cerrar posición desde el sheet.
	•	Reproducido en un DOM headless (jsdom + React 18) con un PMCC sin corta: el tap dejaba el root vacío en la vista Herramientas. Con el fix, la hoja “Vender call” abre con el bloque y la fila intactos, 0 errores.
	•	No hay que reparar nada a mano: el “portfolio” inválido que quedó guardado en localStorage se descarta solo al abrir la app (la lista blanca de vistas cae a Portfolio).

## v3.47 — cambiar una posición de bloque desde el editor
	•	Nuevo selector “Bloque” en el editor de posición (junto a Broker/Ticker): mueve la posición p.ej. de B2 a B1 sin recrearla.
	•	Solo se ofrecen los bloques cuya lista de estrategias incluye el tipo de la posición (una Short Put puede ir a B1 o B2; una Iron Condor no sale de B3); si el tipo no casa con ninguno, se ofrecen B1-B3.
	•	El cambio recoloca la posición en Portfolio y re-atribuye sus eventos de Primas/MTM y filtros por bloque al bloque nuevo (los eventos se construyen leyendo p.block).

## v3.46 — PMCC sin corta (expirar / vender call) + aviso de opciones vencidas
PMCC / Diagonal: la corta expira sin valor y no vendes otra aún. Hasta ahora la única salida era un roll a coste cero (pata fantasma) o cerrar la posición entera.
	•	Nueva acción “Expirar corta” en el sheet del PMCC abierto: registra la expiración en la cadena (fila EXPIRA en gris, fecha = el propio vencimiento si ya pasó), vacía strike/vencimiento (sale de Vencimientos) y deja la posición abierta con chip ámbar “Sin call vendida”. El crédito cobrado no se toca.
	•	En ese estado, “Rolar” pasa a ser “Vender call”: misma hoja pero sin campo de recompra; la venta se registra como pata propia en la cadena (sin recompra fantasma de $0) y suma su crédito a la prima acumulada.
	•	Cerrar posición sin corta solo pide la venta de la long (aviso ámbar en la hoja; la recompra de la short se registra a 0 automáticamente).
	•	Movimientos: la expiración no genera evento de Primas ($0 no aporta) pero sí de MTM (“Expirada short”, la prima de esa call queda realizada); la venta posterior genera “Venta call” solo en Primas.
Aviso de opciones vencidas y aún abiertas (elegido banner persistente frente a modal: no se descarta, desaparece al resolver):
	•	Banner ámbar arriba de Vencimientos: “⏰ N opciones vencieron y siguen abiertas”, una fila por posición (ticker, tipo, strike, fecha, bloque, broker) con botón Resolver que abre el sheet de la posición — y al elegir cerrar/rolar salta a Portfolio, donde vive la hoja.
	•	Punto rojo en el icono de Vencimientos de la barra inferior mientras haya alguna, para verlo sin entrar.

## v3.44 — earnings dentro pasa a fila de la Auditoría (ganadoras vs perdedoras)
Sustituye el bloque separado de la v3.42 (que no aparecía en el sitio esperado).
	•	Eliminado el bloque “⚠️ Con earnings dentro / ○ Sin” bajo los tiles del resumen.
	•	Nueva fila ”% con earnings dentro” en la tabla de Auditoría (Short Puts/Covered Calls y DC/DD), junto a Delta/DTE/IVR/DIT o Ratio S/L/% con evento: qué porcentaje de las ganadoras y de las perdedoras se abrió con earnings antes del vencimiento (p.earnIn).
	•	Mismo criterio que el resto de filas de Auditoría: solo cuenta lo registrado, respeta el filtro de ticker, no se ve afectada por el filtro Ganadoras/Perdedoras (compara ambos grupos).
	•	Sigue sin haber datos para posiciones cerradas antes de v3.42 — el % de “con earnings” en esas será 0% hasta que abras posiciones nuevas con el flag.

## v3.43 — texto del aviso de earnings sin §5
- Cambiado el texto del aviso ámbar de earnings: antes "DENTRO del vencimiento. §5: documentar y valorar un escalón menos de tamaño." → ahora "DENTRO del vencimiento. Documentar y valorar sizing."

## v3.42 — earnIn persistido en apertura + desglose en Estrategias
- El aviso de earnings pasa a componente compartido `EarningsHint` (caché a nivel de módulo), usado en el asistente "Nueva posición" y en la hoja de roll.
- Al **abrir** con el aviso ámbar activo, la posición guarda `earnIn` (fecha del earnings) — sin badge visible en la fila.
- Al **rolar** solo se informa: el roll nunca escribe ni borra `earnIn` (la estadística mide la decisión de entrada, no la gestión posterior).
- Estrategias → Cerradas: bajo los tiles del resumen, desglose "⚠️ Con earnings dentro (N) / ○ Sin (M)" con win rate y P&L por grupo. Solo aparece si hay alguna marcada; las cerradas anteriores a v3.42 cuentan como "sin".
- Limitación: si se guarda antes de que Finnhub responda (~1s), el flag no se escribe.

## v3.41 — aviso de earnings dentro del vencimiento en "Nueva posición"
- En el paso 3 del asistente, con ticker + vencimiento y key de Finnhub en Ajustes: consulta `fetchNextEarnings` (60 días) con debounce 600ms y caché por ticker.
- Línea de estado: ⏳ comprobando · ⚠️ ámbar con día y sesión (pre/post/en sesión) si cae dentro del vencimiento · gris si queda fuera o no hay ninguno en 60 días (nota de ADRs) · gris honesto si Finnhub falla o falta la key. Solo informa, nunca bloquea el guardado.

## v3.40 — fix del enlace put↔acción en "Asignadas"
- Causa: la búsqueda de la acción vinculada a una put asignada era solo por `assignedFrom`; si no aparecía (asignaciones previas al enlace automático, o acción creada/fusionada a mano), la fila caía en "cerradas del todo" sin valoración.
- Fix: búsqueda en 3 pasos — `assignedFrom` → acción abierta del mismo ticker y broker → acción abierta del mismo ticker. Tercer grupo "Sin acción vinculada" (ámbar) para las que no encuentran acción: solo prima, con explicación.

## v3.39 — criterio de asignación por tipo + submenú "Asignadas" en Short Puts
- Nuevo `closedGrade(p)` (W/L/null): covered call asignada → ganadora si strike ≥ BEP de la acción vinculada, perdedora si no; short put asignada → sin clasificar (el resultado vive en la acción); resto → por el signo del dinero. `isWinner`/`isLoser` y todos los recuentos pasan por este criterio.
- Submenú plegable "🔗 Asignadas (N)" solo en Short Puts: vivas (valoración = prima + unrealised de la acción) y cerradas del todo (resultado real de la cadena), con subtotales.

## v3.38 — la tarjeta de riesgo razona solo con dinero
- Fix del caso Short Puts: una asignación no es automáticamente pérdida. `winsArr`/`lossArr` ahora solo cuentan resultados con signo real (los ceros no puntúan); aviso ámbar si no hay ninguna pérdida registrada, y aviso aparte cuando hay asignaciones (ahí solo se ve la prima).

## v3.37 — fix del texto contradictorio de concentración
- La concentración de pérdidas se medía con un umbral fijo del 50% sobre el total, dando frases contradictorias con pocas perdedoras. Ahora se compara contra la parte que le tocaría (1/nº perdedoras): ≥2× "concentrada", ≥1,3× "algo concentrada", resto "repartida".

## v3.36 — "Riesgo del proceso" plegable + dos correcciones
- Tarjeta convertida en `<details>/<summary>` para no ocupar tanto espacio.
- El veredicto se adapta al win rate (tres redacciones según >70%, 50-70%, <50%).
- La peor operación deja de compararse con el P&L neto (se disparaba cerca de cero) y pasa a compararse con el bruto de ganadoras y con el total de pérdidas.

## v3.35 — nueva tarjeta "Riesgo del proceso" en Estrategias
- Tarjeta genérica bajo el resumen de cualquier estrategia (cerradas, ≥3 operaciones): peor operación en $ y % del acumulado, ganadora media, perdedora media, ratio G/P, mínimo exigido por el win rate (1-wr)/wr, veredicto verde/rojo. Nace del caso de sizing en Earnings, visible solo al exportar antes de esta tarjeta.

## v3.32 — cinco cosas: B0 fuera del filtro, comisión en aportaciones, vínculo cash negativo, fix ROI
- Movimientos: B0 fuera de las chips de filtro por bloque.
- Aportaciones: nuevo campo "Comisión USD" por movimiento, descontado en el TWR (flowNet).
- Vínculo aportaciones↔B0↔cash negativo: aviso ámbar en vivo y al registrar si el bróker elegido tiene cash negativo.
- Fix de la tarjeta de posición cerrada: el ROI se salía de su celda con cifras largas — tamaño de fuente dinámico + ellipsis.

## v3.31 — barras de v3.30 rechazadas, filtro por bloque en su lugar
- Revertida la barra de composición de v3.30 (no mostraba importes). Nuevo filtro por bloque (chips "Todos"/B1/B2/B3) en Movimientos → Primas/MTM, recalculando mes/año/total sobre los eventos filtrados.

## v3.30 — contribución por bloque en Primas y MTM (revertido en v3.31)
- Barra de composición por bloque al pie de cada mes/año — descartada por Victor por no enseñar importes.

## v3.29 — nombre de la empresa a su propia línea en la tarjeta del Screener
- El nombre de la empresa, que se cortaba compartiendo línea con el ticker, pasa a su propia línea a todo el ancho.

## v3.28 — filtros Cap y POP del Screener editables
- Cap y POP dejan de ser desplegables de opciones fijas y pasan a campos numéricos editables. Aviso derivado de los datos: "el barrido trae desde $XB" según el mínimo real presente en el screener.json.

## v3.27 — columnas nuevas en Resumen por ticker + alineación de tarjetas del Screener
- Tabla "Resumen por ticker": nuevas columnas EM próx, Ø open, IV crush (además de Ø EM ya existente).
- Tarjetas del Screener: tiles de ancho fijo y cabecera reordenada a 2 líneas para que sesión/liquidez queden alineadas entre tarjetas.

## v3.26 — quitar Alpha Vantage de Ajustes + POP visible en cabecera del Screener
- Retirada la fila de Alpha Vantage de Ajustes (subtítulo obsoleto: el POP ya lo reconstruye el VPS+moomoo).
- Mini-tile "POP" añadido a la cabecera de cada tarjeta del Screener (antes solo visible al desplegar).

## v3.25 — "EM próximo" nunca sale: no era bug del cliente
- Causa raíz identificada en el servidor: `enriquecer.py` del VPS solo reconstruía earnings pasados, nunca el trimestre en curso como evento "pendiente". La app añadió una nota ámbar explicándolo mientras se resolvía en el VPS (resuelto el mismo día, ver entrada de enriquecer.py).

## v3.24 — filtro POP en el Screener (corrige el sitio de la v3.23)
- El filtro POP, puesto por error en la tabla de Earnings en v3.23, se añade donde correspondía: selector "POP ≥" en los filtros del Screener.

## v3.23 — filtro POP (sitio equivocado) + retirada de la API de Market Data
- Retirada completa la integración con marketdata.app (fila de Ajustes, botón de liquidez, badge, columna, modal de key) — llevaba tiempo sin usarse tras el cambio a Alpha Vantage/moomoo.

## enriquecer.py (VPS) — fix de "EM próximo", 17-jul-2026
- Parche para que el script del VPS añada también el evento del trimestre EN CURSO (pendiente, sin cerrar) al histórico de cada ticker, usando `predict_vola_ratio_newest`. Validado con 5 tickers y luego con el barrido completo (250 tickers, 163 con histórico), publicado a GitHub.

## v2.14 — cinco frentes
- Earnings: columna "Próx" (próximo earnings + sesión) en el resumen por ticker.
- Screener: pulsar un ticker ya no salta directo a Earnings — modal de confirmación.
- Comisión de compra por lote de acciones (la de venta ya existía), integrada en BEP/FIFO.
- Cash en el asistente: solo pide importe.
- Tarjeta-resumen autónoma al cerrar cualquier posición (P&L, ROI, ROI anualizado, BEP, DTE, DIT), verificada contra el ledger en 9 casos.

## v1.63–v1.89 — histórico previo (resumen)
- v1.63: investigado un reporte de "pérdida de movimientos" — no era bug, era el filtro de bróker heredado tras dar de alta una posición.
- v1.69: histórico con filtro de fechas; nueva herramienta de Alertas de precio (target/entrada/retracement); MAR ratio en Rendimiento; fix de contraste del tooltip en modo noche.
- v1.70: curva de drawdown en Rendimiento.
- v1.71: fix de crash en Alertas; reencuadre de CAGR/MaxDD/MAR; quitado el snapshot manual (redundante con el automático); fix de date inputs en iOS; calendario de earnings vía Finnhub.
- v1.72: notificaciones de alertas gestionables desde Ajustes; último spot mostrado en alertas armadas; notas opcionales por alerta; nuevo tipo de alerta "caída vs cierre anterior".
- v1.72→v1.74: CRASH CRÍTICO al abrir Ajustes (colisión de nombre de estado entre componentes) — fix + pantalla de rescate permanente (RescueBoundary) con descarga de copia de emergencia.
- v1.75–v1.89: fix de icono vacío en notificaciones; hora en el último precio de alertas; fix de etiquetas cortadas en earnings; fix de color en Vencimientos para long calls (vencDanger); calendario macro USA embebido (CPI/PPI/NFP/FOMC) con enlaces a fuente oficial y ForexFactory; conexión del calendario macro a la ficha DC/DD; tarjeta macro colapsable; fix de cuenta atrás con días mal redondeados; ajustes finos en Histórico (precio del subyacente en la sublínea, unrealised en vez de "+$0").
