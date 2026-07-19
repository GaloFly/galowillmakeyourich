# CHANGELOG — Bloques

> Fragmento para pegar al principio del CHANGELOG.md del repo.

## v3.42 — el aviso de earnings se persiste (solo en la apertura) + desglose en Estrategias

Convierte el aviso de la v3.41 en dato medible para la ronda 3 del playbook: ¿las posiciones abiertas con earnings dentro van sistemáticamente peor?

- El aviso es ahora un componente compartido (`EarningsHint`, caché a nivel de módulo) usado en dos sitios: el asistente "Nueva posición" y la **hoja de roll** (aparece al teclear el nuevo expiry).
- **Al abrir** con el aviso ámbar activo, la posición guarda `earnIn` (la fecha del earnings). Sin badge en la fila: el dato es para estadística, no decoración.
- **Al rolar solo se informa**: el roll nunca escribe ni borra `earnIn` — la estadística mide la decisión de entrada, no la gestión posterior.
- **Estrategias → Cerradas**: bajo los tiles del resumen, desglose "⚠️ Con earnings dentro (N) / ○ Sin (M)" con win rate y P&L de cada grupo (mismo criterio `closedGrade` de v3.39). Solo aparece si hay alguna marcada, y con nota honesta: las posiciones anteriores a v3.42 cuentan como "sin".
- Limitación conocida: si guardas antes de que Finnhub responda (≈1 s), el flag no se escribe.

## v3.41 — aviso de earnings dentro del vencimiento en "Nueva posición"

Al abrir una posición con opciones, el asistente comprueba solo si hay earnings antes del vencimiento (playbook §5: se permite, pero se documenta y se valora un escalón menos de tamaño).

- Con ticker + vencimiento rellenos (y key de Finnhub en Ajustes), consulta `fetchNextEarnings` (60 días) con debounce de 600 ms y caché por ticker; los fallos de red no se cachean y se reintentan.
- Línea de estado: ⏳ comprobando · ⚠️ ámbar con día y sesión si cae dentro del vencimiento · gris neutro si queda fuera o no hay ninguno en 60 días (los ADRs a veces no aparecen en Finnhub) · gris honesto si falla la llamada o falta la key.
- Solo informa: el guardado no se bloquea.
