# CHANGELOG — Bloques

> Fragmento para pegar al principio del CHANGELOG.md del repo (no tengo el archivo actual subido).

## v3.40 — fix del enlace put↔acción en "Asignadas"

Las asignaciones cuya posición de acciones no se encontraba por `assignedFrom` (anteriores al enlace automático, o con la acción creada o fusionada a mano) caían en "cerradas del todo" y sin valoración, justo al revés de la realidad.

- Búsqueda del enlace en tres pasos: `assignedFrom`, acción abierta del mismo ticker y broker, acción abierta del mismo ticker.
- Si no aparece ninguna, la fila ya no se cuela entre las cerradas: va a un grupo propio en ámbar, "Sin acción vinculada", donde solo se muestra la prima y se explica por qué.
- La línea de resumen del plegable cuenta los tres grupos.

## v3.39 — criterio de asignación por tipo + submenú "Asignadas" en Short Puts

**Una asignación ya no es automáticamente una pérdida.** Nuevo `closedGrade(p)` que devuelve ganadora / perdedora / sin clasificar:

- **Covered call asignada** → ganadora si el strike está por encima del BEP de la acción vinculada (vendiste por encima de tu coste; lo que se pierde es recorrido, no dinero), perdedora si queda por debajo. Sin acción vinculada (ni por `coveredBy` ni por el heurístico broker+ticker), se deja sin clasificar en vez de contarla como pérdida.
- **Short put asignada** → sin clasificar: el resultado real se muda a la posición de acciones y no existe hasta cerrar la cadena.
- **Resto** → por el signo del dinero registrado.

`isWinner` / `isLoser` pasan por el nuevo criterio, y con ellos **todos** los recuentos: resumen de estrategia, tarjeta de riesgo, auditoría y payload de exportación. Los win rates de Covered Calls y Short Puts cambian respecto a versiones anteriores.

**Submenú plegable "🔗 Asignadas (N)"**, solo en Short Puts, debajo de la auditoría. Cruza cada put asignada con la acción creada al asignar (`assignedFrom`):

- **Vivas** (acción abierta): valoración = prima + (precio actual − BEP) × acciones. Marcada como valoración; no entra en ninguna estadística. "Sin precio" si falta el último precio.
- **Cerradas del todo**: resultado real de la cadena = prima + realizado de la acción.

Subtotal por sección; filas con ticker, strike, fecha, prima, BEP, precio de hoy y número de acciones. Respeta el filtro de ticker.

## v3.38 — la tarjeta de riesgo razona solo con dinero

Corrige el caso Short Puts, donde salía "peor operación +$0" y una "perdedora media" que en realidad eran primas cobradas. La tarjeta heredaba el criterio del resumen (asignada = perdedora) y con ventas de put ninguna cerrada está en negativo.

- Ganadora = cerrada en positivo, perdedora = cerrada en negativo. Los ceros no puntúan.
- Sin ninguna pérdida registrada no se inventa ratio: aviso ámbar explicándolo.
- Aviso ámbar cuando hay asignaciones, recordando que ahí solo se ve la prima.
- Pie reescrito con el criterio y su diferencia con el win rate del resumen.

## v3.37 — fix del texto contradictorio de concentración

La concentración se medía con un umbral fijo del 50% sobre el total de pérdidas, lo que producía frases contradictorias ("pérdida repartida" con la peor operación llevándose el 84% de lo ganado). Ahora se compara con la parte que le tocaría si el daño estuviera repartido (1/nº de perdedoras): ≥2× "pérdida concentrada", ≥1,3× "algo concentrada", por debajo "repartida".

## v3.36 — "Riesgo del proceso" plegable + dos correcciones

- La tarjeta pasa a ser plegable (`<details>`): cerrada muestra punto de color, ratio, mínimo y número de cerradas.
- El veredicto se adapta al win rate (tres redacciones según esté por encima del 70%, entre 50 y 70, o por debajo).
- La peor operación se compara con el bruto de las ganadoras y con el total de pérdidas, no con el P&L neto (con el neto cerca de cero el porcentaje se disparaba).
- Nota al pie: con pocas operaciones, un ratio cercano al mínimo no es concluyente.

## v3.35 — nueva tarjeta "Riesgo del proceso" en Estrategias

Tarjeta genérica bajo el resumen de cualquier estrategia, sobre las cerradas y sin filtro de resultado, a partir de 3 operaciones:

- Peor operación en dólares y su peso relativo.
- Ganadora media, perdedora media, ratio G/P.
- Mínimo exigido por el propio win rate: (1 − wr) / wr.
- Veredicto en verde o rojo.

Nace del caso de Earnings, donde el problema de tamaño solo apareció al exportar la serie a un chat.
