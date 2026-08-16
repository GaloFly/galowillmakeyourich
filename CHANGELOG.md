# CHANGELOG — Bloques

Bloques v4.85 — De dónde sale el theta (y las griegas congeladas)

## La pregunta
Victor, viendo `THETA / DÍA -$522.59`: *"esto me lo tienes que explicar, porque pago theta si solo
tengo las opciones largas de IBIT y PMCC de ASTS"*.

Y la sospecha era buena: en esa misma tarjeta, IBIT y ASTS estaban entre las CUATRO posiciones que
quedaban FUERA del cálculo por no tener precio del servidor. O sea que sus únicas largas ni siquiera
entraban en ese −$522, y aun así el total decía que paga.

## El problema de fondo
**Un total que no se puede abrir no se puede contradecir.** Si ese número estuviera mal, no habría
forma de verlo; y si está bien, tampoco había forma de entenderlo. Un dato que solo se puede creer o
no creer no sirve para decidir.

## Lo que se ha hecho

**1. Desglose por posición.** Botón «Ver de dónde sale» dentro de la tarjeta: una fila por posición
con su theta del día y su delta en dólares, **ordenadas de la que más te cuesta a la que más te
paga**. Así se ve de un vistazo si el total lo explica una posición concreta o si no lo explica nada.
Se dice también lo que NO está ahí: las acciones (que sí suman a la delta de arriba) y las posiciones
sin griegas.

**2. Griegas CONGELADAS, que era el fallo escondido.** Desde la v4.57, cuando un contrato deja de
llegar del servidor la app conserva las últimas griegas que tuvo de ESE contrato, para no quedarse en
blanco un fin de semana. Está bien pensado… hasta que pasan días: esas griegas **seguían sumando al
total como si fueran de hoy**, y no había forma de notarlo. Ahora, la posición cuyas griegas van más
de un día por detrás de la más reciente sale marcada en ámbar con su fecha: `congelada del 3 ago`.

**3. La frase de la antigüedad ya no tranquiliza de más.** Decía *"Delta y theta son del cierre de 3
ago: con el mercado cerrado no cambian"*. Eso vale para un fin de semana; con datos de hace doce días
es falso — el mercado ha abierto nueve sesiones desde entonces. Pasados cuatro días ahora dice la edad
real y qué hacer: *"Ojo: las más antiguas son del 3 ago, hace 12 días. Pulsa 🔄 Precios; si siguen
igual, esos contratos ya no le llegan a tu servidor."* Y se aclara que esa fecha es la de la MÁS
ANTIGUA, no la de todas, que es lo que parecía.

## Cómo se comprobó
Prueba nueva (`desglose.mjs`) con una cartera montada para reproducir justo lo que le chirriaba:
cuatro posiciones que COBRAN theta y una larga congelada de hace doce días que paga más que las cuatro
juntas.

- el total sale **−$84,34/día** aunque cuatro de cinco cobren — cuadra al céntimo con la cuenta hecha
  a mano aparte (+$5,66 de las cortas − $90,00 de la larga);
- la posición que lo explica sale **la primera** del desglose, y las otras tres en verde;
- la congelada aparece marcada con su fecha;
- la frase de la antigüedad ya no dice "con el mercado cerrado no cambian" y sí dice los días.

`npm run prueba`: **OK**, las 18 cifras idénticas.

Bloques v4.84 — La tarjeta de griegas se pliega

## Lo que pidió Victor
*"Pon que se pueda colapsar el menú de griegas de la cartera"*.

## Lo que se ha hecho
Se toca la cabecera y la tarjeta se pliega. Recuerda cómo la dejaste, así que si la prefieres cerrada
no hay que volver a cerrarla cada vez. Es el mismo mecanismo que ya tienen los Eventos Macro (v1.82),
flecha incluida.

**Plegada no se calla**, que es la parte que importa. Deja a la vista, en una línea:

- el **theta del día** con su color (verde si recoges, rojo si pagas),
- la **delta en dólares**,
- y la chapa **EN VIVO / DEL CIERRE**, que es lo que dice si esos dos números son de ahora o del
  último cierre.

Si faltan posiciones, plegada también lo dice ("de 4 de 6"). Y cuando **no hay griegas**, plegada
avisa en ámbar de cuál de los dos motivos es y qué hacer, en vez de quedarse en un título mudo. Es la
misma regla de la v4.55 y de la v4.46: **callarse no es un estado neutro, no se distingue de una
avería**. Plegar tiene que ahorrar sitio, no información.

De paso, arreglada una frase que cantaba cuando solo tienes una posición de opciones: decía
*"De las 1 posiciones de opciones que tienes"*.

## Cómo se comprobó
Prueba nueva (`griegas-plegar.mjs`), en las DOS formas de la tarjeta —con griegas y sin ellas—:

- plegada ocupa menos (de 10 líneas a 4 con griegas; de 8 a 3 sin ellas);
- plegada **sigue diciendo** el theta (+$1,66 al día), la delta (+$328) y la chapa `DEL CIERRE`;
- sin griegas, plegada sigue avisando de que faltan;
- al recargar sigue como la dejaste, y al volver a abrirla vuelve exactamente a lo de antes;
- cero errores de JavaScript.

`npm run prueba`: **OK**, las 18 cifras idénticas.

Bloques v4.83 — La franja de arriba, negra cuando la app está en negro

## El síntoma
Victor, con la app en modo oscuro: *"con este update la cabecera se ha quedado blanca, se puede poner
negra?"*. En la captura, la tira de arriba del iPhone —la de la hora, la cobertura y la batería— sale
en beige claro mientras el resto de la pantalla es negro entero.

## La causa
iOS pinta esa franja con el color que le dice el `<meta name="theme-color">`, y lo lee **una sola vez,
al abrir la app, antes de ejecutar nada**. El nuestro estaba escrito en el archivo con el beige del
tema claro (`#EEE9E0`), y quien lo corregía a negro era el propio programa una vez arrancado — para
entonces la franja ya estaba pintada y iOS no vuelve a mirarla. Lo mismo con el fondo de la página,
que es lo que se ve por detrás de esa zona: también estaba fijo en beige.

Dicho de otro modo: el color de la franja lo decidía un archivo que no sabe si el usuario tiene la app
en claro o en oscuro.

## El arreglo
Un trozo de programa diminuto en la cabecera del archivo, que corre **antes de que se pinte un solo
píxel** y antes de que cargue nada más. Lee la misma preferencia guardada que usa la app
(`bloques_dark_override`) y deja ya puestos, en el momento justo:

- el `theme-color` (negro `#0A0A0A` o beige, según el tema),
- el `color-scheme` (para que los controles del sistema salgan del color correcto),
- el fondo de la página entera.

El interruptor ☀️/🌙 sigue funcionando igual y ahora también refresca esas tres cosas al vuelo, sin
recargar. Y de paso, el cartel de arranque de la v4.79 —el que aparece cuando el programa no carga—
ya no se ve como una hoja blanca en medio de una app negra: se adapta al tema.

## Cómo se comprobó
Prueba nueva (`cabecera.mjs`) que congela la página **antes de que exista React** y mira el color en
ese instante exacto, que es el único que importa:

- en oscuro, con la preferencia guardada: `theme-color` ya negro y fondo ya negro **antes** de que
  arranque el programa (comprobando además que de verdad se midió antes: `window.React` no existía);
- en claro, sin preferencia guardada: sigue beige, nada se ha vuelto negro por accidente;
- el cartel de arranque, con el programa bloqueado a propósito, en los dos temas.

`npm run prueba` (la red de seguridad de los usuarios sin servidor propio): **OK**, las 18 cifras
idénticas.

Bloques v4.82 — Cortar el bucle desde el servidor

## Por qué hacía falta otra versión
El arreglo de la v4.81 es el correcto… y **no le sirve de nada a un teléfono que ya está encerrado**.
Victor: *"sigue sin funcionar"*. Claro: en su iPhone el que manda es el service worker VIEJO, la
navegación muere antes de ejecutar una sola línea, y sin ejecutar nada no hay quien pida el service
worker nuevo. El bucle se cierra sobre sí mismo.

## El arreglo
Se corta por el otro lado: **que Cloudflare deje de redirigir**. Un archivo `_redirects` en la carpeta
publicada:

    /index.html    /            200
    /rescate.html  /rescate     200

El `200` no es una redirección sino un *servir-en-el-sitio*. Sin redirección, el service worker viejo
deja de recibir lo que tiene prohibido devolver, y todo vuelve a funcionar **sin que el teléfono tenga
que hacer nada**. GitHub Pages ignora ese archivo —nunca redirigió—, así que no le afecta.

## Comprobado
Prueba nueva `encerrado.mjs`, que reproduce su caso exacto en tres actos:
1. un teléfono con el service worker viejo contra un servidor que redirige → la página de rescate
   falla, igual que le fallaba a él;
2. se publica la v4.82 y el servidor deja de redirigir;
3. **el mismo teléfono, sin tocar nada, vuelve a abrir la app** — y la caché pasa a ser la nueva, o
   sea que el service worker arreglado ya se instaló.

`npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.81 — LA CAUSA: un service worker no puede devolver una redirección

## El mensaje que lo resolvió todo
Victor, abriendo la dirección de Cloudflare en una pestaña limpia:
**"Response served by service worker has redirections"**.

Ahí estaba todo. Hasta ese momento el diagnóstico había ido dando tumbos —culpé a la caché del
teléfono, y después a Cloudflare por publicar una copia vieja— y las dos veces me equivoqué: el panel
demostró que Cloudflare había desplegado la v4.80 hacía once minutos, en verde.

## Qué pasaba
Un service worker **no puede devolver una respuesta que venga de una redirección**: el navegador la
rechaza por seguridad y la página se queda en blanco.

Y **Cloudflare Pages redirige** las direcciones acabadas en `.html` a la versión sin extensión
(`/index.html` → `/`, `/rescate.html` → `/rescate`). **GitHub Pages no lo hace.** Por eso exactamente
la misma app, con exactamente los mismos archivos, funcionaba en un sitio y en el otro no. Ese detalle
—que llevaba ahí desde la mudanza— es toda la diferencia.

Y había una segunda vuelta de tuerca, peor: **`cache.put` también rechaza una respuesta redirigida**.
La instalación del service worker guardaba todos los archivos de golpe con `addAll`, así que al
tropezar con `/index.html` redirigido **fallaba entera** y el service worker nuevo no llegaba a
instalarse nunca. Por eso no se arreglaba solo por más versiones que publicara: el que mandaba seguía
siendo el viejo, y el viejo no podía sustituirse a sí mismo. Estaba encerrado.

## Los arreglos
- **`sinRedir`**: si una respuesta viene de una redirección se reconstruye a partir de su cuerpo. Es
  la misma respuesta, sin la marca que molesta.
- **La instalación va archivo por archivo y es tolerante**: si uno falla, se salta y los demás entran.
  Que un archivo suelto no pueda volver a dejar al service worker viejo mandando para siempre.

## Comprobado
Prueba nueva `redir.mjs`: un servidor que **imita a Cloudflare Pages** —redirige los `.html` y
devuelve el index para lo que no existe— y la app abierta contra él con service worker de verdad.

- Con el service worker **nuevo**: arranca a la primera, a la segunda, a la tercera, la página de
  rescate carga, funciona **sin red** y vuelve a funcionar al recuperarla. Ni un error.
- Con el service worker **viejo** (reconstruido a propósito para la prueba): la página de rescate
  falla con un error de red — que es exactamente lo que Victor veía.

La red de seguridad de arranque de la v4.79 sigue pasando sus tres casos, y `npm run prueba` sigue
dando las 18 cifras idénticas sin servidor propio.

## Lo que tiene que pasar ahora
El navegador comprueba `sw.js` en cada apertura, y esa comprobación **no pasa por el service worker**.
Así que al abrir la app debería descargar el nuevo, instalarlo —ahora ya sin fallar— y tomar el
mando. Con los datos intactos, que nunca se tocaron.

---

Bloques v4.80 — Una salida que no depende de la app: /rescate.html

## Por qué
Victor, después de la v4.79: *"No arranca"*. El cartel de arranque de la v4.79 no le sirve de nada si
lo que no le llega es **el propio index**: no puede ver un mensaje que está dentro de la página que no
carga. Hacía falta una salida en **otra dirección**.

Antes de escribirla se comprobó que el programa publicado está sano: clonando el repo desde cero y
compilando como lo hace Cloudflare (`npm ci && npm run build`), la app arranca en la primera apertura,
en la segunda con el service worker al mando, y también **sin red**. Así que el problema está en el
camino hasta el teléfono, no en el código.

## Qué es
`app.alphavext.com/rescate.html` — una página sola, sin React, sin `app.js`, sin depender de nada.
Hace las dos cosas que hacen falta cuando la app no abre:

1. **Dice qué versión está sirviendo el servidor ahora mismo**, pidiendo el index con un cachebuster.
   Eso distingue las dos averías posibles: *"la actualización no ha llegado al servidor"* o *"mi
   teléfono tiene basura guardada"*. Sin ese dato solo se puede adivinar.
2. **Repara**: desregistra el service worker y borra sus cachés, y abre la app.

**No toca `localStorage`**, que es donde viven las posiciones. Eso no es una promesa: la prueba lo
comprueba sembrando posiciones y una clave de API, pulsando Reparar y verificando que siguen ahí
carácter por carácter.

Va en su propia dirección a propósito: si el index está envenenado en la caché del teléfono, esta URL
nunca lo estuvo.

## Comprobado
Con el service worker ya instalado, la página de rescate carga, informa (*"El servidor está sirviendo
la versión 4.80. Esta app espera la 4.80"*), desregistra, borra las cachés y abre el Portfolio. Las
posiciones y la clave de API sobreviven intactas. La red de seguridad de arranque de la v4.79 sigue
pasando sus tres casos y `npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.79 — La pantalla en blanco: el service worker servía HTML donde iba el programa

## El síntoma
Victor, tras actualizar: *"no se abre la app"*, con una captura de una pantalla **completamente en
blanco**. Sin un mensaje, sin saber si era la red, la actualización o algo roto.

## La causa
El service worker, cuando una petición fallaba y no la tenía en su caché, devolvía **`index.html`
para cualquier cosa**. Ese respaldo tiene sentido para una navegación —es el truco de siempre para
que una app de una sola página funcione sin red—, pero aplicado a **`app.js`** significa que el
navegador recibe HTML donde espera JavaScript, revienta al primer `<` y **no queda nada que pintar**.

Y encaja con el momento: cada versión referencia el programa con un hash nuevo (`app.js?v=…`), justo
para que no se sirva el viejo. Tras una actualización, el index pide un archivo que **todavía no está
en su caché**; si en ese instante la red falla o tarda, el service worker devolvía el index como si
fuera el programa. Pantalla en blanco.

## Los dos arreglos
1. **El respaldo de `index.html` es solo para navegaciones.** Para un script, si no hay red ni copia,
   se devuelve un error honesto — que es lo que permite detectarlo.
2. **La app ya no puede quedarse en blanco.** El HTML lleva desde el primer instante un cartel que
   dice *"La app no ha podido arrancar"*, avisa de que **los datos siguen en el teléfono**, y ofrece
   dos botones: **Reintentar** y **Vaciar la caché y reintentar** (que borra el service worker y los
   archivos del programa, nunca las posiciones). Debajo escribe el detalle técnico del fallo. React lo
   sustituye al montar, así que si se ve es que el arranque falló de verdad.

   Está escrito sin CSS externo ni dependencias a propósito: tiene que funcionar justo cuando no
   funciona nada.

## Comprobado
Prueba nueva `arranque.mjs`, con los dos desastres que producen una pantalla vacía:
- **el `app.js` no llega** → sale el cartel, con el detalle `http://…/app.js?v=8a28141407`;
- **el `app.js` llega pero es HTML** (exactamente lo que hacía el service worker viejo) → sale el
  cartel con `Uncaught SyntaxError: Unexpected token '<'`, que es la firma del fallo;
- **y con todo bien**, el cartel desaparece y arranca el Portfolio.

`npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.78 — Las griegas del portfolio: el fallo estaba en el puente

## El síntoma
Victor, **con el mercado abierto** y tras pulsar 🔄 Precios: *"nada, se siguen sin ver las griegas
del portfolio"*. La tarjeta decía "tu servidor mandó los precios pero no las griegas".

## La causa: se preguntaban por la puerta equivocada (otra vez)
El puente tiene dos rutas para el precio de un contrato:

- **`/opciones`** (varios de golpe) usa `get_market_snapshot`, que **sí** trae delta, theta e IV.
- **`/opcion`** (uno a uno) usaba `get_stock_quote` para todo… y ese registro **no tiene** las
  columnas `option_delta`, `option_theta` ni `option_implied_volatility`. Solo pedía el snapshot para
  la horquilla bid/ask y tiraba el resto.

Así que por la ruta de uno en uno las griegas llegaban **siempre vacías**, con el mercado abierto o
cerrado. Y la app cae a esa ruta en cuanto `/opciones` falla por cualquier motivo, sin decir nada. Es
exactamente el mismo error que la v4.57: entonces dimos por bueno que "OpenD no da griegas fuera de
horario" y resultó que preguntábamos por la puerta equivocada.

**Arreglo:** `/opcion` lee ahora la IV, la delta, la theta, la gamma, la vega y el interés abierto del
snapshot que ya estaba pidiendo, y la hora del dato de `update_time`. Requiere **actualizar el
servidor** (un comando).

## Y la app deja de decir solo "no están"
Cuando falta una griega, la tarjeta enseña ahora **la respuesta literal del servidor** para uno de
esos contratos: código, precio, IV, delta, theta, la hora del dato y si venía de la caché del
servidor. Decir "no están" no distingue tres averías distintas —que el servidor no las mande, que las
mande vacías, o que sean de otro momento— y cada una se arregla de otra forma. Con esto se ve dónde
se corta sin abrir una terminal.

Ese dato crudo es dato de mercado: **no viaja en el backup**, como las marcas y las griegas.

## Un detalle de la captura
Eran las **15:31**, dentro de la franja **15:29–15:46** en la que el puente no llama a OpenD para no
molestar a la captura de root. En esa franja sirve lo que tenga en caché, y lo que no esté cacheado no
llega. Puede haber sumado.

## Comprobado
Con griegas vacías simuladas, la tarjeta enseña `US.TMDX260918P70000 · precio 3.1 · IV — · delta — ·
theta — · hora del dato 2026-08-14 09:39:29`. Los demás escenarios de la tarjeta siguen igual, el
puente compila y `npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.77 — La tarjeta entera antes de añadir, y la IV en la fila

## Lo que pidió
Victor: *"Puedes hacer que en este menú aparezca también la IV / historical volatility, y aparte,
que al pulsar una de esas antes de añadir se vea ya la tarjeta que tengo con el ROI, el anualizado,
el break even price, todo, todo igual, y después que puedas añadir al comparador."*

## La tarjeta antes de añadir
Ahora se toca cualquier candidata y se despliega **la misma tarjeta del comparador**: el sello
GO/CAUTION/NO-GO, el Annualized ROI grande, Premium, ROI, Riesgo, BEP con su margen, los tres
recuadros (Position Size, Return on margin, Annualized return on margin) y las dos barras de EL/NLV y
EL/MRGN. Dentro va el botón **Añadir al comparador**: primero se mira, después se añade.

## Un mismo número no puede tener dos cuentas
Las cifras salen de `metricasTrade`, sacada del cuerpo del comparador a nivel de módulo. La lista del
buscador tenía **su propia cuenta**, y no coincidía: usaba `strike × 100` como notional donde el
comparador usa `(strike − prima) × 100`. Es decir, el ROI de la fila y el de la tarjeta eran números
distintos para la misma operación. Ahora hay un solo camino, así que lo que ves en la previa es
exactamente lo que verás al añadirla. (El "% ann" de la fila no cambia: siempre fue el ROM
anualizado, y ese ya se calculaba igual.)

## La IV, en la fila
Cada candidata lleva ahora su **IV** junto a la POP y la delta: `95% ann · POP 71% · Δ 0.29 · IV 45.1`.

## Lo que falta: la volatilidad histórica
La IV la da OpenD y ya estaba descargada. La **histórica no la da nadie de lo que hay montado**: no
se puede sacar de los datos de opciones, hace falta el histórico de precios del subyacente. Está
pendiente de comprobar si el propio OpenD la trae en el snapshot; si la trae es un campo más en el
puente, y si no habría que pedir velas y calcularla. No se inventa mientras tanto.

## Comprobado
Al tocar una candidata salen los siete bloques de la tarjeta (sello, ann ROI, premium, ROI, riesgo,
BEP, tres recuadros y dos barras), la IV aparece en la fila, y el botón de dentro sigue metiéndola en
el comparador. Sin desbordes en viewport iPhone y `npm run prueba` con las 18 cifras intactas.

---

Bloques v4.76 — DC detrás de Screener, y otro icono

## Lo que pidió
Victor: *"El menú de DC ponlo después de Screener, y el logo piensa otro que ese no me gusta."*

## Cómo queda
El orden pasa a ser **Puts · Earnings · Screener · DC · Alertas**. Sigue apareciendo solo con
servidor propio, así que sus dos amigos ven las cuatro de siempre en el orden de siempre.

Y el icono deja de ser los dos calendarios solapados: ahora es **la doble joroba**, que es la forma
del resultado del montaje —dos picos en los strikes y el hundimiento del centro—, o sea el dibujo que
él mira en el modelador.

## Cómo se eligió
Dibujando cinco candidatos y mirándolos **a 22 píxeles de verdad**, que es el tamaño al que se ven:
la doble joroba, un reloj de arena, dos campanas, un reloj con un rango debajo y dos velas de tiempo.
A ese tamaño las campanas se emborronan en algo parecido a una "MM", el reloj con rango se llena de
ruido en la esquina y las velas parecen cualquier cosa. El reloj de arena se lee perfecto pero solo
dice "tiempo". La doble joroba se lee y además significa algo.

## Comprobado
Las cinco pestañas siguen cabiendo sin deslizarse, el orden es el pedido, los cinco iconos tienen
trazos dentro (el de DC, dos) y la pestaña sigue abriendo la herramienta. `npm run prueba` con las 18
cifras intactas y `payoff.mjs` sigue cuadrando.

---

Bloques v4.75 — El modelador

## Lo que pidió
Victor: *"Igual podemos hacer un modelador en condiciones para modular todo: IV cortas, largas,
media, strikes, y cómo evoluciona según pasa el tiempo."*

## Cuatro mandos
El botón de cada candidata pasa de *Ver la curva* a **Modelar este montaje**, y dentro:

- **Strikes**, con − y + por la escalera. Y aquí está lo importante: la escalera son los **precios
  reales** de cada strike, ya descargados en la misma llamada de la búsqueda. Así el débito de
  cualquier combinación que pruebes es de mercado, no estimado. Es literalmente lo que dice el
  manual en la página 4: *"start with 20 delta and then tweak from there"*.
- **Días**, de hoy al vencimiento de la corta. La curva se mueve, y la de puntos que queda de fondo
  es la del vencimiento: se ve cuánto falta por decantarse.
- **IV de la corta** y **IV de la larga**, por separado, en pasos de 2 y 4 puntos. Por separado y no
  una sola: lo que mata o salva un calendar es la **diferencia** entre las dos, y con un mando único
  esa diferencia no se puede tocar. Hay un tercer mando *las dos* para el susto general.

## La prueba de fuego, en pantalla
Arriba del todo del texto se lee lo que da el modelo **hoy, al precio de hoy y sin tocar nada**. Tiene
que ser **cero**: la IV de cada pata es justo la que explica su precio de mercado, así que si el
modelo no devuelve cero es que no está describiendo este mercado. En la prueba da **−$0,41** sobre un
débito de $180. Y se dice en verde o en ámbar según se salga o no de dos dólares.

## Lo que enseñó la propia prueba
Al comprobar los mandos salió algo que merece saberse: **el día que vence la corta, su IV ya no
influye en nada**. No le queda tiempo, así que moverla no cambia ni un céntimo del resultado final.
La IV de la corta solo pesa **por el camino** — si cierras antes. Mi prueba esperaba lo contrario y
estaba mal ella, no el modelo. Ahora comprueba las dos cosas: a mitad de recorrido, menos IV en la
larga empeora y menos IV en la corta mejora; al vencimiento, tocar la corta no mueve nada.

## Y un caso que no había visto
Con los strikes muy separados salen **cuatro** puntos de equilibrio, no dos: el hundimiento del
centro llega a bajar de cero y aparece una zona de pérdida en medio de la zona de ganancia. Es el
*sag* de la página 15 llevado al extremo, es correcto, y la prueba ahora lo admite (lo que no puede
salir nunca es un número impar de equilibrios).

## Comprobado
`payoff.mjs`, ampliada: Black-Scholes contra valores conocidos y paridad put-call · invariantes (muy
lejos del dinero se pierde exactamente el débito) · los números de la app contra una implementación
escrita aparte, con otra función de error (máximo $299,74 contra $299,73, centro $74,34 contra
$74,34, equilibrios $708,89 y $742,62 contra $708,89 y $742,61, débito $180,00 contra $180,00) · y
los cuatro mandos, uno a uno. Sin desbordes en viewport iPhone y `npm run prueba` con las 18 cifras
intactas.

---

Bloques v4.74 — La curva de resultado, y la frontera entre dato y modelo

## Lo que pidió
Victor, enseñando OptionStrat: *"¿Hay manera de montar una cosa así? Pero claro, tiene que estar
bien, porque OptionStrat mira mucho el sag que se va formando, se actualiza el precio y por tanto la
curva."*

## La frontera, que es lo importante de esta entrega
Hasta aquí **cada número de esta herramienta era dato de mercado**. Esta curva **no**: es un modelo.
Para saber qué da el montaje el día que vence la corta hay que saber cuánto valdrá la pata **larga**
ese día, y eso no lo dice nadie — se calcula con Black-Scholes suponiendo una volatilidad. OptionStrat
hace exactamente lo mismo; por eso lleva su control de IV al lado.

Así que se dice en pantalla, en ámbar: **el débito y la pérdida máxima son dato** (salen de los
precios reales de las cuatro patas; en un doble calendar con el mismo strike, muy lejos del dinero el
spread vale cero y pierdes exactamente lo que pagaste); **el máximo beneficio, los puntos de
equilibrio y la forma de la curva son del modelo**.

## Cómo queda
Botón **Ver la curva de resultado** en cada candidata. Dibuja el resultado por contrato el día que
vence la corta: la doble joroba con los picos en los strikes, el hundimiento del centro del que avisa
la página 15 del manual, verde por encima de cero y rojo por debajo, los dos puntos de equilibrio
escritos en el eje y **la franja del movimiento esperado sombreada encima** — eso último OptionStrat
no lo tiene, y es lo que dice si la zona de ganancia te cubre lo que el mercado da por normal.

Debajo, tres cifras (máximo beneficio · en el centro · pérdida máxima) y un mando: **si la IV de la
larga baja o sube 2 puntos**. No es un adorno: es el riesgo principal. En el ejemplo de la prueba,
dos puntos menos de volatilidad en la larga se llevan el resultado del centro de **+$74 a +$4**.

## Cómo se ha comprobado que está bien
Prueba nueva `payoff.mjs`, en cinco niveles:

1. **Black-Scholes contra valores conocidos** y contra la paridad put-call (desvío 3,6·10⁻¹⁵).
2. **Invariantes del montaje**: muy lejos del dinero se pierde exactamente el débito (−$180,00
   contra −$180,00), el máximo cae justo en un strike, hay dos equilibrios y el centro se hunde.
3. **Los números de la app contra una implementación escrita aparte**, con una función de error
   distinta a propósito: máximo $299,74 contra $299,73 · centro $74,34 contra $74,34 · equilibrios
   $708,89 y $742,62 contra $708,89 y $742,61.
4. **El mando de la IV mueve lo que debe**: menos volatilidad en la larga, menos beneficio.
5. Y que no desborda a lo ancho en viewport iPhone.

Aparecieron tres discrepancias y las tres eran de verdad: dos de la prueba (unos valores "de libro"
que yo recordaba mal, y la serie de Taylor de la función de error, que **diverge** lejos del dinero y
devolvía −3,8·10⁶²) y **una del código**: la rejilla del gráfico no caía nunca exactamente en los
strikes, y como el máximo de un doble calendar es un pico anguloso justo ahí, el máximo beneficio
salía unos $4,50 corto y los picos se dibujaban romos. Ahora los strikes y el precio de hoy entran
como puntos exactos de la rejilla.

---

Bloques v4.73 — Zoom donde se monta, y fuera las caídas de cero

## Lo que pidió
Victor: *"Que haga un poco más de zoom para ver claro dónde explorar DC."*

## El zoom
La curva llegaba a 60 días, y los vencimientos donde vive el montaje —los quince primeros— se
apelotonaban en la quinta parte izquierda del gráfico. Ahora arranca con **zoom en la ventana del
montaje**, que es donde se decide, y la vista larga sigue a un toque con el botón **60 días**, porque
el contexto de la curva entera también vale.

Con el zoom el gráfico pasa de diez puntos a seis, y las fechas del eje de dos a cuatro: `17 ago`,
`21 ago`, `24 ago`, `28 ago`. La diferencia se ve de golpe.

## Y un fallo que se veía en su captura
Ponía **"del 4 sep al 11 sep (−0.0)"**: un tramo pintado de verde, anunciado como favorable, cuya
caída escrita era **cero**. El umbral para llamar "tramo a la baja" a un tramo estaba en 0,01 puntos
de IV, que es el redondeo. Ahora hace falta una caída de al menos **0,1 puntos**. Ruido disfrazado de
señal es peor que no decir nada: un `−0.0` en verde invita a montar algo sobre una diferencia que no
existe.

## Comprobado
En los cuatro escenarios de la prueba —contango con bache, backwardation entera, contango puro y
semana con festivo— el zoom deja seis puntos y la vista larga diez, y **no aparece ni una caída
escrita como `−0.0`**. Sin desbordes en viewport iPhone y `npm run prueba` con las 18 cifras intactas.

---

Bloques v4.72 — El bache de la curva, con sus fechas

## Lo que dijo
Victor, sobre el gráfico de la estructura de volatilidad: *"¿Que se vea mejor ese backwardation en
fechas, no? Que se vea más claro."*

## El gráfico mentía por omisión
Decía **"de 3 a 49 días la IV SUBE 7,2 puntos: contango"** y se callaba que **por el camino baja**. En
su captura se ve clarísimo: la curva sube hasta el sexto día, cae, y luego sigue subiendo. Ese bache
es lo único que importa aquí — un tramo donde la IV cae con el plazo es un tramo donde el vencimiento
**corto es el caro**, que es exactamente lo que quieres vender en un calendar. El veredicto global de
punta a punta lo tapaba entero.

## Cómo queda
- **Cada tramo se pinta por su cuenta**: verde y más grueso el que BAJA, gris el que sube. El bache
  salta a la vista sin leer nada.
- **Cada caída lleva su número encima** (`−0.8`), en el propio tramo. Con vencimientos a tres días de
  distancia sus dos fechas no caben en el eje sin pisarse, así que el bache se señala solo.
- **El eje va en FECHAS** (`21 ago`, `9 oct`) y no en días sueltos, que es como se eligen los
  vencimientos de verdad. Las fechas del bache tienen **prioridad** sobre las de los extremos: los
  vencimientos de delante están tan juntos que solo caben dos o tres etiquetas, y poner primero la
  primera y la última se comía justo las que hay que ver.
- **Los vencimientos que usan los montajes llevan anillo violeta**, para saber dónde caen sobre la
  curva.
- Y la frase de debajo nombra los tramos que bajan con sus dos fechas.

## Una trampa que había que esquivar
Con la curva entera en backwardation, **todos** los tramos bajan y la frase enumeraba los nueve: un
párrafo ilegible, justo el ruido que se quitó en la v4.70. Los tramos que bajan se nombran solo
cuando son la **excepción** — si baja más de la mitad de la curva, la lectura global ya lo dice. Y
como mucho se nombran los dos que más caen.

## Comprobado
Tres escenarios: contango con un bache (nombra los dos tramos con sus fechas, dos tramos verdes,
`21 ago` en el eje), backwardation entera (no enumera nada, lo dice la lectura global) y contango puro
(ningún tramo verde). Sin desbordes en viewport iPhone y `npm run prueba` con las 18 cifras intactas.

---

Bloques v4.71 — Calendario de dos toques: probar cualquier par

## Lo que pidió
Victor, enseñando la tira de OptionStrat: *"¿Estaría bien este menú que pone el calendario y pulsas
la primera y la segunda? La primera sería el vencimiento corto y la segunda el largo, para ir
probando. Ya sé que tenemos fijos el 6/7, el 7/10, etcétera, pero igual que también puedas probar un
vencimiento nuevo y te saque los precios. ¿Cómo lo ves? O igual no tiene sentido."*

Sí lo tiene, y bastante: el manual dice que esto va de la curva de volatilidad (pág. 6), y la curva
cambia cada semana. Los cuatro pares son un buen punto de partida, no una jaula.

## Cómo queda
Una tarjeta **Probar otro par** con la tira de vencimientos disponibles, agrupados por mes, cada uno
con su día y a cuántos días está del viernes de entrada. Un toque elige la **corta** (azul), el
siguiente la **larga** (violeta), el tercero vuelve a empezar. No deja elegir una larga anterior a la
corta: al revés no es un calendar. Botón **Ver precios** y el par aparece al final de la lista, con
distintivo `A MANO`, y con exactamente lo mismo que los otros: banda del movimiento esperado, sellos
de ratio y curva, y los porcentajes del EM.

**Los días se cuentan desde el viernes de entrada**, igual que 5/7 o 7/14, así que un par probado a
mano se puede comparar con los fijos sin cambiar de reloj. Elegir el 26 y el 28 de agosto sale
`12/14`, no `12d, 14d` desde hoy.

## Por dónde va
Por el **mismo** camino que los cuatro fijos, no por uno paralelo. Es la regla de la casa y aquí
importa el doble: lo que se compara es precisamente un par contra otro, así que si los montara por
sitios distintos una diferencia de cálculo se leería como una diferencia de mercado.

Coste: la cadena se pide con el mismo rango de 60 días, así que el puente la sirve de su caché de 6
horas, y como solo hay dos vencimientos implicados salen **76 códigos** en vez de los 160 de la
búsqueda completa. Una búsqueda nueva descarta el par a mano — sus precios serían de otro momento.

## Un fallo de layout, cazado midiendo
La primera versión de la tira se veía rota: los chips se comprimían hasta solaparse y los números se
partían por la mitad. Faltaba `flexShrink: 0` en los días y en los grupos de mes. La prueba ahora
**mide** los chips: ninguno puede bajar de 36 px ni pisar al vecino. Y la etiqueta del mes pasa de
centrada a la izquierda, porque un mes de quince días es más ancho que la pantalla y centrada se
quedaba fuera de la vista.

## Comprobado
Elegir 12d y 14d en el calendario y pulsar Ver precios saca el montaje `12/14 · A MANO · mié AUG 26
→ vie AUG 28` con sus cinco candidatas y su banda, en una llamada de 76 códigos. Los 20 chips miden
36 px exactos y no se solapan. Los cuatro fijos siguen saliendo igual, no desborda a lo ancho, y
`npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.70 — La banda del movimiento esperado, dibujada

## Lo que dijo
Victor: *"¿Se te ocurren formas de que se vea mejor? Cuesta leerlo, que sea muy visual. Estaría bien
tener claro cuál es el EM, y que los strikes sugeridos pongan qué porcentaje de EM son."*

## De dónde venía el ruido
Mirando sus capturas, la mitad del texto de la pantalla era **la misma frase repetida cinco veces**.
La explicación de la IV ("la corta paga 0,9 puntos más que la larga: vendes la cara y compras la
barata") es idéntica en las cinco candidatas de un montaje —son los mismos dos vencimientos— y se
imprimía en cada una. Y la relación de cada strike con el movimiento esperado estaba en texto
(`put 0.7× · call 0.7×`), enterrada entre el ratio y la IV: para comparar cinco parejas había que
hacerlo de cabeza.

## Cómo queda
**La banda, dibujada.** Un gráfico por montaje con el eje en movimientos esperados: la franja ±1 EM
sombreada —lo que el mercado da por normal hasta el vencimiento corto—, el precio en el centro, y una
línea por candidata que va de su put a su call con los strikes escritos en las puntas. Verde si las
dos patas se salen de la franja, ámbar si alguna se queda dentro. De un vistazo se ve cuál es cuál.

**El porcentaje, en su sitio.** Cada fila lleva dos chips: `put 64% del EM` · `call 69% del EM`, con
color. Es lo que pidió, y ya no compite con el ratio ni con la IV por la misma línea.

**La frase de la IV, una sola vez**, en la cabecera del montaje que es donde vale para las cinco. Las
filas se quedan con los números y con el ratio explicado solo cuando NO llega al ideal — cuando lo
pasa, el chip verde ya lo dice.

**Los movimientos esperados, en dos columnas** en vez de diez filas a lo ancho, y los vencimientos
que usa algún montaje resaltados en violeta: son los únicos que hay que mirar para decidir hoy.

## Comprobado
La frase de la IV aparece **una** vez por montaje (antes, cinco). Los chips de porcentaje salen en
todas las filas. La banda se dibuja con sus cinco candidatas dentro. Sigue sin desbordar a lo ancho
en viewport iPhone, y en los tres escenarios de la prueba —curva a favor, curva en contra y semana
con festivo—. `npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

---

Bloques v4.69 — Estructura de volatilidad y movimiento esperado

## Lo que pidió
Victor: *"Estaría bien que me metieras en ese apartado el volatility term structure, y el expected
move. En plan en gráfico, o ver en cuánto estamos del expected move, para elegir strikes."*

Tenía toda la razón y era la pieza que le faltaba a esta herramienta: la página 6 del manual dice
literalmente que el Double Calendar **no va de DTE, va de la estructura de volatilidad**. Hasta ahora
solo se veían dos puntos de esa curva — la IV de la corta y la de la larga de cada montaje.

## Cómo queda
Una tarjeta nueva dentro del resultado de cada ticker, con dos cosas:

**El gráfico de la curva.** La IV en el dinero de cada vencimiento hasta 60 días, ~10 puntos. Debajo,
una frase que la lee: cuánto sube o baja en puntos, si eso es contango o backwardation, y qué
significa para lo que estás montando. La línea sale verde en backwardation (la curva a tu favor: la
pata que vendes es la cara) y gris en contango (lo normal, ni bueno ni malo).

**El movimiento esperado de cada vencimiento**, en dólares y en porcentaje. Y en cada fila de
strikes, a cuántos movimientos esperados está la put y a cuántos la call: `put 1.1× · call 1.0×`. Si
alguno se queda por debajo de 1× se avisa — tocarlo entra dentro de lo que el mercado da por normal.

## Una decisión de fondo
**El movimiento esperado NO se modela.** Es el precio de la put más la call del mismo strike en el
dinero: lo que el mercado está pagando por ese movimiento. Es dato, no estimación, y se dice en
pantalla de dónde sale. Es la misma regla del VIX de la v4.63 — un número inventado con pinta de dato
es peor que un hueco.

## Lo que cuesta
Nada en llamadas de opciones: para cada vencimiento bastan **dos contratos**, el par en el dinero, y
entran en la misma llamada que ya se hacía. Son ~160 códigos en total, por debajo del máximo de 200.
La cadena sí se pide a 60 días en vez de a 15, que el puente parte en tramos y cachea 6 horas.

## Una trampa que había que esquivar
Al estirar la ventana a 60 días, los vencimientos de dentro de un mes ya no son diarios (quedan los
viernes y poco más). El detector de festivos —que funciona por "falta un día entre semana, luego el
mercado estaba cerrado"— habría marcado como festivas todas esas semanas. Ahora solo juzga las dos
semanas del montaje, que son las únicas donde ese razonamiento vale.

## Comprobado
Con una cadena simulada que imita a QQQ (diaria las tres primeras semanas, solo viernes después):
la curva sale con 10 puntos y su lectura correcta, los movimientos esperados van de ±$11,25 a 3 días
hasta ±$29,85 a 28, las filas traen su `put 0.5× · call 0.6×`, y **ninguna semana lejana se marca
como festiva**. `npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

La prueba también cambia: sus precios simulados pasan a ser Black-Scholes de verdad. Los de antes
daban una straddle en el dinero del 3,9% a tres días sobre $725 — el doble de lo real—, y como el
movimiento esperado se lee justo de ahí, la prueba habría estado midiendo una banda inventada.

---

Bloques v4.68 — Dos sellos en vez de un veredicto, y "la mejor" deja de elegirse mal

## Lo que preguntó
Victor, viendo cinco montajes con ratios del 71% al 83% y todos en rojo: *"No me debería de salir
ese ratio con el IV de cortas y largas así, ¿no?"* Y después: *"Si están pagando esa prima las
cortas aunque la volatilidad sea más baja, es más seguro, ¿no?"*

## El ratio estaba bien
La prima va con la IV **por la raíz del tiempo**. Entre 5 y 7 días, √(5/7) = 85%: el ratio sale ahí
aunque las dos patas tuvieran idéntica volatilidad. La IV en contra (15,1 frente a 15,7) le quita
cuatro puntos → 81%. En pantalla ponía 83%. Cuadra. No había avería en el número.

## Pero había DOS averías detrás
**1. El veredicto se había comido todo.** En la v4.63, a petición suya, se exigió que la corta
tuviera más IV que la larga para dar verde. Pero la curva de volatilidad **sube con el plazo casi
siempre** — es el contango de las páginas 7-10, que el propio manual describe como el mercado
tranquilo en el que quiere que entres. Con vencimientos a dos días de distancia, esa condición casi
nunca se cumple: salía `NO` en todo, incluso con ratios del 83% cuando el manual pide 50% como
ideal. Un semáforo que siempre dice lo mismo no informa de nada.

**2. "La mejor" se elegía por el ratio, y eso es comparar huecos, no operaciones.** El 6/7 tiene un
día entre patas: √(6/7) = 93% de salida. El 7/14 tiene siete: 71%. Ordenando por ratio en bruto
ganaba SIEMPRE el 6/7, por construcción. Llevaba dos versiones abriendo esa por defecto por un
motivo que no tiene nada que ver con la calidad de la operación.

## Cómo queda
- **Dos sellos por montaje**: `RATIO ✓/~/✗` lleva el veredicto del manual —es su única regla con
  número (≥40%, ideal >50%, pág. 5)— y `CURVA ✓/✗` va aparte, con la brecha en puntos. Ninguno tapa
  al otro: nada dice "todo bien" con la curva en contra, y la curva tampoco tumba un ratio bueno.
- **El texto dice qué significa el ratio**: cuánto pones de tu bolsillo, y que ese débito es la
  pérdida máxima. Que es lo que Victor había intuido y el manual respalda ("the higher, the better").
- **Cuando la larga paga más IV se dice que es lo NORMAL**, no una avería. Antes se leía como una
  advertencia de que algo iba mal.
- **La cabecera de cada montaje trae la brecha de IV** ("la larga paga 0,6 pts más de IV"): ese es el
  número que sí se puede comparar entre montajes, porque no depende del hueco de días.
- **Se abre sola la de mejor curva** entre las que pasan el ratio, y el pie lo explica junto con el
  aviso de no comparar ratios entre montajes.

## Comprobado
Con la curva a favor: los cuatro salen `RATIO ✓ + CURVA ✓`. Con la curva en contra (contango, que es
lo que él está viendo): los cuatro salen `RATIO ✓ + CURVA ✗` con las brechas 0,6 · 0,3 · 0,9 · 2,1
puntos, y sigue abriéndose una — antes, con la regla vieja, no se abría ninguna y todo era rojo.
`npm run prueba` sigue dando las 18 cifras idénticas sin servidor propio.

Aviso sobre la simulación: su curva de IV es lisa, así que la menor brecha cae siempre en el montaje
de patas más juntas. En el mercado real la semana de delante suele tener su propio bulto (eventos,
fin de semana) y ahí la brecha sí discrimina de verdad.

---

Bloques v4.67 — Los cuatro montajes del manual, contados desde el viernes de entrada

## Lo que dijo
Victor: *"Me sacas solo de miércoles a viernes, sácame todas las opciones que tiene el PDF, y que se
pueda colapsar. Las entradas pueden ser miércoles semana siguiente la corta y viernes la larga, o
jueves corta viernes larga, o viernes corta lunes larga, o viernes corta viernes siguiente larga.
Eso es 5/7, 6/7, 7/10, 7/14. Porque las entradas son siempre en viernes."*

## La pieza que faltaba
Ahí está lo que yo no había entendido del manual. Los cuatro pares (mié/vie, jue/vie, vie/lun,
vie/vie, pág. 4) **no son dos vencimientos cualesquiera que caigan en esos días**: son días contados
desde el viernes en el que se entra. Yo los buscaba por día de la semana suelto, y eso hacía dos
destrozos a la vez:

- **Salían parejas que no son el montaje.** Un mié 26 → vie 28 encaja en "mié/vie", pero está a
  12/14 días: es la operación de la semana siguiente, no la de esta.
- **Y faltaban las de verdad.** Al buscar en las tres semanas siguientes hacían falta ocho
  vencimientos distintos, y por el cupo de la API solo se pedían los seis primeros. Los dos que se
  caían eran justo los del 7/14 y los de las parejas lejanas. Resultado: el 7/14 no aparecía nunca.

Además había una tercera avería, más callada: los strikes se elegían **por separado en cada
vencimiento** (los 14 más cercanos al precio). La pata larga tiene que ser del mismo strike que la
corta, así que en cuanto un vencimiento tenía la escalera un poco distinta el montaje se caía sin
decir nada. Y 14 strikes de $1 en QQQ son un 1,9% del precio, cuando una delta 0,10 a una semana
está al 3%: los objetivos bajos no llegaban.

## Cómo queda
Se calcula el **viernes de entrada** (hoy si hoy es viernes, si no el que viene) y de ahí salen los
cuatro montajes, siempre los cuatro: **5/7** (corta mié, larga vie), **6/7** (jue → vie), **7/10**
(vie → lun) y **7/14** (vie → vie siguiente). El viernes se dice en pantalla, junto al precio.

Cada montaje es una **cabecera plegable** con su veredicto, cuántas candidatas trae y el mejor ratio,
para poder elegir cuál abrir sin desplegarlos todos. Se abre sola la mejor de las que pasan las dos
reglas; si ninguna pasa, no se abre ninguna — abrir una mala por defecto la haría parecer la
recomendada.

Los strikes ahora son **los mismos en los cinco vencimientos**: se elige una sola lista (los que
existen en todos, dentro de un 5% del precio) y se pide esa lista entera. Si hay más de 16 por lado
se cogen salteados, porque lejos del dinero lo que hace falta es alcance, no resolución. Son 145–160
códigos en **una** llamada, bajo el máximo de 200.

## Un montaje que no se puede montar lo dice
Si a un montaje le falta un vencimiento porque ese día el mercado está cerrado, **no desaparece**:
sale igual, en gris, diciendo qué día falta. Un montaje que se esfuma sin explicación no se distingue
de uno que no compensa, y son cosas muy distintas. Es la misma regla de siempre — callarse no es un
estado neutro. Y el aviso de semana con festivo se ve ya en la cabecera plegada, sin abrir: es
información para decidir, no un detalle.

## Comprobado
Con una cadena simulada de QQQ con vencimiento todos los días hábiles y strikes de $1:
- salen **los cuatro** montajes con las fechas correctas, una sola llamada de 145 códigos;
- las deltas mostradas van de 0,09 a 0,31 (antes, con la banda corta, se quedaban todas pegadas
  al 0,30);
- quitando el lunes del 7/10, ese montaje sigue en la lista diciendo *"No hay vencimiento el lun
  24/08"*;
- con la curva de IV al revés los cuatro salen **NO** y no se abre ninguno solo;
- plegar y desplegar a mano funciona en los dos sentidos, y la página no desborda.

La delta simulada de la prueba pasa a ser la de Black-Scholes de verdad: la anterior era mucho más
gorda de colas —la delta 0,10 caía al 10% del precio en vez de al 3%— y con eso la prueba no
distinguía una banda de strikes buena de una corta, que es justo lo que había que medir.

`npm run prueba` sigue dando las 18 cifras idénticas para quien no tiene servidor propio.

---

Bloques v4.66 — El icono de DC, ahora sí

## El síntoma
Victor, sobre la v4.65: *"Sigue sin icono."* La pestaña DC salía con su texto pero sin dibujo, un
hueco en blanco entre Earnings y Screener.

## La causa
El dibujo de la v4.64 se metió en el juego de iconos **equivocado**. La app tiene tres: `NavIcon`
(la barra de abajo), `SetIcon` (Ajustes) y `ActIcon` (todo lo demás, incluida la fila de pestañas de
Herramientas). El calendario doble se añadió a `NavIcon`, que esa fila no usa. `ActIcon` no reconocía
el nombre `dobles`, así que no pintaba nada — y un `<svg>` sin trazos dentro **ocupa su sitio igual**:
no falla, no avisa, simplemente no se ve.

## El arreglo
El dibujo pasa a `ActIcon`, con un comentario al lado diciendo por qué va ahí. Se quita de `NavIcon`,
donde no lo usaba nadie.

## Por qué se coló dos veces
La comprobación miraba el **texto** de la pestaña ("¿pone DC?") y la captura la miré por encima. La
prueba ahora cuenta los **trazos dentro del SVG** de las cinco pestañas: Puts 3 · Earnings 3 · DC 4 ·
Screener 1 · Alertas 1. Con un icono vacío ese número es 0 y salta. Es el mismo patrón de siempre:
lo que no se mide se cuela.

## Comprobado
`build … ok — app v4.66`, `node --check` limpio, `npm run prueba` con las 18 cifras intactas, y en
Chromium con viewport iPhone: dibujo presente, la fila sigue cabiendo sin deslizarse y la pestaña
sigue abriendo la herramienta.

---

Bloques v4.65 — La pestaña se llama DC

## Lo que pidió
Victor: *"Cambia la pestaña de nombre a DC."*

## Cómo queda
La pestaña de Herramientas que ponía **Double Cal** ahora pone **DC**, que es como la llama él.

## Por qué importa
"Double Cal" era un nombre cortado a medias: ni el completo ni el que se usa hablando. Además el
selector de Herramientas tiene cinco pestañas en una fila que se desliza, y cada letra de más empuja
a las de los lados fuera de la pantalla.

## Comprobado
Compila (`build … ok — app v4.65`), `node --check` limpio y `npm run prueba` sigue dando las 18
cifras idénticas para quien no tiene servidor propio (esa pestaña ni le sale).

---

Bloques v4.64 — Las búsquedas se quedan guardadas, plegadas por ticker

## Lo que pidió
Victor: *"Puedes dejar guardadas las que busque hasta refrescar, lo mismo con las puts. Igual se
pueden colapsar por ticker hasta que se borren. Y ponme un icono en la pestaña de DC."*

## Cómo queda
Los **dos** buscadores —Puts y Double Calendar— guardan lo que encuentran. Cada ticker es una fila
plegada con su precio, cuántos resultados trae y cuándo se buscó. Se toca y se abre; se toca otra vez
y se cierra. La **✕** borra ese ticker.

Buscar el mismo ticker **reemplaza** lo suyo; los demás se quedan. Así se pueden ir acumulando
NVDA, QQQ y lo que haga falta sin que la pantalla se convierta en una lista infinita.

**Sobreviven a cerrar la app.** Se guardan en el dispositivo, pero **no viajan en el backup**: son
datos de mercado, como las marcas de precios o el % del día. Un backup que llevara dentro los
precios de una búsqueda de hace tres semanas sería justo lo que se arregló en la v4.56.

## El icono
La pestaña de Double Calendar llevaba prestado el del calendario de Vencimientos. Ahora tiene el
suyo: **dos calendarios solapados**, que es literalmente la estrategia — el mismo strike en dos
vencimientos distintos.

## Verificación
En Double Calendar, con dos tickers seguidos:

| | Resultado |
|---|---|
| Tras buscar QQQ y luego SPY | los dos guardados: **1 abierto, 1 plegado** |
| **Tras recargar la app entera** | **los dos siguen**, plegados |
| Tras pulsar la ✕ de QQQ | QQQ fuera, **SPY sigue** |

Y en el de Puts lo mismo: cabecera plegable *"NVDA · $168.2 · 15 candidatas · 14 ago, 01:18"*, y
tras recargar la app sigue ahí plegada. Sin errores de consola y sin desbordar a lo ancho.

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.63 — Tres correcciones de Victor a la herramienta Double Calendar

## 1. Fuera el VIX estimado
*"Quita el VIX que ese pseudo no funciona."*

Tenía razón. Sacarlo de la IV de una opción daba **un número con pinta de dato que no lo era**, y
encima decidía un semáforo. Se quita. Queda solo el campo para escribirlo: si lo pones, se juzga
contra la ventana 15–25 del manual; si no, no se juzga. Un hueco honesto es mejor que una cifra
inventada.

## 2. Varios strikes por par, y desde mañana
*"Me tienes que dar más info, entradas mañana, varios strikes."*

Antes salía **un** montaje por par de vencimientos, el de delta 20 clavado. Ahora salen **varios
alrededor del objetivo** (0,10 a 0,30), agrupados bajo cada par, para ver cuánto se abre o se cierra
la horquilla en vez de fiarse de un solo número. En la prueba: de 6 montajes a **16**.

Y los vencimientos empiezan **mañana**: uno que vence hoy no es una entrada, es una expiración.

Para que las deltas bajas fueran alcanzables hubo que ensanchar la banda de strikes: era de 12 por
lado y se quedaba a ±4% del precio, así que **todos los objetivos caían en el mismo strike**. Ahora
14 por lado y solo del lado que toca — con strikes de $5 en QQQ, ~10%, que llega de sobra hasta
delta 0,10. Siguen siendo 168 códigos como mucho: **una sola llamada**.

## 3. El verde que tapaba un fallo
*"El IV de la corta debería de ser más alto que la larga, si no… y sin embargo me lo pones en verde."*

Este era el importante. El ratio pintaba la tarjeta de verde **mientras la curva de volatilidad iba
en contra** — comprando la pata cara y vendiendo la barata. El texto lo decía, pero el color decía
lo contrario, y el color se lee antes.

Ahora el veredicto **exige las dos condiciones**: solo hay `OK` si el ratio pasa del 50% **y** la
pata corta tiene más IV que la larga. Si falla cualquiera de las dos, `NO`. Y cada cifra lleva su
propio color, así que se ve cuál es la que falla.

## Verificación
Misma cadena simulada de QQQ, en los dos escenarios de volatilidad:

| Escenario | Montajes | Veredictos |
|---|---|---|
| IV que baja con el plazo (a favor) | 16 | **16 OK** |
| **IV que sube con el plazo (en contra)** | 16 | **16 NO — ni un solo verde** |

Y lo demás sigue: deltas variadas (0,15 · 0,21 · 0,25 · 0,31) con strikes distintos, put siempre
bajo el precio y call siempre encima, aviso de festivo en los pares que tocan la semana corta,
**3 llamadas al servidor** en total, sin desbordar y sin errores de consola.

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.62 — Herramienta Double Calendar / Double Diagonal

## Lo que pidió
Victor pasó el manual de OptionsKit (24 páginas) y pidió una herramienta que, con esas reglas,
le ayude a encontrar entradas en SPX o QQQ, con lectura del VIX incluida.

## Las reglas que se han programado, con su página

| Regla | Pág. |
|---|---|
| Entrar **solo con el VIX entre 15 y 25** | 20 |
| Empezar en **delta 20** y ajustar desde ahí | 4 |
| Pares de vencimientos: **mié/vie · jue/vie · vie/lun · vie/vie** | 4 y 13 |
| **Ratio corto/largo ≥ 40%**, ideal >50% | 5 |
| Peor tasa de acierto en **semanas con festivo** | 4 |
| Sirve para **SPY y QQQ** | 4 y 13 |

## Tres cosas del manual que NO se pueden aplicar tal cual, y se dicen en pantalla

**1. El SPX no existe para OpenD.** Comprobado en el VPS: `US.SPX`, `US.SPXW` y `US.VIX` dan
"Unknown stock". Sí están `US.QQQ` y `US.SPY` — que es lo que el propio manual dice que vale igual.

**2. El VIX no lo da nadie.** Ni OpenD ni Finnhub (*"Market data subscription required for CFD
indices"*). Se **estima** con la IV de la opción en el dinero, se dice de dónde sale, y **queda
editable**: si Victor teclea el de su bróker, manda el suyo. Es una regla de entrada dura y no vale
dar por bueno un número cuyo origen no se ve.

**3. La curva de futuros del VIX** (contango/backwardation, págs. 7-10) son futuros, otro producto.
En su lugar se enseña **la IV de la pata corta contra la de la larga** — la misma idea aplicada a la
operación concreta en vez de a un índice de referencia.

## Un detalle del que estoy contento
Las **semanas con festivo se detectan solas**. SPY y QQQ tienen vencimiento todos los días hábiles,
así que si en una semana falta un día entre semana, ese día el mercado estaba cerrado. Sin lista de
festivos que mantener y sin fecha de caducidad.

## Un fallo que la prueba cazó
La primera versión ponía **la put y la call en el mismo strike, y por encima del precio**. Causa:
elegía por |delta| más cercano a 0,20 sin mirar de qué lado del precio estaba, y un strike muy dentro
de dinero al otro lado puede tener un |delta| parecido. Ahora la put solo puede estar por debajo del
precio y la call por encima, y se descarta cualquier delta ≥ 0,50 (eso es dentro de dinero, no es una
pata corta).

## Verificación
Cadena simulada de QQQ con vencimiento todos los días hábiles de tres semanas y **el lunes de la
segunda semana quitado a propósito**, para probar la detección de festivos:

| | Resultado |
|---|---|
| Pares encontrados | **6**, todos de las combinaciones del manual |
| Strikes | put $700 · call $755 con el precio en $725 — **ninguno del lado equivocado** |
| Ratios | 98% · 95% · 95% · 94% · 87% · 77%, ordenados de mejor a peor |
| Aviso de festivo | en **4 de 6** — exactamente los que tocan la semana sin lunes |
| VIX estimado | 17,8 → dentro de la ventana, en verde |
| Llamadas al servidor | **3** en total (cotiza, cadena, opciones) |
| Ancho | no desborda |
| Consola | sin errores |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas. La pestaña **solo
existe con servidor propio**.

Bloques v4.61 — El buscador filtra por DELTA, no por strike

## Lo que dijo Victor
*"Los deltas están muy agresivos, deberían de estar 0.3 para abajo."*

Tenía razón y el fallo era de raíz: el buscador cogía **los 5 strikes más cercanos al dinero**, y el
primero salía casi ATM (Δ 0,49). Filtrar por strike era un mal sustituto de lo que él mira de verdad,
que es la delta.

## Cómo queda
Un campo más al lado del ticker: **delta máxima**, 0,30 por defecto. Se bajan bastantes más strikes
de los que se enseñan (la delta no se sabe hasta pedir el precio), se descartan los que se pasan del
umbral, y de los que quedan se enseñan **los 5 que más pagan** — que son los de strike más alto.

Es decir: *dentro de tu límite de riesgo, la que más paga*.

La cabecera lo dice: *"14 con Δ ≤ 0.30 · 15 descartadas por delta"*. Las descartadas se cuentan en
vez de desaparecer en silencio.

Y el umbral queda a mano porque hay días de querer 0,20 y días de querer 0,40: es un número, no una
decisión de diseño.

## Lo que cuesta
Se piden 45 contratos en vez de 15 — pero **sigue siendo UNA sola llamada** al servidor, así que
para tu cuenta compartida cuesta exactamente lo mismo que antes.

Si un contrato no trae delta, **no se cuela**: si no se puede comprobar que respeta el umbral, fuera.
Pero se cuenta, para poder decirlo.

## Dos errores míos por el camino, los dos ya conocidos
1. **Rejilla sin `minmax(0, 1fr)`.** La tarjeta se ensanchó hasta el texto más largo que contenía
   ("15 descartadas por delta") y **desbordó la página entera**: el botón Buscar y los precios
   quedaban cortados por la derecha. Ya pasó una vez en Ajustes y está anotado en las notas del
   proyecto. Detectado midiendo, no a ojo: elementos con el borde derecho en 428 px sobre una
   pantalla de 390.
2. **Comentario `{/* */}` justo antes de un elemento dentro de `{condición && (`.** Rompe la
   compilación. Tercera vez que pasa; también estaba anotado.

## Verificación
Con la cadena simulada de 636 contratos:

| | Resultado |
|---|---|
| Deltas mostradas | 0.29 · 0.26 · 0.23 · 0.21 · 0.19 (×3 vencimientos) |
| **La más agresiva** | **0.29 — ninguna se pasa de 0.30** |
| Descartadas por delta | 15, y se dice |
| Contratos pedidos | 45, en **una** llamada |
| Ancho de la página | documento 390 = ventana 390, **sin desbordar** |
| Consola | sin errores |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.60 — El buscador de puts, legible

## Lo que dijo Victor
*"Viene muy raw. Estaría bien que saliera el spot del ticker a la vez, y ¿cómo me las podrías
agrupar para mejor lectura? ¿Strike? ¿O DTE?"*

## La respuesta: por vencimiento
Dentro de un vencimiento estás eligiendo **cuánto riesgo quieres**: bajas de strike y bajan la prima
y la delta. Entre vencimientos decides **otra cosa**: si te compensa irte más lejos en el tiempo.

En una lista plana hay que hacer las dos comparaciones a la vez, y por eso no se leía. Ahora va
agrupado por vencimiento, con su fecha y sus días a la derecha, y dentro los strikes ordenados de
más cerca del dinero a más lejos.

## Lo demás que cambia
- **El spot, a la vista y grande.** Estaba escondido en una línea gris, y es la referencia contra la
  que se lee cada strike. Ahora encabeza el resultado: `NVDA $168.2`.
- **La mejor va marcada** con un recuadro verde y una chapa `MEJOR`, según el criterio que ya
  tuvieras elegido en el Comparador — y se dice cuál es: *"mejor por ROM anualizado"*.
- **Cuánto está fuera de dinero cada strike**, en % junto al precio. Es lo que de verdad se compara
  entre vencimientos distintos, más que el número del strike.
- **Dos líneas cortas en vez de una larga.** Con el botón al lado quedaban 250 px para cuatro cifras
  y se partía siempre, dejando "est. $3,044" colgando solo. El margen baja a su propia línea —que
  además es donde debe estar lo estimado— y el resto cabe de una vez.

## Verificación
Con la cadena simulada de 636 contratos:

| | Resultado |
|---|---|
| Cabecera | `NVDA $168.2 · 14 candidatas · mejor por ROM anualizado` |
| Grupos | `SEP 16 '26 · 33 días` · `SEP 30 '26 · 47 días` · `OCT 14 '26 · 61 días` |
| Marca la mejor | sí |
| Contratos pedidos | **15, en una llamada** |
| Añadir | entra en el comparador |
| Sin servidor | la tarjeta no existe |
| Consola | sin errores |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.59 — Buscar puts sin lector de capturas

## Lo que pidió
Victor: *"En la herramienta de Put, ¿puedes hacer que en lugar de tener que usar el lector, haya un
menú oculto que solo sale si está el servidor activado, donde pongo el ticker y el DTE y me
compara?"*

## Cómo queda
En Herramientas → Puts, arriba, una tarjeta **que solo existe si hay servidor propio**. Escribes el
ticker, pulsas Buscar, y salen las candidatas con su prima, delta, POP, rentabilidad anualizada
sobre margen y el margen estimado. Cada una con un botón de **Añadir**, que la mete en el
comparador de siempre.

Mira los vencimientos más cercanos a **30, 45 y 60 días** y trae **5 strikes por debajo del precio**
de cada uno.

## Tres decisiones que gobiernan esto

**1. No se piden los 700 contratos.** Una cadena de NVDA trae 758. Se filtra a puts entre el 70% y
el 100% del precio, y como mucho 5 por vencimiento: **15 contratos en UNA sola llamada**. Pedir de
más en una cuenta compartida con el sistema de earnings y con el agente de puts es sacarle el dinero
del bolsillo a otro.

**2. El margen es una ESTIMACIÓN y se dice.** Se calcula con la regla de Reg-T —la que aplican los
brokers en cuentas normales— porque **OpenD no sabe el margen**: no es un dato de mercado, es lo que
decide el bróker. Va en ámbar, con la palabra "est.", y con un aviso debajo. Se puede editar como
cualquier otro campo. Con margen de cartera IBKR pide bastante menos, así que conviene comparar una
vez con la cuenta real.

**3. Las candidatas NO entran solas en el comparador.** Salen en una lista aparte y se añade la que
se elija. Una búsqueda de quince no te llena la herramienta de tarjetas que no querías.

Y **no se inventa un criterio nuevo**: el orden y el veredicto los sigue poniendo el que ya tenías
elegido (por defecto, Annualized return on margin).

## Lo que no se puede sacar del servidor
La POP se deriva de la delta (`1 − |delta|`, la aproximación de siempre). Si un contrato no trae
delta, se deja vacía en vez de inventarla.

## Verificación
Con una cadena simulada de la forma de la real de NVDA — 6 vencimientos × 53 strikes × 2 tipos =
**636 contratos**:

| | Resultado |
|---|---|
| Vencimientos elegidos | **33, 47 y 61 días** (los más cercanos a 30/45/60) |
| Contratos pedidos al servidor | **15, en UNA llamada** (de 636) |
| Candidatas con precio | 14 de 15 |
| Aviso de margen estimado | sí |
| Pulsar Añadir | la candidata entra en el comparador y desaparece de la lista |
| **Sin servidor propio** | **la tarjeta no existe** |
| Errores de consola | ninguno |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.58 — Una sola llamada al servidor, y griegas también con el mercado cerrado

## El hallazgo
Probando el puente en el VPS con el mercado cerrado, salió esto para un contrato de NVDA:

```
delta: -0.0319   theta: -0.0350   gamma: 0.0020   vega: 0.0506
iv: 51.32        interés abierto: 68890
```

**Todo lleno.** O sea que lo de "OpenD no da griegas fuera de horario" **nunca fue verdad**: se
estaban pidiendo por la puerta equivocada. La función que usaba el puente (`get_stock_quote`) no las
trae; la del snapshot sí — y además trae la horquilla, gamma y vega de regalo.

## Dos cambios, uno detrás del otro

**1. El 🔄 Precios hace UNA llamada, no una por contrato.** El snapshot admite cientos de códigos de
golpe. Con 26 posiciones eso eran 26 llamadas con sus pausas; ahora es una. El cupo de OpenD es de la
CUENTA y ahí viven también el sistema de earnings y el agente de puts: esto no es afinar, es dejar de
molestar. Si el servidor todavía es el viejo y no conoce la ruta nueva, se vuelve solo al camino de
antes — nadie se queda sin precios por no haber actualizado.

**2. Se usa el PUNTO MEDIO de la horquilla, no el último precio.** El último puede ser de hace horas
en un contrato poco líquido. El medio entre lo que te pagan y lo que piden es lo que de verdad
costaría cerrar.

## Y una corrección de lo que decía la app
La v4.57 escribía: *"con el mercado cerrado el servidor manda precio pero no griegas"*. Ya no es
cierto. Ahora las manda — son **las del cierre**, que es distinto: no faltan, es que no se mueven
hasta que abra. La frase pasa a *"Delta y theta son del cierre de 13 ago, 15:06: con el mercado
cerrado no cambian."*

Y **cómo se decide si son del cierre también cambia**: antes se miraba si habían llegado; ahora se
mira **la hora que trae el propio dato**. Si lleva más de 20 minutos parada, la sesión está cerrada.
El margen es discutible, pero da igual: **la hora exacta se enseña siempre**, así que nadie depende
de que yo acierte con el umbral.

## Verificación
Ocho escenarios en iPhone 13, claro y oscuro:

| | Resultado |
|---|---|
| Con servidor | theta +$19 · delta +$11.102 · **1 sola llamada** a `/opciones` |
| **Sin servidor** | **0 llamadas**, tarjeta inexistente |
| Servidor viejo (sin la ruta nueva) | vuelve al camino de uno en uno |
| Dato de hace 9 h | `DEL CIERRE` + *"del cierre de 13 ago, 15:06"* |
| Sin haber pulsado 🔄 | dice que lo pulse |
| Precio sin griegas | lo explica |
| Con un Iron Condor fuera | aviso de cobertura |
| Modo privado | importes tapados |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.57 — Con el mercado cerrado, las griegas del cierre en vez del mensaje feo

## Lo que pidió
Victor, tras ver el aviso de la v4.55 con el mercado cerrado: *"si tienes servidor, que guarde la
última que tenga para que no se me quede con este mensaje feísimo"*.

Tiene razón, y además es lo que hace cualquier broker: fuera de horario enseñan las últimas griegas
que tuvieron, no un hueco.

## Qué pasaba
Fuera de horario, OpenD manda **precio pero no delta ni theta**. La app las guardaba igual —vacías—
encima de las buenas, así que la tarjeta se quedaba sin nada que enseñar y salía el aviso.

## Cómo queda
Si las griegas nuevas no valen, **se conservan las de ese mismo contrato**. Sigue sin fusionarse la
tabla entera: solo se rellenan los códigos que la posición tiene HOY, así una posición rolada
descarta igual lo que ya no le corresponde.

Y **la chapa dice la verdad**: pasa de `EN VIVO` (violeta) a `DEL CIERRE` (ámbar), y debajo se dice
de cuándo son: *"Delta y theta son de 13 ago, 23:28: con el mercado cerrado el servidor manda precio
pero no griegas."*

Poner `EN VIVO` sobre unas griegas de ayer sería mentir en una etiqueta, que es la peor forma de
mentir: nadie va a comprobar una etiqueta.

**Los precios sí siguen refrescándose** — el mercado cerrado no impide que OpenD dé el último precio
del contrato. Lo único que se congela es delta y theta.

## Un detalle de cómo se sabe
La primera versión comparaba la hora de las griegas con la de los precios, con un margen ("¿un
minuto? ¿diez?"). Eso falló en la propia prueba: dos refrescos seguidos caen dentro de cualquier
margen razonable. Ahora **se guarda el hecho, no la hora**: cada refresco anota si trajo griegas
frescas o si conservó las anteriores. Sin heurística que ajustar y sin margen que equivocar.

## Verificación
Dos refrescos seguidos en el mismo móvil, con el mismo dato:

| | Chapa | Theta | Delta | Nota |
|---|---|---|---|---|
| **1º, mercado abierto** | `EN VIVO` | +$19 | +$11.102 | "De las 2 que tienes, todas" |
| **2º, mercado cerrado** | **`DEL CIERRE`** | **+$19** (conservado) | **+$11.102** | + "Delta y theta son de 13 ago, 23:28…" |

Y los casos de antes siguen igual: sin servidor la tarjeta no existe; con servidor pero **sin haber
tenido nunca** griegas, sale la explicación de la v4.55 (no hay nada que conservar); con un Iron
Condor fuera, el aviso de cobertura. `npm run prueba` en verde.

Bloques v4.56 — Candado: sin servidor propio, ni una marca

## Lo que dijo Victor
*"No quiero que a mis amigos les salga, o sea, si no tienen esa funcionalidad, que no desaparezca el
menú."*

Lo primero ya estaba bien: sin servidor configurado, la tarjeta de griegas no existe (no sale vacía
ni deja hueco), y las 18 cifras de la prueba salen idénticas. Pero al comprobarlo apareció **un
agujero real** que él no había visto y yo tampoco.

## El agujero
El backup se lleva **todo** lo que tiene una posición (`...p`), y desde la v4.51 eso incluye las
marcas y las griegas que trae el servidor. Los backups se comparten por chat — es la razón por la
que la clave del puente se dejó fuera a propósito.

O sea: el día que Victor le pasara su copia a un amigo, ese amigo habría visto **`P&L · REAL`** y la
tarjeta de griegas, con **precios de Victor congelados hace semanas**. Números que parecen en vivo y
llevan muertos desde el día del backup. Eso es peor que no tener el dato: parece exacto.

## El arreglo, por los dos lados
1. **Candado.** Sin servidor propio configurado **no se usa ni una marca**, esté guardada o no. La
   app se comporta exactamente como antes de la v4.51, venga de donde venga el dato. Por defecto
   está cerrado, que es el lado seguro mientras se carga la configuración.
2. **Las marcas dejan de viajar en el backup.** Son dato de MERCADO, re-descargable con un 🔄
   Precios — igual que el % del día, que tampoco se guarda nunca. Quitarlas no rompe nada: si
   faltan, la posición calcula como siempre.

El primero solo hace falta por el segundo (los backups viejos ya llevan marcas dentro), pero se
quedan los dos: uno tapa el origen y el otro la consecuencia.

## Verificación
Se simuló el caso exacto: **el backup de Victor abierto en el móvil de un amigo sin servidor.**

| | Amigo (sin servidor) | Victor (con servidor) |
|---|---|---|
| P&L de la TMDX | **+$772** — el simulado de siempre | **+$462** — el real |
| Etiqueta `P&L · REAL` | **no** | sí |
| `vale 3.10` en la fila | **no** | sí |
| Tarjeta de griegas | **no existe** | sí |
| Llamadas al servidor | **ninguna** | 1 |
| ¿Su backup lleva marcas? | **no** | **no** |

Y `npm run prueba` sigue en verde: las 18 cifras, idénticas.

Bloques v4.55 — La tarjeta de griegas dice por qué no hay datos, en vez de desaparecer

## Síntoma
Victor, con la v4.54 recién instalada: *"No me salen las griegas de la cartera"*. Y la app no decía
nada: donde tenía que estar la tarjeta, simplemente no había nada.

## Causa
Mía, y ya cometida antes. La tarjeta se pintaba **solo** si había al menos una griega completa; si no,
devolvía `null` y no se veía. Eso deja a quien mira adivinando entre tres cosas muy distintas: que
no hay datos todavía, que la app está rota, o que no se ha actualizado.

Es exactamente el mismo error que la calculadora de earnings de la v4.46, donde la herramienta
desaparecía sin explicar que le faltaba el precio del subyacente. **Callarse no es un estado neutro:
es la peor respuesta posible**, porque no se puede distinguir de una avería.

## Arreglo
Si hay servidor propio configurado y posiciones de opciones, la tarjeta **aparece siempre**. Y cuando
no hay griegas, dice cuál de los dos motivos es — que no son el mismo, ni tienen la misma solución:

- **Aún no se ha pedido nada:** *"Todavía no hay datos. Pulsa 🔄 Precios y tu servidor mandará el
  precio y las griegas de cada contrato."*
- **El servidor mandó precio pero no griegas:** *"Tu servidor mandó los precios pero no las griegas
  (delta y theta) de TMDX, NVDA. Suele pasar con el mercado cerrado o con contratos que OpenD no
  cubre. Vuelve a probar en horario de mercado."*

Sin servidor propio la tarjeta sigue sin existir: ahí no hay nada que prometer.

## Verificación
Playwright en iPhone 13, los siete escenarios:

| Escenario | Esperado | Salió |
|---|---|---|
| Con griegas completas | +$19/día · +$11.102 | ✓ |
| Con un Iron Condor fuera | aviso ámbar nombrando SPX | ✓ |
| Modo privado | importes tapados | ✓ |
| Oscuro | igual que en claro | ✓ |
| **Sin servidor propio** | **la tarjeta no existe** | ✓ |
| **Servidor manda precio sin griegas** (mercado cerrado) | **lo explica** | ✓ |
| **Aún sin pulsar 🔄 Precios** | **dice que lo pulse** | ✓ |

`npm run prueba` en verde: las 18 cifras de un usuario sin servidor, idénticas.

Bloques v4.54 — Theta y delta de la cartera

## Lo que pidió
Victor, el 13-ago: *"estaría bien sacar de aquí el portfolio theta y delta, saber qué theta diario
sacamos, pero no sé dónde lo podríamos incluir"*. Se dejó pendiente a propósito hasta que las
estructuras de varias patas dieran griegas (v4.53): antes, un condor habría entrado como cero y el
theta de la cartera habría salido **corto en silencio**, que es la peor forma de estar mal.

## Cómo queda
Una tarjeta propia justo bajo el valor de la cuenta, con dos cifras:

- **Theta / día** — lo que recoges (o pagas) cada día por el paso del tiempo, en dólares. Debajo, a
  cuánto equivale al año *a ese ritmo*.
- **Delta en $** — tu exposición direccional. Positiva = te mueves como si fueras largo.

Y debajo, **siempre**, de cuántas posiciones sale.

## Las tres decisiones que importan

**1. Theta en dólares al día, no en unidades de theta.** La que da OpenD es por acción y por día
(−0,08 = ese contrato pierde 8 céntimos por acción al día). Lo que gana la POSICIÓN es
`−signo × theta × qty`: una corta con theta −0,08 y 100 acciones recoge +8 $/día; una larga los
paga. Sumar dólares/día entre tickers distintos sí significa algo.

**2. Delta en DÓLARES, no en acciones equivalentes.** Sumar 22 "acciones" de TMDX y −44 de NVDA no
dice nada: no son el mismo riesgo. La cifra comparable es `delta × qty × precio`. Y **las acciones
entran con delta 1**, porque son su propio delta: sin ellas, una covered call saldría bajista y la
cartera parecería justo lo contrario de lo que es.

**3. La cobertura se dice siempre, no solo cuando falla.** Si solo se avisara cuando falta algo, el
día que faltase una posición nadie se daría cuenta de que el número se ha quedado corto. Con todas:
*"De las 2 posiciones de opciones que tienes, todas."* Con alguna fuera, en ámbar: *"Sale de 2 de
tus 3 posiciones de opciones. Sin precio del servidor: SPX — el theta real es mayor que este."*

## Verificación
Playwright en iPhone 13, claro y oscuro, con las cuentas hechas a mano para contrastar:

| | Cuenta | Esperado | Salió |
|---|---|---|---|
| TMDX short put (δ −0,22 · θ −0,08 · 100 acc · spot 76,49) | θ +8,00 · δ +22 acc = +1.682,78 $ | | |
| NVDA covered call (δ +0,44 · θ −0,11 · 100 acc · spot 168,20) | θ +11,00 · δ −44 acc = −7.400,80 $ | | |
| NVDA 100 acciones a 168,20 | δ = +16.820 $ | | |
| **Theta de la cartera** | 8 + 11 | **+$19 / día** | +$19 ✓ |
| **Delta de la cartera** | 1.682,78 − 7.400,80 + 16.820 | **+$11.102** | +$11.102 ✓ |

Y los cuatro casos de borde:

| Caso | Esperado | Salió |
|---|---|---|
| Con un Iron Condor (nunca tendrá griegas) | mismo theta + aviso ámbar nombrando SPX | ✓ |
| Con el botón de privacidad activado | importes tapados | ✓ |
| **Sin servidor propio** | **la tarjeta no existe** | ✓ |
| Ancho de la página | no desborda (390 = 390) | ✓ |

`npm run prueba` (la red de seguridad de quien no tiene servidor) sigue en verde: las 18 cifras
idénticas. Cero errores de consola en las cinco pasadas.

13-ago-2026 — Red de seguridad para quien no tiene servidor propio
*(no cambia la app: no sube APP_VERSION. Es una prueba automática que corre antes de publicar.)*

## Lo que preguntó
Victor: *"esto a la gente que no tenga el servidor le va a afectar, porque si vamos a estar tocando
cómo se graban los iron condors, los iron fly, los iron man, y ellos no tienen acceso a esto, les va
a salir todo mal, ¿no? ¿Cómo podemos hacer para evitarlo?"*

Tenía razón en la preocupación, aunque el riesgo no viene de donde parece: **no es del servidor, es
de tocar el formato de los datos**. Y no les afecta solo a ellos — la primera cartera que se puede
romper es la de Victor, que es la que más posiciones tiene. Sus dos amigos usan el MISMO fichero y
no pueden avisar de nada.

## Lo que ya estaba bien
Verificado en cada entrega, no supuesto: sin servidor configurado la app **no hace ni una llamada**
y los números salen idénticos a los de antes (v4.51 +$1.012 · v4.52 +$2.997 · v4.53 +$2.298, todos
iguales a lo que daban antes de esas versiones).

## Lo que faltaba
Que eso lo comprobara una máquina y no yo a mano. `npm run prueba` carga una cartera de ejemplo
**sin servidor** —una de cada tipo: acciones, una cerrada, short put, covered call, long call, PMCC,
dos Spreads (uno con una pata ya cerrada), DC, Iron Condor, Iron Fly, Calendar, una con P&L manual
forzado y liquidez— y compara todas las cifras de las seis pestañas contra una línea base guardada.
Si una sola se mueve, falla y no se publica.

Cuatro decisiones para que la prueba no mienta:

- **Retrato numérico, no texto.** Captura todos los importes y porcentajes en orden. Cambiar una
  palabra no la rompe; mover un número sí.
- **Vigila las etiquetas del P&L.** Si una posición dijera `REAL` sin servidor —el fallo más grave
  posible— salta.
- **Reloj congelado.** Hay cifras que dependen de los días a vencimiento; una prueba que cambia de
  resultado cada mañana no sirve para nada.
- **Cuenta las llamadas al servidor.** Sin configurar, tienen que ser cero, y se comprueba.

## Comprobado que detecta de verdad
Una prueba que siempre pasa es peor que ninguna, así que se rompió la app a propósito dos veces:

| Avería inyectada | Retratos que saltaron |
|---|---|
| Un céntimo por acción de más en el P&L de las opciones cortas | **6 de 18** |
| Que una posición dijera `REAL` sin haber servidor | **2 de 18** |

Y con la app sana, dos pasadas seguidas dan exactamente lo mismo — no es inestable.

## Las tres reglas que esto protege
1. **Solo se añade, nunca se quita ni se reescribe** un campo ya guardado. (Ya hay precedente: al
   pasar las DC/DD a cuatro patas en la v5.09 se dejaron los campos viejos como respaldo, y las
   posiciones anteriores siguieron funcionando.)
2. **Los campos nuevos son opcionales.** Si faltan, la posición se comporta igual que hoy. Nunca
   "falta un dato → sale mal".
3. **O están todas las marcas de una posición, o no se usa ninguna.**

Bloques v4.53 — DC/DD y PMCC: ya no queda ninguna estructura a ojo

## Lo que pidió
Victor: *"Sigue"*. Quedaban las estructuras de dos vencimientos.

## Antes de añadir, unificar
Había un camino para "una pata" (v4.51) y otro para los verticales (v4.52), casi idénticos. Meter
DC/DD y PMCC habría hecho **cuatro** caminos paralelos haciendo la misma cuenta — y ahí es donde se
crían los bugs que no se ven.

Ahora hay uno solo. Cada posición se describe como una **lista de patas**, y cada pata dice tres
cosas: qué contrato es, cuánto se cobró o se pagó por acción, y si es corta (+1) o larga (−1). Con
eso, dos fórmulas valen para todas las estructuras:

```
P&L no realizado por acción = Σ signo × (entrada − marca)
coste de cerrar hoy         = Σ signo × marca
```

**Comprobado que el refactor no rompe nada:** los tres escenarios de la v4.51 (+$222 / +$1.012 /
+$1.012) y los dos de la v4.52 (+$1.414 / +$2.997) dan exactamente los mismos números que antes.

## Lo nuevo
- **PMCC / Diagonal**: la corta vive en la posición y la larga en `p.long`, con **vencimientos
  distintos**. Ya no se simula: se preguntan los dos contratos.
- **DC / DD**: cuatro patas (short put, long put, short call, long call) y dos vencimientos — las
  shorts en `p.expiry`, las longs en `dcdd.expiryLong`. Se preguntan las cuatro.

## Qué queda a mano
Iron Condor, Iron Fly, Broken Wing y los Calendar sueltos. Esos **no guardan las patas por separado**
en la app, así que no hay de dónde sacar los contratos. Para esos habría que cambiar antes cómo se
graban, no cómo se calculan.

## Sobre el "cerrar"
En la fila de una estructura sale lo que costaría salir hoy, entera:
- `cerrar 0.95` → **pagas** 0,95 por acción para cerrar (lo normal en un credit spread).
- `cerrar +6.00` → **te pagan** a ti (un DC vale más de lo que quedó pendiente). El `+` significa lo
  mismo que en el resto de la app: a tu favor.

## Verificación
Playwright en iPhone 13, claro y oscuro, con el puente simulado y el P&L manual puesto a **999 a
propósito** — si sale 999, la marca no se usó.

| Posición | Cuenta | Esperado | Salió |
|---|---|---|---|
| PMCC NVDA: corta C180 sep cobrada 3,00 (vale 1,80) · larga C150 ene-27 pagada 28,00 (vale 31,50) | (3,00−1,80)+(31,50−28,00) | **+$470** | +$470 ✓ |
| DC AMD, 4 patas, 2 vencimientos | 0,90+0,80−0,40+0,60 | **+$190** | +$190 ✓ |
| DC MU al que el servidor le falta **una** de las cuatro patas | se queda manual | **999** | 999 ✓ |
| **P&L abierto de la cartera** | 470+190+999 | **+$1.659** | +$1.659 ✓ |
| Lo mismo **sin** servidor propio | 300 (PMCC simulado) + 999 + 999 | **+$2.298** | +$2.298 ✓ |

Los **diez** códigos salieron correctos, incluidos los cuatro de MU (uno de ellos rechazado a
propósito): `US.NVDA260918C180000`, `US.NVDA270115C150000`, `US.AMD260918P160000`,
`US.AMD260918C180000`, `US.AMD261016P160000`, `US.AMD261016C180000`, y los cuatro de MU.

En la fila: PMCC `cerrar +29.70`, DC `cerrar +6.00`, ambos con la etiqueta `P&L · REAL`. El de MU
sigue diciendo `P&L · MANUAL`. Sin errores de consola salvo el 404 buscado de la pata que falta.

Bloques v4.52 — Los spreads verticales también salen de la estimación

## Lo que pidió
Victor, tras probar la v4.51: *"Funciona increíble… sigue con lo siguiente"*.

Lo siguiente eran las estructuras de varias patas. De todas ellas, la que más ganaba era el **Spread
vertical**: hasta hoy su P&L no es que fuera aproximado, es que **lo escribía Victor a mano** (los
verticales son `nat=DEF`, así que ni siquiera pasaban por el cálculo automático).

## Cómo se calcula
Un Spread son dos contratos del mismo vencimiento y el mismo lado: la corta que cobró `sP` y la larga
que costó `lP`. Con las dos marcas, lo no realizado por acción es:

```
(sP − marca de la corta) + (marca de la larga − lP)
```

Cada pata aporta su parte. Las patas que Victor ya cerró por separado (`noShort` / `noLong`) **no
cuentan aquí**: su resultado se reservó en su momento y vive en el realizado.

## La regla dura
**O están todas las marcas que hace falta, o no se usa ninguna.** Si el servidor no conoce uno de los
dos contratos, esa posición se queda con su P&L manual de siempre — no se mezcla. Un número medio
real y medio inventado es peor que uno manual, porque parece exacto.

## Cómo se ve
En la fila del vertical: `560/550 · SEP 18 '26 · ×1 contr. · cerrar 0.95` — lo que costaría cerrarlo
hoy entero. Positivo = hay que pagar para salir (lo normal en un credit spread); si te pagaran a ti,
sale con signo +. Y la etiqueta pasa de `P&L · MANUAL` a **`P&L · REAL`**.

## Un cambio por debajo
Las marcas pasan a guardarse **indexadas por código de contrato** (`optMarks`), y la tabla se
**reemplaza entera** en cada refresco en vez de fusionarse. Dos ventajas gratis: sirve igual para una
pata que para dos, y una posición rolada descarta sola los precios de los contratos que ya no tiene,
sin código de limpieza. Las marcas guardadas por la v4.51 se siguen leyendo.

## Verificación
Playwright en iPhone 13 con el puente simulado. Tres verticales a la vez, con el P&L manual puesto a
**999 a propósito**: si sale 999, la marca no se está usando.

| Posición | Esperado | Salió |
|---|---|---|
| Credit spread SPY 560/550, ambas patas vivas (corta 1,50 · larga 0,55) | (4,20−1,50)+(0,55−1,80) = **+$145** | +$145 |
| El mismo con la pata larga ya cerrada | (4,20−1,50)×100 = **+$270** | +$270 |
| Spread de QQQ que el servidor NO conoce | se queda **manual, 999** | 999 |
| **P&L abierto de la cartera** | 145 + 270 + 999 = **+$1.414** | **+$1.414** |
| Lo mismo sin servidor propio | 999 × 3 = **+$2.997** | **+$2.997** |

Los cuatro códigos que salieron por el cable fueron los correctos, incluidos los dos del QQQ que el
servidor rechaza: `US.SPY260918P560000`, `US.SPY260918P550000`, `US.QQQ261218C600000`,
`US.QQQ261218C610000`. Cero errores de consola.

## Lo que sigue manual
Calendar, DC/DD, PMCC/Diagonal, Iron Condor, Iron Fly y Broken Wing. Las dos primeras sí guardan sus
patas (con DOS vencimientos, que es otro cálculo); las últimas no guardan patas estructuradas.

## Y el pendiente de Victor
*"Estaría bien sacar de aquí el portfolio theta y delta, saber qué theta diario sacamos, pero no sé
dónde lo podríamos incluir."* Delta, theta, IV e interés abierto **ya se están guardando**. Queda
pendiente a propósito por dos motivos: no hay sitio donde quepan (en la fila NO — se probó y parte la
línea), y mientras las multi-pata no den griegas, el theta de la cartera saldría **corto en silencio**,
que es la peor forma de estar mal.

Bloques v4.51 — El P&L de las opciones deja de ser una estimación

## Lo que pidió
Victor, tras conectar su servidor: *"ahora que puedo hacer con la app teniendo el servidor
conectado"*. La respuesta honesta era: **nada todavía**. La tubería estaba puesta y los grifos sin
conectar — la app solo le pedía al puente `/salud`, el "¿estás ahí?" del botón de probar conexión.

De las tres cosas que sabe dar el puente, eligió la que más cambia lo que ve cada día: **el precio
real de sus contratos**.

## El problema que arregla
La app nunca supo lo que vale una opción. Para las cortas **simulaba** el P&L *a vencimiento* sobre
el spot (short put: spot − BEP, con techo en la prima). Eso significa que una put muy fuera de
dinero enseñaba SIEMPRE toda la prima como ganancia, aunque el contrato todavía valiera la mitad de
lo cobrado y recomprarlo costara dinero de verdad.

Con OpenD detrás del puente ya se puede preguntar cuánto vale ahora mismo cada contrato.

Ejemplo real de la prueba — TMDX short put 70, cobrada a 7,72, con el subyacente en 76,49:

| | P&L del bloque B2 |
|---|---|
| Como hasta ahora (simulado) | **+$1.012** |
| Con el precio real (put a 3,10, call a 4,80) | **+$222** |

Los dos números son correctos: uno dice *"si expira así, me quedo esto"*; el otro, *"si cierro hoy,
me llevo esto"*. El segundo es el que sirve para decidir si recomprar.

## Cómo se ve
En la fila: `70P SEP 18 '26 · ×1 contr. · vale 3.10` — el precio del contrato en violeta.
Y la etiqueta del P&L pasa de decir `P&L` a decir **`P&L · REAL`**, también en violeta. Cuando el
número cambia de significado, hay que decirlo: si no, cambia a espaldas de quien lo mira.

## Qué cubre y qué no
**Sí:** puts vendidas, calls cubiertas, long calls — todo lo de **una sola pata**.
**No:** condors, spreads, DC/DD y PMCC. Son varias patas en una sola fila, y un contrato no tiene un
precio: tiene cuatro. La app sí guarda los strikes de cada pata, así que se puede hacer — queda
apuntado, no descartado. Esas siguen exactamente como estaban.

## Detalles que importan
- **Si no hay servidor propio, no cambia nada.** Ni una llamada, ni una etiqueta nueva. Los otros dos
  usuarios ven la app idéntica a ayer.
- **Si el servidor se cae, tampoco se rompe nada.** Los subyacentes llegan igual (Finnhub), el P&L
  vuelve a la estimación de siempre y sale un aviso **ámbar** — no rojo: es perder precisión, no una
  avería.
- **Una posición rolada descarta sola su marca vieja.** Junto al precio se guarda el código del
  contrato (`US.TMDX260918P70000`); si Victor cambia strike o vencimiento, el código deja de
  coincidir y el precio guardado se ignora, en vez de seguir mintiendo con el de un contrato que ya
  no tiene.
- **Una llamada por contrato distinto**, con pausa entre ellas. El cupo de OpenD es de la CUENTA, y
  ahí dentro viven también el sistema de earnings de root y el agente de puts. El puente ya cachea
  20 s por su lado.
- Se guardan además IV, delta, theta e interés abierto. La delta se probó en la fila y **no cabe**:
  `70P SEP 18 '26 · ×1 contr. · vale 3.10 · Δ -0.22` se parte y deja el "-0.22" solo en una línea.
  Esperan a tener un sitio donde quepan.

## Verificación
Playwright en iPhone 13, con el puente simulado (`ctx.route`), tres escenarios:

| Escenario | P&L del bloque B2 | `vale` | `P&L · REAL` | Consultas al puente |
|---|---|---|---|---|
| Con servidor propio | **+$222** | sí | sí | las 2 correctas |
| Sin servidor configurado | +$1.012 | no | no | **ninguna** |
| Servidor caído | +$1.012 | no | no | + aviso ámbar |

Los códigos que salieron por el cable fueron exactamente `US.TMDX260918P70000` y
`US.NVDA260918C175000`. Cero errores de consola en los dos primeros; en el tercero, solo los
`ERR_CONNECTION_REFUSED` esperados del servidor apagado. Comprobado en claro y en oscuro.

Bloques v4.50 — Aviso de mudanza en la dirección vieja

## Por qué
La app se muda a su propio dominio (`app.alphavext.com`) y, cuando eso esté rodado, el repositorio
pasará a privado. Aquí está el detalle que importa: **GitHub Pages solo publica gratis desde
repositorios públicos**. El día que se cierre, `galofly.github.io/galowillmakeyourich` deja de abrir.

Victor lo vio venir antes que yo: *"el anterior sitio dejará de funcionar? es que igual mis amigos
no han grabado copia de sus datos"*.

## El riesgo real
Los datos **no se pierden** cuando se apaga el sitio: viven en el `localStorage` / IndexedDB de cada
iPhone y ahí siguen. El problema es de acceso, no de pérdida: **el botón de Backup vive DENTRO de la
app**. Si la app no abre, no hay forma de sacarlos. La copia hay que hacerla antes, no después.

## Cómo queda
Una tarjeta ámbar, con banda naranja, **arriba del todo y en todas las pestañas**, que dice que la
app se ha mudado y pone dos botones en orden:

1. **Descargar mi copia** — abre directamente la hoja de Backup, sin pasar por Ajustes.
2. **Abrir app.alphavext.com** — la casa nueva.

Y debajo, en pequeño, el paso que se olvida: *Ajustes → Backup → Importar archivo*, y volver a
guardar la app en la pantalla de inicio desde la dirección nueva.

Tres decisiones a propósito:

- **Solo se pinta en `github.io`** (`enSitioViejo()` mira `location.hostname`). En la dirección nueva
  no aparece — es el mismo `index.html` para las dos, así que el aviso tenía que saber dónde está.
- **No se puede descartar.** El resto de avisos de la app llevan ✕; este no. Es el único mensaje que
  van a ver los otros dos usuarios, y una ✕ pulsada sin leer deja a alguien sin sus datos.
- **Descargar va antes que mudarse.** Si se van sin copia, el viaje no sirve de nada.

## Verificación
Con Playwright sirviendo `dist/` bajo cada dominio de verdad (interceptando la red, para que
`location.hostname` sea el real y no `localhost`), en iPhone 13:

| Dirección | ¿Sale el aviso? |
|---|---|
| `galofly.github.io` (claro y oscuro) | **sí** |
| `app.alphavext.com` | no |
| `galowillmakeyourich.pages.dev` | no |

Además: el botón 1 abre de verdad la hoja de Backup (aparecen "Descargar archivo" e "Importar
archivo"), el aviso sigue en su sitio al cambiar a Movimientos y a Herramientas, la tarjeta mide
360×323 px sin desbordar a lo ancho (documento 390 = ventana 390), y ni un error de consola en las
cuatro pasadas.

Bloques v4.49 — Botón de privacidad: tapar el dinero de un toque

## Lo que pidió
Victor: *"un botón de privacidad que oculte el dinero que hay en la cuenta. Tiene que ser muy
accesible"*.

## Cómo queda
Un **ojo** junto a "Valor de la cuenta", en la primera pantalla. Un toque y desaparecen todos los
importes. Otro toque y vuelven.

**Dos dianas para lo mismo**, porque "muy accesible" quiere decir sin buscar: el ojo, y **el propio
importe grande**, que también se puede tocar.

## Qué se tapa y qué no
Se tapan **todas las cifras en dinero de la pantalla de Portfolio**: el valor de la cuenta, el
importe del cambio del día, P&L abierto, riesgo total, valor de mercado, cash, margin, Excess Liq
y **el importe de cada bloque** en Distribución.

Ese último era imprescindible: tapar solo el hero no habría servido de nada, porque las cuatro filas
de bloques cantan el tamaño de la cuenta igual de alto. Verificado: con la privacidad puesta **no
queda ni un `$` en toda la pantalla**.

Se quedan **los porcentajes**: el % del día, los ratios (EL/NLV, apalancamiento, liquidez) y el
reparto por bloques con su banda objetivo. Así la app sigue diciéndote de un vistazo si estás en
banda y cómo va el día — se esconde cuánto tienes, no se deja de poder usar.

**No toca el P&L de las posiciones**: eso ya tiene su propio interruptor ("Ver P&L"), y viene apagado
de fábrica.

## Detalles
- **Se recuerda entre sesiones.** Si se olvidara al cerrar la app no serviría para lo que sirve —
  abrirla delante de alguien.
- Solo afecta a lo que se PINTA: no se borra nada, no se deja de calcular nada, y el backup va igual.

## Verificación
Chromium (viewport iPhone 390×844), claro y oscuro:
- Al abrir: 8 importes visibles.
- Tras pulsar el ojo: **ninguno** — barrido de todo el texto de la pantalla buscando `$`.
- Con el estado de cuenta desplegado (cash, margin, EL): tampoco.
- Tras recargar la app: sigue tapado.
- Al volver a pulsar: los 8 importes vuelven.
- Sin errores de consola.

Bloques v4.48 — El carrusel del calendario se quedaba entre dos días

## El síntoma
Victor, sobre la v4.47: *"el scrolling lateral se queda a veces en el medio"*. En su captura, dos
días del calendario partidos por la mitad.

## La causa
**Regresión mía de la v4.47.** Al hacer que el carrusel adoptase la altura del día visible, esa
altura se recalculaba **en mitad del gesto**: cada evento de scroll cambiaba el índice, y con él la
altura del contenedor. Cambiarle el tamaño al contenedor mientras el navegador está decidiendo dónde
engancharse le hace abandonar el enganche y quedarse a medio camino.

## El arreglo
Tres cosas, todas en `SnapCarousel`:

- **La altura no se toca mientras el dedo desliza.** Se aplaza hasta 160 ms después del último
  movimiento, cuando el carrusel ya ha asentado. El índice y los puntitos siguen actualizándose al
  instante, que eso no estorba.
- **La animación de altura se apaga durante el gesto** y vuelve al soltar.
- **`scrollSnapStop: always`** — cada pasada de dedo cae en UN día, sin saltarse ninguno.

Y de paso: el scroll vertical de cada tarjeta solo se activa cuando de verdad hay tope de altura. Un
`overflow` permanente le robaba el gesto al deslizamiento lateral.

## Verificación
Chromium (viewport iPhone 390×844), cuatro días muy desiguales (12 tickers, 1, 2, 1). Se suelta el
carrusel **a propósito entre dos días** y se mira dónde asienta:

| Soltado en | Asienta en | Desvío |
|---|---|---|
| 145 px | 0 | 0 px |
| 435 px | 290 | 0 px |
| 102 px | 0 | 0 px |
| 725 px | 825 (tope) | 0 px |
| 522 px | 581 | 1 px |

Las cinco veces engancha en un día, y la altura acompaña (279 / 87 / 279 / 87 / 128 px).

**Aviso honesto:** el navegador de escritorio no reproduce la inercia del dedo en iOS. Esto prueba
que el mecanismo ya no estorba al enganche, pero la prueba definitiva es el iPhone.

*(De camino, otra vez el fallo de los comentarios `{/* … */}` dentro de un `map` que devuelve JSX:
rompe el compilado. Y el `node --check` dio verde sobre el `dist/` VIEJO — hay que mirar la línea
`build … ok` del propio compilado, no fiarse del check.)*

Bloques v4.47 — Un día con muchos earnings echaba la calculadora fuera de la pantalla

## El síntoma
Victor, tras dar con la causa él mismo: *"si la lista en un día era muy larga se llevaba el
calculador abajo"*. En su captura, un vacío negro de media pantalla entre el calendario y la
calculadora.

## La causa
El carrusel del Calendario de aperturas pone las tarjetas de cada día en fila con `flex`, y por
defecto **los hijos de un flex se estiran a la altura del más alto**. Basta con que UN día tenga
muchos resultados para que TODOS los días midan lo mismo, incluidos los que tienen un solo ticker.

Medido, con un día de 14 tickers y otro de 1, en pantalla de 664 px:

| Día | Contenido real | Altura que ocupaba |
|---|---|---|
| 14 tickers | 620 px | 620 px |
| **1 ticker** | **87 px** | **620 px** |

533 px de vacío, y la calculadora empujada casi una pantalla entera hacia abajo. Fallo latente desde
siempre: solo se manifiesta cuando un día se carga de earnings, por eso apareció ahora.

## El arreglo
Dos remedios, los dos en `SnapCarousel`:

1. **`alignItems: flex-start`** — cada día ocupa su altura real, no la del más gordo.
2. **El carrusel adopta la altura de la página que se está viendo**, con transición suave al
   deslizar, **y un tope del 42% de la pantalla**: el día cargado hace scroll dentro de su propia
   tarjeta en vez de empujar lo que viene debajo.

La medida se recalcula al deslizar, al cambiar el número de días y —con `ResizeObserver`— cuando el
contenido de una tarjeta crece o encoge; sin eso, desplegar algo dentro de un día habría dejado la
altura vieja y recortado el contenido.

## Verificación
Chromium (viewport iPhone 390×844), sembrando un día con 14 tickers y otro con 1:

| Situación | Antes | Después |
|---|---|---|
| Viendo el día de 14 | 620 px | **279 px** (tope) con scroll propio |
| Viendo el día de 1 | 620 px | **87 px** |

- Deslizar entre días sigue funcionando y la altura acompaña.
- El día que no se está viendo se comprime y conserva su scroll interno.
- Sin errores de consola.

`SnapCarousel` solo se usa en este calendario, así que el cambio no alcanza a ninguna otra pantalla.

Bloques v4.46 — La calculadora de earnings desaparecía sin decir por qué

## El síntoma
Victor: *"la herramienta de earnings se ha roto, si pulsas en un ticker no sale nada"*. Y luego:
*"es la herramienta que modelaba los iron condors y los spreads"*.

## La causa
**No estaba rota.** Toda la parte de abajo de la calculadora —los strikes, el selector de estrategia,
el ancho del ala, "Generar spreads" y el sizing entero— cuelga de una sola condición:

```js
const emOk = isFinite(spot) && spot > 0 && isFinite(em) && em > 0;
```

Al tocar un ticker en "Resumen por ticker" se carga el **expected move** desde el histórico, pero el
**spot no**: ese hay que traerlo con "Obtener spot" (que necesita la key de precios) o escribirlo a
mano. Si no hay spot, `emOk` es falso y **desaparecen 10 de las 13 piezas de la pantalla, en
silencio**.

Y lo que queda arriba —POP, gráfico de earnings pasados, "Estrategia sugerida: Iron Condor"— sigue
saliendo perfecto. Así que la herramienta *parece* funcionar mientras la mitad útil no está. De ahí
"pulso y no sale nada".

Medido, no supuesto: con spot, 12 de 13 piezas presentes; sin spot, solo 3.

## El arreglo
Un aviso ámbar que aparece exactamente en el hueco donde debería estar lo que falta, y dice **qué**
falta y **cómo** arreglarlo: *"Falta el precio del subyacente (spot) para poder calcular. Sin eso no
se pueden colocar los strikes ni calcular el sizing, así que esa parte de la pantalla no aparece.
Pulsa 'Obtener spot' arriba, o escribe el precio a mano en el campo SPOT $."*

Cubre los tres casos: falta el spot, falta el expected move, o faltan los dos. Y desaparece solo en
cuanto hay ambos.

No se toca `emOk` ni la lógica de cálculo: sin spot no se pueden colocar strikes, y eso es correcto.
Lo que estaba mal era callarse.

## Verificación
Chromium (viewport iPhone 390×844), con un histórico de 11 trimestres sembrado:
- **Sin spot**: el aviso sale, y sigue faltando el resto (como debe).
- **Con spot**: el aviso desaparece y vuelven SELECCIONAR ESTRATEGIA, SHORT PUT/CALL, ANCHO DEL ALA
  y Generar spreads.
- El sizing sigue apareciendo solo cuando además hay crédito, que es lo correcto.
- Sin errores de consola en ninguno de los dos casos.

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
Victor pasó un backup ajeno con el mismo problema del que veníamos: operaciones de compraventa
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
totales de MTM). En el backup de prueba eran ocho ventas de cinco subyacentes distintos, todas
invisibles.

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
  también en operaciones cerradas — o sea el precio de **hoy**, no el de la operación. Una venta
  cerrada a $730 se leía con el precio de hoy, muy por debajo. En cerradas se enseña ahora el
  **precio de salida**.
- El contador de la pestaña "Acciones" no contaba las ventas parciales: la pestaña decía un número y
  las dos sub-pestañas de debajo sumaban otro. Ahora cuadra.

## Verificación
Chromium (viewport iPhone 390×844) con una cartera real de prueba:
- Histórico → Acciones: el contador de Cerradas **triplica**, y el profit total sube en consecuencia;
  la media por operación se recalcula sola.
- Aparecen todos los subyacentes con ventas parciales; antes solo salían los cerrados del todo.
- Filas correctas y etiquetadas, con su resultado realizado cada una.
- Ficha desplegada de una venta parcial: precio de compra, precio de venta, ROI, días y P&L, todo
  coherente entre sí.
- Sin botones de acción en las derivadas. Sin errores de consola.

*(Las cifras concretas de esa cartera no se reproducen aquí: era el backup de otra persona.)*

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
