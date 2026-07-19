# CHANGELOG — Bloques

> Fragmento para pegar al principio del CHANGELOG.md del repo.

## v3.41 — aviso de earnings dentro del vencimiento en "Nueva posición"

Al abrir una posición con opciones, el asistente comprueba solo si hay earnings antes del vencimiento (playbook §5: se permite, pero se documenta y se valora un escalón menos de tamaño).

- Con ticker + vencimiento rellenos (y key de Finnhub en Ajustes), consulta `fetchNextEarnings` (60 días) con debounce de 600 ms y caché por ticker; los fallos de red no se cachean y se reintentan.
- Línea de estado bajo la sección del ticker, en cualquier estrategia con vencimiento (no acciones ni cash):
  - ⏳ "Comprobando earnings…" mientras consulta — no bloquea nada.
  - ⚠️ Ámbar si la fecha cae dentro del vencimiento, con día y sesión (antes de la apertura / tras el cierre / en sesión) y el recordatorio del §5.
  - Gris neutro si el earnings queda después del vencimiento o no hay ninguno en 60 días (con aviso de que los ADRs a veces no aparecen en Finnhub).
  - Gris honesto si Finnhub no responde o falta la key — nunca inventa fecha ni da falsa seguridad.
- Solo informa: el guardado no se bloquea y no se persiste nada en la posición.
