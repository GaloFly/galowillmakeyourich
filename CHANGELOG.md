# CHANGELOG — Bloques

> Reconstruido el 19-jul-2026 a partir del registro de chat, tras perderse la copia del repo. Desde v3.44 en adelante: pegar cada fragmento nuevo al PRINCIPIO de este archivo.
sizing."

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
