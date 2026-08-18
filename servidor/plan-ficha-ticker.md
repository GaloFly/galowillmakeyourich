# Ficha de ticker — plan, diseño y cuentas de llamadas

Respuesta al encargo del 18-ago-2026. Tres partes: **lo que hay que corregir del encargo** (tres
cosas que la realidad del servidor contradice), **lo que ya está construido** (bastante más de lo
que el encargo supone), y **el plan** con el diseño de pantalla y las llamadas contadas.

Sustituye a `fundamentales-contrato.md`, que se borra: aquel proponía leer de
`~agente/trabajo/fichas` y el encargo demuestra que eso no puede funcionar.

---

## PARTE 1 — Tres correcciones al encargo

### 1.1 `/velas` NO funciona hoy en ese servidor  ⛔ bloquea dos bloques

El encargo la da por buena. La realidad, probada desde el propio VPS a las 23:5x:

```
{"error":"Ninguna fuente de velas contestó para MRVL.
          query1: HTTP 429 · query2: HTTP 429 · stooq: sin velas","ok":false}
```

**429 en la PRIMERA petición.** No es un cupo gastado: Yahoo limita por IP y la del VPS es de un
centro de datos. Ya se intentó lo obvio y no bastó: cabecera de navegador, cookie de sesión de
`fc.yahoo.com`, y los dos hosts (`query1` y `query2`). Se añadió Stooq como segunda fuente y
contestó algo que no era un CSV de velas.

De esto dependen **Gráfico** (entero) y **Gamma** (el fondo sobre el que se pintan los muros).

Hacen falta tres datos antes de decidir, y son un minuto de terminal:

```bash
echo "--- 1) Yahoo con curl"
curl -s -o /tmp/y.txt -w "http %{http_code}\n" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" "https://query1.finance.yahoo.com/v8/finance/chart/MRVL?range=1mo&interval=1d"
head -c 200 /tmp/y.txt; echo; echo
echo "--- 2) Stooq con curl"
curl -s -o /tmp/s.txt -w "http %{http_code}\n" -A "Mozilla/5.0" "https://stooq.com/q/d/l/?s=mrvl.us&i=d&d1=20260701&d2=20260818"
head -c 300 /tmp/s.txt; echo; echo
echo "--- 3) salida a internet en general"
curl -s -o /dev/null -w "http %{http_code}\n" https://example.com
```

Los tres caminos posibles, según lo que salga:

| Lo que salga | Qué significa | Qué se hace |
|---|---|---|
| curl saca **200** | La IP no está vetada; el fallo es de cómo pide el puente | Se arregla el puente y ya |
| curl saca **429** y Stooq **200 con CSV** | Yahoo veta la IP, Stooq no | Stooq pasa a fuente principal |
| curl **429** y Stooq no sirve | La IP del VPS no vale para velas | **Las pide la app desde el iPhone** |

La tercera opción es la que ya proponía el encargo anterior, y tiene sentido: el móvil de Victor
tiene una IP normal, no de centro de datos, así que Yahoo no le pondrá pegas. La única incógnita es
si Yahoo deja que un navegador le pregunte de frente (CORS); se comprueba en dos minutos y **el
código de la app no cambia**, solo de dónde salen las mismas velas.

### 1.2 Los cinco comandos de root NO bastan  ⛔ el recado no se podrá escribir

El servicio `bloques-puente` corre con **`ProtectSystem=strict`**, que deja **todo el disco en solo
lectura** salvo su propio `StateDirectory`. Los permisos de `/var/lib/fichas-bloques/pedidos` dan
igual: systemd no le va a dejar escribir ahí.

Sin esto, `/fundamentales` devolvería 202 «generando» **para siempre**, el vigilante no vería nunca
un recado, y no habría ni un error que lo explicara. Es exactamente el tipo de avería que se
diagnostica en tres horas.

Se arregla en el fichero del servicio, que sí es nuestro (`servidor/instalar.sh`), añadiendo:

```
ReadWritePaths=-/var/lib/fichas-bloques/pedidos
```

El guion de delante importa: hace que systemd **tolere que la carpeta no exista todavía**. Sin él,
si el servicio arranca antes de que root cree el directorio, el arranque falla entero — y con
`Restart=always`, en bucle.

Leer la ficha sí funciona sin tocar nada: `ProtectSystem=strict` solo afecta a la escritura.

**Orden correcto:** primero los cinco comandos de root, después re-ejecutar el instalador (que
recarga el servicio). Al revés también acaba funcionando gracias al guion, pero con un reinicio de
más.

### 1.3 Un matiz de `fundamentales_validos`

El encargo dice que viene en `false` con empresas de año fiscal recién cerrado. La app ya trata ese
caso, pero el texto en pantalla lo achaca a ETFs y fondos. Se corrige para nombrar los dos motivos:
un aviso que da la causa equivocada manda a buscar el problema donde no está.

---

## PARTE 2 — Lo que YA está construido

El encargo supone una pantalla desde cero. No lo es: la pestaña **Análisis** existe desde la v4.93 y
las versiones 4.94 a 4.96 fueron incorporando piezas. El mapa honesto:

| Bloque | Estado hoy | Qué falta contra el encargo |
|---|---|---|
| **ROI** | La tarjeta *Buscar puts* (Herramientas → Puts) hace el barrido con filtro de delta y da ROI y ROI anualizado | Es un **buscador**, no una ficha. Falta el bloque de un solo contrato con BEP, horquilla, EM, k_en_em y la lectura IV/HV con banda neutral |
| **Flujo** | P/C, prima por lado y lo más negociado — **un solo horizonte** | Los tres horizontes, las cuatro señales que votan, el score y las APERTURAS |
| **Gamma** | Muros y punto de giro con Black-Scholes, ya con los avisos de MODELO y SUPUESTO | Dos muros por lado (hoy uno), banda ±45% (hoy −30%/+35%) y pintarlos **sobre las velas** |
| **Gráfico** | Diario ~120 sesiones, EMA 21 y 50, soportes y resistencias por pivotes, y el hueco del detector dicho | El **semanal de 3 años**, la EMA 200 en el dibujo y el diario a 9 meses |
| **OI** | ΔOI completo desde la v4.95: filtro 500/25%, «primer ΔOI mañana», fecha de la foto anterior | **La forma en que se guarda la foto**, ver abajo |
| **Valora** | Capa superficial de `/valoracion`: capitalización, PER, P/VC, BPA, dividendo, rango 52s | La ficha profunda entera |
| **Dinero** | Hecho, con el aviso de que es acumulado del día | — |

### El detalle del OI que sí hay que cambiar

La v4.95 guarda la foto indexada **por código de contrato**:
`{"MRVL|2026-09-18": {"2026-08-18": {"US.MRVL260918C220000": {k, c, oi}}}}`.

El encargo pide `{fecha, ticker, vencimiento, strike, tipo, oi}` **para que el histórico de semanas
del servidor se pueda injertar sin rehacer nada**. Ese motivo es bueno y la información es la misma,
así que se cambia la forma. Ahora cuesta cero —solo hay fotos de un día—; dentro de un mes costaría
tirar el histórico de Victor.

---

## PARTE 3 — El plan, bloque a bloque

### Orden en pantalla

Pensado para un iPhone y para lo que él hace: primero lo accionable, al final lo que tarda.

```
┌─ CABECERA ──────────────────────────────────────────────┐
│  MRVL  $78.40   ·  IV 44.0 · HV 40.0 · IV/HV 1.10 · IVR 62│
│  vencimiento SEP 17 '26 · 29 días · dato de hace 12 s    │  ← edad SIEMPRE
└──────────────────────────────────────────────────────────┘
   1. ROI          el put que vendería, con BEP y EM
   2. GRÁFICO      velas + EMAs + muros de gamma dibujados
                   [diario 9m] [semanal 3a]  ← dos pestañas
   3. GAMMA        los números: muros, flip, GEX
   4. FLUJO        tres horizontes con su semáforo
   5. OI           qué se abrió y qué se cerró
   6. DINERO       reparto por tamaño de orden
   7. VALORA       superficial + ficha profunda (se pinta la última)
```

Cada bloque se pinta **en cuanto tiene sus datos**. El que falle sale en gris con el motivo y no
tumba la pantalla — ya funciona así desde la v4.94.

### Lo que se construye en cada uno

**1. ROI** — bloque nuevo en Análisis. Se deja la tarjeta *Buscar puts* como está: son dos trabajos
distintos (aquella barre candidatas entre vencimientos; esta responde «qué vendería HOY en este
nombre»). Vencimiento: DTE 30-45, el más cercano a 30; si ninguno cae dentro, el más cercano al
borde, **y se dice que se salió del rango**. Contrato: delta más cerca de −0,30 dentro de
[−0,36, −0,18]; si ninguno cae dentro, **no se elige nada y se explica por qué**. Las siete fórmulas
del encargo, tal cual. Semáforo por `k_en_em`. IV/HV con la banda neutral 0,90-1,15 y el `iv_rank`
al lado, nunca solo.

**2. Gráfico** — dos pestañas, diario 9 meses y semanal 3 años. El semanal se **agrega en la app**
desde las mismas velas diarias (apertura del lunes, máximo y mínimo de la semana, cierre del
viernes), porque `/velas` siempre es diario. EMA 21, 50 y 200 dibujadas. Encima, los muros de gamma
como líneas horizontales. Se mantienen el aviso del detector y la prohibición: ni líneas de
tendencia, ni zonas de liquidez, ni giros marcados.

**3. Gamma** — se amplía la banda a ±45%, se pasa a **dos muros por lado** y se conectan al gráfico.
El resto ya cumple: gamma de Black-Scholes por contrato, GEX por strike con signo, flip por barrido
sobre una rejilla eligiendo el cruce más cercano al spot, y el aviso de que es aproximación con su
supuesto.

**4. Flujo** — se rehace. Tres horizontes (≤14 · 15-60 · >60) con los 2+3+2 vencimientos, ±40% del
spot, y las cuatro señales votando. Cada horizonte enseña score, semáforo, P/C y los strikes con más
volumen, marcando **APERTURA** los de volumen > 200 y volumen/OI > 1,5. Se mantiene el aviso de que
no se sabe quién fue el agresor, y se añade el de la mezcla temporal (volumen de hoy contra OI de
ayer), que hoy está en la ficha de OI pero no en la de flujo.

**5. OI** — solo cambia la forma de guardar la foto, para que el histórico del servidor se pueda
injertar. Lo demás se queda.

**6. Valora** — encima de lo que ya hay: ingresos, beneficio y FCF **por trimestres** (dejando claro
que seis periodos son año y medio), deuda neta y deuda/EBITDA, EV/EBITDA y FCF yield **contra su
propio histórico** —que es lo único que convierte un múltiplo en una lectura—, Morningstar con su
nombre encima, consenso con el reparto, y accionariado. `generado` se parsea **como hora de Madrid**,
no como UTC, y se enseña; si tiene más de 7 días, se avisa. `dcf_base`, `dcf_supuestos` y
`dcf_sensibilidad` **no se pintan**, y eso queda escrito en el código, no solo aquí.

**7. Estados que hoy no se enseñan y el encargo exige.** Dos:
- **Ventanas de root** (15:29-15:46 y 21:30-21:35): el puente ya manda el aviso; la app lo pintará
  con la hora del dato en caché, y **no reintenta en bucle**.
- **Edad del dato**: hoy la cabecera enseña la hora del análisis, que no es lo mismo. Pasará a
  enseñar `edad_s` de cada fuente.

---

## PARTE 4 — Las llamadas, contadas

Una ficha completa de un ticker que no se haya mirado hoy:

| Llamada | Veces | Para qué sirve |
|---|---|---|
| `/fundamentales` | 1 (+ reintentos) | Valora profunda. **Se dispara la primera**, y se reintenta a los 45 s si contesta 202. Máximo 3 intentos y luego se rinde diciéndolo |
| `/cotiza` | 1 | spot — lo usan ROI, gamma, flujo y valoración |
| `/subyacente` | 1 | IV, HV, rank — cabecera y ROI |
| `/valoracion` | 1 | Valora superficial |
| `/dinero` | 1 | bloque de dinero |
| `/velas?rango=5y` | **1** | Gráfico semanal 3a **y** diario 9m **y** el fondo del gamma. Una sola: el 5y ya viene diario, el semanal se agrega en la app y los 9 meses son el final de la misma lista |
| `/cadena` hoy→hoy+120 | **1** | ROI, flujo y gamma. No se pide tres veces |
| `/opciones` | **3** lotes de 200 | la unión deduplicada de los tres bloques |

**Total: 11 llamadas**, más los reintentos de la ficha.

El lote de `/opciones` sale así: 7 vencimientos (2+3+2), y de cada uno **los 30 strikes más pegados
al dinero dentro del ±40%**, puts y calls → unos 420 contratos → 3 lotes. El vencimiento del gamma
se pide con banda ±45%, un poco más ancha. Los puts del ROI (60-100% del spot) **ya están dentro de
esa banda**: no añaden ni una llamada.

El tope de 30 strikes por vencimiento es una decisión, no un descuido: sin él, un nombre líquido con
80 strikes por vencimiento se va a 1.120 contratos y **6 lotes**. Las cuatro señales del flujo son
agregados de volumen y no cambian de veredicto por incluir alas que no negocia nadie.

Y lo que abarata la segunda vez: la cadena se cachea 6 h, las velas 15 min, valoración y subyacente
10 min, los contratos 20 s. **Volver a abrir el mismo ticker en la misma sesión cuesta casi cero**, y
mirar un segundo ticker se ahorra la cadena si comparte vencimientos.

Para comparar: la pantalla de hoy hace 7 llamadas y cubre cuatro bloques. Esta hace 11 y cubre siete.

---

## PARTE 5 — Qué hace falta de fuera, y en qué orden

1. **Los tres `curl` de la parte 1.1.** Sin eso, Gráfico y Gamma se quedan sin fondo y no sé cuál de
   las tres salidas tomar. Es lo único que bloquea de verdad.
2. **Los cinco comandos de root** del encargo, tal cual.
3. **Re-ejecutar el instalador** después, para que el servicio coja `ReadWritePaths`. Es el mismo
   comando idempotente de siempre y no regenera la clave.

Mientras tanto se puede construir todo lo que no depende de las velas: ROI, Flujo, la forma nueva
del OI, los avisos de ventana y de edad del dato, y el bloque de Valora contra la estructura de
campos que el encargo ya deja cerrada.

**No se aplica nada hasta que Victor vea el diff**, como pide el encargo.
