# CHANGELOG — Bloques

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
