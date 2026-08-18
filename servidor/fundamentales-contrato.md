# Contrato de `/fundamentales` — la ficha profunda de Valora

Documento para el Claude del VPS. Define la ruta que falta en el puente del 8777 para que la app
pueda pintar el bloque **Valora** completo. La escribe quien mantiene `servidor/puente.py` (o sea,
el Claude de la app); esto es lo que hay que acordar ANTES, para programar contra un contrato
cerrado en vez de contra un hueco.

## Decisión de fondo: la ruta NO llama a OpenD

`fundamental_profundo.py` ya deja la ficha entera escrita en `fichas/ficha_TICKER.json` y ya cachea
la del día. La ruta **lee ese fichero y lo devuelve**. Así:

- no se duplica la lógica de F10 en dos sitios,
- no se gasta ni una llamada de la cuenta compartida en el caso normal,
- y si el fichero no está o es viejo, la app lo dice en vez de inventarse nada.

Si algún día hace falta forzar el refresco, eso lo decide el script que escribe la ficha, no el
puente. **El puente es de solo lectura y sigue siéndolo.**

## Lo que hay que hacer en el VPS (y necesita root)

1. **Actualizar el puente**, que ya trae las tres rutas de la v4.94 (`/valoracion`, `/dinero`,
   `/velas`) además de esta cuando se añada:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/GaloFly/galowillmakeyourich/main/servidor/instalar.sh | sudo bash
   ```

   Es idempotente y **no regenera la clave**: se puede repetir sin miedo.

2. **Dar acceso de lectura al usuario `bloques`** sobre la carpeta de fichas. El puente corre como
   `bloques` y las fichas son de `agente`, así que hoy no las puede abrir. Lo mínimo que funciona:

   ```bash
   sudo usermod -aG agente bloques          # o un grupo nuevo compartido, si se prefiere
   sudo chmod 750 ~agente/<ruta>/fichas
   sudo chgrp -R agente ~agente/<ruta>/fichas
   sudo systemctl restart bloques-puente    # el grupo nuevo solo lo coge al arrancar
   ```

   **Hace falta saber la ruta exacta de `fichas/`** para ponerla en el puente. Es el único dato que
   falta por confirmar.

## La petición

```
GET /fundamentales?codigo=US.IREN
X-Bloques-Token: <la clave de siempre>
```

`codigo` acepta el formato de Futu (`US.IREN`). El puente se queda con el ticker (`IREN`) para
buscar `ficha_IREN.json`.

## La respuesta

**La ficha se devuelve TAL CUAL**, sin renombrar ni un campo. Es deliberado: cada renombrado es una
oportunidad de que los dos lados dejen de entenderse en silencio. El puente solo envuelve:

```json
{
  "ok": true,
  "codigo": "US.IREN",
  "generada": "2026-08-18T04:12:07Z",
  "edad_s": 34521,
  "del_dia": true,
  "ficha": { ... la ficha entera, tal como la escribe fundamental_profundo.py ... }
}
```

- `generada` — cuándo se escribió la ficha (de su propio contenido, o del `mtime` del fichero).
- `del_dia` — si la ficha es de hoy. La app lo enseña: un múltiplo de hace tres días sigue valiendo,
  pero hay que decir de cuándo es.

Dentro de `ficha`, la app espera esta estructura —la que ya genera el servidor— y **pinta solo lo
que le llegue**: lo que falte se queda sin pintar, no rompe nada.

```
financiero:  periodos[], revenue[], net_income[], gross_profit[], operating_profit[],
             ocf[], fcf[], margen_neto_pct[], margen_fcf_pct[], growth_ingresos_hist_pct
balance:     caja, deuda_total, deuda_neta, equity, ebitda_ttm
multiplos:   market_cap, ev, ev_ebitda, fcf_yield_pct, net_debt_ebitda, pe, ps,
             y el histórico de ev_ebitda y fcf_yield con actual / min / max / mediana
valoracion:  morningstar_fair_value, moat, incertidumbre,
             consenso { medio, alto, bajo, n, buy_pct, hold_pct, sell_pct }, pe_ttm, ps_ttm
ownership:   institucional, insider, smart_money
```

### El campo que NO se pinta

`dcf_base` **no se enseña**, aunque llegue. Es la regla de Victor y va escrita en el código de la
app, no solo aquí: sin ajustar por retribución en acciones engaña, y un número con etiqueta de
"valor razonable" que engaña es peor que ninguno. El valor razonable se decide fuera de la app.

Si algún día se quiere enseñar, hará falta el campo ajustado **con otro nombre**, para que no se
cuele por parecido.

## Los errores

Todos con `{"ok": false, "error": "..."}` y el código HTTP que toca. Nada de devolver 200 con la
ficha a medias:

| Situación | HTTP | Qué dice |
|---|---|---|
| Falta `codigo` | 400 | `Falta el parámetro 'codigo'. Ejemplo: /fundamentales?codigo=US.IREN` |
| No hay ficha de ese ticker | 404 | `No hay ficha de IREN. La genera fundamental_profundo.py en el servidor.` |
| La ficha existe pero no se puede leer | 503 | `La ficha de IREN existe pero el puente no puede leerla (permisos).` |
| La ficha no es JSON válido | 502 | `La ficha de IREN está corrupta.` |

El tercero importa: es exactamente lo que va a pasar si se actualiza el puente y **no** se da el
permiso del paso 2. Con ese mensaje se arregla en un minuto; con un 404 genérico, se busca durante
una hora en el sitio equivocado.

## Caché y ritmo

TTL de **1 hora**. La ficha se escribe una vez al día, así que releerla más a menudo solo gasta
disco. No consume ritmo de OpenD porque no llama a OpenD: no pasa por el contador de `quote` ni por
las ventanas de root — **y no hace falta que pase**, porque no molesta a nadie.

## Qué hace la app cuando esto exista

La ficha de Valoración que ya hay (capitalización, PER, P/VC, BPA, dividendo, rango de 52 semanas,
que salen del snapshot y ya funcionan) **se queda**. Encima se añaden, en el mismo bloque:

1. Ingresos, beneficio y flujo de caja libre por periodos, con el crecimiento.
2. Deuda neta, EBITDA y deuda/EBITDA.
3. EV/EBITDA y FCF yield **contra su propio histórico** (actual frente a mínimo, mediana y máximo),
   que es lo único que convierte un múltiplo en una lectura.
4. Morningstar: fair value, moat e incertidumbre — como dato de Morningstar, con su nombre encima.
5. Consenso: medio, alto, bajo, cuántos analistas y el reparto compra/mantener/vender.
6. Accionariado: institucional, insider y smart money.
