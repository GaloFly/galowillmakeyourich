"""
Puente entre OpenD (moomoo/Futu) y la app Bloques.
======================================================================
OpenD escucha SOLO dentro del servidor y con un protocolo propio, así que un navegador
no puede hablar con él. Este programa se sienta al lado de OpenD, le pregunta los precios
y los sirve como JSON por HTTP, que es lo único que la app sabe leer.

Arranque (lo hace el instalador; a mano sería):
    pip install futu-api flask flask-cors
    export BLOQUES_TOKEN="inventate-una-clave-larga"
    python3 puente.py

Comprobación (desde el propio servidor):
    curl "http://127.0.0.1:8777/salud?token=inventate-una-clave-larga"

----------------------------------------------------------------------------------------
LA MÁQUINA ES COMPARTIDA — esto manda sobre todo lo demás  (v2, 7-ago-2026)
----------------------------------------------------------------------------------------
En este VPS hay UNA sola instancia de OpenD, en 127.0.0.1:11111, y la usan a la vez el
sistema de earnings de `root` y el sistema de venta de puts de `agente`. Los límites de
la API de Futu son POR CUENTA, no por proceso: todo lo que gaste este puente se lo quita
a los otros dos, en silencio y sin que nadie vea por qué.

De ahí las cuatro reglas que gobiernan este fichero:

  1. CACHÉ SIEMPRE. Nunca se pregunta dos veces lo mismo dentro de su ventana. Las cadenas
     de opciones se cachean horas: la lista de contratos de un vencimiento no cambia
     durante la sesión, y `get_option_chain` solo admite 10 llamadas cada 30 s para toda
     la cuenta.
  2. RITMO CONSERVADOR. Se respeta la mitad del límite documentado, no el límite entero.
     El margen que queda es para root y para el agente, que estaban aquí antes.
  3. LAS SUSCRIPCIONES SE DEVUELVEN. El cupo de suscripciones en tiempo real también es de
     la cuenta. Antes esto suscribía y no soltaba nunca: con el tiempo se habría comido el
     bote entero sin usarlo. Ahora hay presupuesto y lo que lleva rato sin pedirse se suelta.
  4. LAS VENTANAS DE ROOT SON SAGRADAS. Entre 15:29-15:46 y 21:30-21:35 (hora de Madrid)
     root está capturando y no se le toca: en esas franjas este puente sirve de caché o
     dice que no, pero no llama a OpenD.

Y lo de siempre:
  · Solo LECTURA. Este puente jamás manda una orden — no importa ni una función de trading.
  · Token obligatorio en todas las rutas. Sin él, 401.
  · Los errores se devuelven explicados y en español; nunca se inventa un precio.
  · Cada respuesta dice de cuándo es el dato (`edad_s`) y si vino de caché, para que la app
    pueda avisarlo en pantalla en vez de aparentar que va en vivo.
"""

import json
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import HTTPCookieProcessor, build_opener

try:
    from zoneinfo import ZoneInfo
    MADRID = ZoneInfo("Europe/Madrid")
except Exception:  # pragma: no cover — Python sin tzdata
    MADRID = None

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from futu import OpenQuoteContext, RET_OK, SubType
except ImportError:  # mensaje claro en vez de un stack trace
    raise SystemExit("Falta la librería de moomoo. Ejecuta:  pip install futu-api")

# ---------------------------------------------------------------- configuración
OPEND_HOST = os.environ.get("OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.environ.get("OPEND_PORT", "11111"))
PUERTO = int(os.environ.get("BLOQUES_PUERTO", "8777"))
TOKEN = os.environ.get("BLOQUES_TOKEN", "")
# Orígenes que pueden llamar a este puente. Añade aquí tu dominio cuando la APP viva en él
# (esto es de dónde se sirve la app, no dónde está este servidor).
ORIGENES = [o.strip() for o in os.environ.get(
    "BLOQUES_ORIGENES",
    "https://galofly.github.io"
).split(",") if o.strip()]

# Caducidad de la caché, en segundos. Se puede ajustar por entorno sin tocar el código.
TTL_COTIZA = int(os.environ.get("BLOQUES_TTL_COTIZA", "20"))    # precios: 20 s es "en vivo" de sobra
TTL_OPCION = int(os.environ.get("BLOQUES_TTL_OPCION", "20"))
TTL_CADENA = int(os.environ.get("BLOQUES_TTL_CADENA", "21600"))  # 6 h: la lista de contratos no cambia
TTL_SALUD = 30
# v4.87: la volatilidad del subyacente. La histórica es un dato diario (no se mueve en toda la
# sesión) y la implícita agregada se mueve poco; 10 min evita gastar cupo compartido en cada búsqueda.
TTL_SUBYACENTE = int(os.environ.get("BLOQUES_TTL_SUBYACENTE", "600"))
# v4.94: el reparto de capital por tamaño de orden es un acumulado del día, no un tick.
TTL_DINERO = int(os.environ.get("BLOQUES_TTL_DINERO", "300"))
# v4.94: velas diarias de Yahoo. La de hoy cambia durante la sesión; las anteriores ya no.
TTL_VELAS = int(os.environ.get("BLOQUES_TTL_VELAS", "900"))
# v4.97: la ficha profunda. Se genera una vez al día, así que releerla más a menudo solo gasta disco.
TTL_FUNDAMENTALES = int(os.environ.get("BLOQUES_TTL_FUNDAMENTALES", "3600"))
# Directorio NEUTRO donde el agente publica las fichas y donde este puente deja los recados. No es
# el del agente a propósito: el servicio corre con ProtectHome=true y no puede entrar en /home.
FICHAS = os.environ.get("BLOQUES_FICHAS", "/var/lib/fichas-bloques")

# Presupuesto de suscripciones de ESTE puente. El cupo real es de la cuenta y se comparte;
# aquí nos limitamos a un trozo pequeño y devolvemos lo que no se usa.
MAX_SUSCRIPCIONES = int(os.environ.get("BLOQUES_MAX_SUBS", "60"))
CADUCA_SUSCRIPCION = int(os.environ.get("BLOQUES_SUB_TTL", "900"))  # 15 min sin pedirse → se suelta

# Ritmo: (llamadas, segundos). La mitad de lo que documenta Futu, para dejar hueco a root.
RITMO = {
    "quote": (30, 30.0),   # get_stock_quote — el límite de snapshot es 60/30 s
    "chain": (5, 30.0),    # get_option_chain — el límite es 10/30 s
    # get_option_expiration_date NO es get_option_chain y no comparte su cupo. Metida en "chain"
    # (como salió en la v5.07) cada búsqueda de puts gastaba 4 de los 5 turnos de cadena en vez
    # de 3, y dos búsquedas seguidas hacían esperar treinta segundos a la sexta llamada — que
    # desde el móvil se ve como "el servidor no contestó en 10 segundos". Cubo aparte y ritmo
    # conservador igualmente: no se conoce su límite documentado y la máquina es compartida.
    "vtos": (10, 30.0),
}

# Franjas en las que root está capturando y no se le molesta (hora de Madrid).
VENTANAS_ROOT = [((15, 29), (15, 46)), ((21, 30), (21, 35))]

if not TOKEN:
    raise SystemExit(
        "Falta el token. Antes de arrancar:\n"
        '    export BLOQUES_TOKEN="inventate-una-clave-larga"\n'
        "Sin token cualquiera que diera con la dirección podría leer tus datos."
    )

app = Flask(__name__)
CORS(app, origins=ORIGENES)


# ---------------------------------------------------------------- ventanas de root
def ventana_de_root():
    """Devuelve el nombre de la franja si estamos dentro de una, o None."""
    ahora = datetime.now(MADRID) if MADRID else datetime.now()
    m = ahora.hour * 60 + ahora.minute
    for (h1, m1), (h2, m2) in VENTANAS_ROOT:
        if h1 * 60 + m1 <= m < h2 * 60 + m2:
            return f"{h1:02d}:{m1:02d}-{h2:02d}:{m2:02d}"
    return None


# ---------------------------------------------------------------- caché
_cache = {}
_cache_lock = threading.Lock()


def cache_get(clave, ttl):
    """Devuelve (valor, edad_en_segundos) si está fresco; (None, None) si no."""
    with _cache_lock:
        e = _cache.get(clave)
    if not e:
        return None, None
    edad = time.monotonic() - e["t"]
    return (e["v"], edad) if edad < ttl else (None, None)


def cache_vencida(clave):
    """El valor aunque esté caducado — para servir algo durante las ventanas de root."""
    with _cache_lock:
        e = _cache.get(clave)
    return (e["v"], time.monotonic() - e["t"]) if e else (None, None)


def cache_set(clave, valor):
    with _cache_lock:
        _cache[clave] = {"v": valor, "t": time.monotonic()}


# ---------------------------------------------------------------- ritmo
_marcas = {k: [] for k in RITMO}
_ritmo_lock = threading.Lock()


def pedir_turno(tipo):
    """
    Espera lo justo para no pasarse del ritmo. Devuelve los segundos que ha esperado.
    Bloquea en vez de rechazar: una espera de un segundo es invisible para el usuario y
    mucho mejor que un error, y como el candado de OpenD serializa igualmente, no se
    acumulan esperas en paralelo.
    """
    cupo, ventana = RITMO[tipo]
    esperado = 0.0
    while True:
        with _ritmo_lock:
            ahora = time.monotonic()
            _marcas[tipo] = [t for t in _marcas[tipo] if ahora - t < ventana]
            if len(_marcas[tipo]) < cupo:
                _marcas[tipo].append(ahora)
                return esperado
            falta = ventana - (ahora - _marcas[tipo][0]) + 0.05
        falta = max(0.05, min(falta, 5.0))
        time.sleep(falta)
        esperado += falta


# ---------------------------------------------------------------- conexión a OpenD
# Una sola conexión compartida, protegida con un candado: Flask atiende varias
# peticiones a la vez y el cliente de Futu no es seguro para uso simultáneo.
_ctx = None
_candado = threading.Lock()
_suscritos = {}  # código -> momento del último uso


def contexto():
    """Devuelve la conexión viva con OpenD, reconectando si se cayó."""
    global _ctx
    if _ctx is None:
        _ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)
    return _ctx


def soltar_contexto():
    """Cierra la conexión para que la siguiente petición la cree limpia."""
    global _ctx
    try:
        if _ctx is not None:
            _ctx.close()
    except Exception:
        pass
    _ctx = None
    _suscritos.clear()


def _liberar_suscripciones(hacen_falta):
    """
    Devuelve al bote las suscripciones viejas. Se llama antes de pedir nuevas.
    Primero las caducadas por tiempo; si aún no cabe, las menos usadas recientemente.
    """
    ahora = time.monotonic()
    sobran = [c for c, t in _suscritos.items() if ahora - t > CADUCA_SUSCRIPCION]
    hueco = MAX_SUSCRIPCIONES - (len(_suscritos) - len(sobran))
    if hueco < hacen_falta:
        vivos = sorted(((t, c) for c, t in _suscritos.items() if c not in sobran))
        sobran += [c for _, c in vivos[: hacen_falta - hueco]]
    if not sobran:
        return
    try:
        contexto().unsubscribe(sobran, [SubType.QUOTE])
    except Exception:
        pass  # si falla, se reintentará en la siguiente; no es motivo para tumbar la petición
    for c in sobran:
        _suscritos.pop(c, None)


def asegurar_suscripcion(codigos):
    """
    OpenD solo devuelve precio de lo que está suscrito. Se suscribe una vez por código.

    Devuelve la lista de códigos que NO se pudieron suscribir (vacía si todo bien).

    v3.1 (14-ago-2026): antes, UN código desconocido tumbaba la petición entera —
    `subscribe(["US.QQQ","US.SPX","US.VIX"])` falla completo con "Unknown stock. SPX" y los tres
    se quedan sin precio. En la app eso significa que el día que Victor tenga un ticker que OpenD
    no conozca (uno delistado, un índice, una errata) se queda sin precios de TODA la cartera.
    Ahora, si el lote falla, se reintenta uno a uno y solo se pierde el que de verdad está mal.
    """
    ahora = time.monotonic()
    nuevos = [c for c in codigos if c not in _suscritos]
    for c in codigos:
        if c in _suscritos:
            _suscritos[c] = ahora  # renueva: lo que se usa, no se suelta
    if not nuevos:
        return []
    if len(_suscritos) + len(nuevos) > MAX_SUSCRIPCIONES:
        _liberar_suscripciones(len(nuevos))
    ret, data = contexto().subscribe(nuevos, [SubType.QUOTE])
    if ret == RET_OK:
        for c in nuevos:
            _suscritos[c] = ahora
        return []
    # el lote ha fallado: se averigua QUIÉN, en vez de castigar a todos
    fallidos = []
    for c in nuevos:
        r, d = contexto().subscribe([c], [SubType.QUOTE])
        if r == RET_OK:
            _suscritos[c] = ahora
        else:
            fallidos.append(c)
    return fallidos


def error(mensaje, codigo=400, **extra):
    return jsonify({"ok": False, "error": mensaje, **extra}), codigo


@app.before_request
def comprobar_token():
    if request.method == "OPTIONS":
        return None
    dado = (request.headers.get("X-Bloques-Token")
            or request.args.get("token", ""))
    if dado != TOKEN:
        return error("Token incorrecto o ausente.", 401)
    return None


def con_cache(clave, ttl, tipo_ritmo, traer):
    """
    El camino que siguen TODAS las consultas a OpenD:
      caché fresca → se sirve · ventana de root → caché aunque esté vieja, o se dice que no
      · si no → se pide turno y se llama, y se guarda.
    Devuelve (payload, http) para responder tal cual.
    """
    valor, edad = cache_get(clave, ttl)
    if valor is not None:
        return {**valor, "cacheado": True, "edad_s": round(edad, 1)}, 200

    franja = ventana_de_root()
    if franja:
        viejo, edad_v = cache_vencida(clave)
        if viejo is not None:
            return {**viejo, "cacheado": True, "edad_s": round(edad_v, 1),
                    "aviso": f"Dato de hace {int(edad_v)} s: entre {franja} el servidor "
                             f"está ocupado con otra tarea y no se consulta a OpenD."}, 200
        return {"ok": False, "error": f"Entre {franja} (hora de Madrid) el servidor está "
                                      f"ocupado con otra tarea y no se consulta a OpenD. "
                                      f"Vuelve a intentarlo pasada esa franja."}, 503

    espera = pedir_turno(tipo_ritmo)
    with _candado:
        try:
            payload, http = traer()
        except Exception as e:
            soltar_contexto()
            return {"ok": False, "error": f"Se perdió la conexión con OpenD: {e}"}, 503
    if http == 200:
        cache_set(clave, payload)
        payload = {**payload, "cacheado": False, "edad_s": 0}
        if espera > 0.5:
            payload["aviso"] = ("El servidor esperó %.1f s para no pasarse del cupo de "
                                "consultas que comparte con las otras tareas." % espera)
    return payload, http


# ---------------------------------------------------------------- rutas
@app.route("/salud")
def salud():
    """Primera parada: dice si el puente vive y si OpenD contesta de verdad."""
    valor, edad = cache_get("salud", TTL_SALUD)
    if valor is not None:
        return jsonify({**valor, "cacheado": True, "edad_s": round(edad, 1)})

    franja = ventana_de_root()
    with _candado:
        try:
            ret, data = contexto().get_global_state()
            if ret != RET_OK:
                soltar_contexto()
                return error(f"OpenD no contesta: {data}", 503)
            estado = data if isinstance(data, dict) else {}
            payload = {
                "ok": True,
                "opend": "conectado",
                "mercado_us": estado.get("market_us", "?"),
                "sesion_iniciada": estado.get("qot_logined", "?"),
                "suscripciones": len(_suscritos),
                "hora": datetime.now(timezone.utc).isoformat(),
            }
            if franja:
                payload["aviso"] = (f"Estás dentro de la franja {franja}: hasta que pase, los "
                                    f"precios se sirven de caché para no molestar a la otra tarea.")
            cache_set("salud", payload)
            return jsonify({**payload, "cacheado": False, "edad_s": 0})
        except Exception as e:
            soltar_contexto()
            return error(f"No se pudo hablar con OpenD ({OPEND_HOST}:{OPEND_PORT}): {e}", 503)


@app.route("/cotiza")
def cotiza():
    """Precio de uno o varios valores.  /cotiza?codigos=US.AAPL,US.TSLA"""
    crudos = request.args.get("codigos", "").strip()
    if not crudos:
        return error("Falta el parámetro 'codigos'. Ejemplo: /cotiza?codigos=US.AAPL")
    codigos = sorted({c.strip().upper() for c in crudos.split(",") if c.strip()})
    if len(codigos) > 200:
        return error("Demasiados códigos de una vez (máximo 200).")

    def traer():
        fallidos = asegurar_suscripcion(codigos)
        vivos = [c for c in codigos if c not in fallidos]
        if not vivos:
            return {"ok": False, "error": "OpenD no conoce ninguno de estos códigos: "
                                          + ", ".join(fallidos)}, 404
        ret, data = contexto().get_stock_quote(vivos)
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir precios: {data}"}, 502
        salida = {}
        for fila in data.to_dict("records"):
            # data_date/data_time marcan a qué momento corresponde el precio: si va con
            # retraso, se ve aquí. La app lo usa para no presumir de "en vivo" cuando no lo es.
            salida[fila.get("code")] = {
                "ultimo": fila.get("last_price"),
                "cierre_anterior": fila.get("prev_close_price"),
                "apertura": fila.get("open_price"),
                "maximo": fila.get("high_price"),
                "minimo": fila.get("low_price"),
                "volumen": fila.get("volume"),
                "fecha_dato": fila.get("data_date"),
                "hora_dato": fila.get("data_time"),
            }
        resp = {"ok": True, "cotizaciones": salida}
        if fallidos:
            resp["desconocidos"] = fallidos  # se dice cuáles, no se callan
        return resp, 200

    payload, http = con_cache("cotiza:" + ",".join(codigos), TTL_COTIZA, "quote", traer)
    return jsonify(payload), http


@app.route("/opcion")
def opcion():
    """
    Precio de un contrato concreto.  /opcion?codigo=US.TMDX260918P70000
    El código es: US.TICKER + AAMMDD + P|C + strike×1000 con ceros a la izquierda.
    TMDX put 70 del 18-sep-2026  ->  US.TMDX260918P70000
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /opcion?codigo=US.TMDX260918P70000")

    def traer():
        fallidos = asegurar_suscripcion([codigo])
        if fallidos:
            return {"ok": False, "error": f"OpenD no conoce el contrato {codigo}."}, 404
        ret, data = contexto().get_stock_quote([codigo])
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir la opción: {data}"}, 502
        filas = data.to_dict("records")
        if not filas:
            return {"ok": False, "error": f"OpenD no devolvió datos para {codigo}. "
                                          f"¿El código está bien escrito?"}, 404
        f = filas[0]
        # v3 (14-ago-2026): la HORQUILLA. Para decidir qué put vender, el último precio no
        # vale: en un contrato poco líquido puede ser de hace horas. Lo que se negocia es el
        # punto medio entre lo que te pagan (bid) y lo que piden (ask).
        # get_stock_quote no siempre trae bid/ask, así que se pide el snapshot —que no gasta
        # suscripción— y si tampoco los da, se devuelven nulos y la app usa el último precio.
        #
        # v4 (14-ago-2026) — LAS GRIEGAS SALEN DE AQUÍ, NO DE get_stock_quote.
        # Victor, con el mercado ABIERTO: "se siguen sin ver las griegas del portfolio".
        # Este era el fallo: las griegas se leían del registro de `get_stock_quote`, que NO trae
        # las columnas option_delta / option_theta / option_implied_volatility — esas solo vienen
        # en el snapshot. O sea que por esta ruta llegaban SIEMPRE vacías, con el mercado abierto
        # o cerrado, y como la app cae a /opcion en cuanto /opciones falla por lo que sea, el
        # portfolio se quedaba sin griegas sin que nada avisara.
        # (Es el mismo error de la v4.57 al revés: entonces creímos que OpenD no daba griegas
        # fuera de horario, y resultó que preguntábamos por la puerta equivocada.)
        snap_f = {}
        bid = ask = None
        try:
            ret_s, snap = contexto().get_market_snapshot([codigo])
            if ret_s == RET_OK:
                fs = snap.to_dict("records")
                if fs:
                    snap_f = fs[0]
                    bid = snap_f.get("bid_price")
                    ask = snap_f.get("ask_price")
        except Exception:
            pass  # el snapshot es un extra: si falla, no se rompe la consulta
        medio = None
        try:
            if bid is not None and ask is not None and float(bid) > 0 and float(ask) > 0:
                medio = round((float(bid) + float(ask)) / 2, 4)
        except (TypeError, ValueError):
            medio = None
        return {"ok": True, "opcion": {
            "codigo": codigo,
            "ultimo": f.get("last_price"),
            "bid": bid,
            "ask": ask,
            "medio": medio,
            "cierre_anterior": f.get("prev_close_price"),
            "volumen": f.get("volume"),
            # del SNAPSHOT, no del quote: ver el comentario de arriba
            "interes_abierto": snap_f.get("option_open_interest"),
            "iv": snap_f.get("option_implied_volatility"),
            "delta": snap_f.get("option_delta"),
            "theta": snap_f.get("option_theta"),
            "gamma": snap_f.get("option_gamma"),
            "vega": snap_f.get("option_vega"),
            # la hora del propio dato, que es lo que decide si es de ahora o del último cierre.
            # El snapshot la trae junta en `update_time`; el quote, partida en fecha y hora.
            "fecha_dato": snap_f.get("update_time") or f.get("data_date"),
            "hora_dato": f.get("data_time"),
        }}, 200

    payload, http = con_cache("opcion:" + codigo, TTL_OPCION, "quote", traer)
    return jsonify(payload), http


@app.route("/opciones")
def opciones():
    """
    Precio de VARIOS contratos de una vez.  /opciones?codigos=US.NVDA260918P170000,US.NVDA260918P175000

    Por qué existe (14-ago-2026): el comparador de puts necesita el precio de ~18 contratos
    para poner tres vencimientos en fila. Con /opcion serían 18 llamadas a OpenD; con
    `get_market_snapshot` es UNA sola, porque admite hasta 400 códigos de golpe.
    En una cuenta compartida con root y con el agente, esa diferencia no es una optimización:
    es la diferencia entre poder usar la herramienta y no poder.

    Además el snapshot **no gasta suscripción**, que también es cupo de la cuenta.

    Se cachea POR CÓDIGO y con la misma clave que /opcion, así que los dos se aprovechan
    mutuamente: lo que ya está fresco no se vuelve a pedir.
    """
    crudos = request.args.get("codigos", "")
    codigos = [c.strip().upper() for c in crudos.split(",") if c.strip()]
    if not codigos:
        return error("Falta 'codigos' (separados por comas). "
                     "Ejemplo: /opciones?codigos=US.NVDA260918P170000,US.NVDA260918P175000")
    if len(codigos) > 200:
        return error(f"Demasiados contratos de una vez ({len(codigos)}). Máximo 200: "
                     "pedir menos y más veces es peor para el cupo, pero pedir 400 de golpe "
                     "deja sin aire a los otros sistemas de la máquina.")

    # lo que ya esté fresco en caché no se vuelve a pedir
    salida, faltan = {}, []
    for c in codigos:
        v, edad = cache_get("opcion:" + c, TTL_OPCION)
        if v is not None and v.get("opcion"):
            salida[c] = {**v["opcion"], "cacheado": True, "edad_s": round(edad, 1)}
        else:
            faltan.append(c)

    aviso = None
    if faltan:
        franja = ventana_de_root()
        if franja:
            # en las ventanas de root no se llama: se sirve lo caducado si lo hay
            for c in faltan:
                v, edad = cache_vencida("opcion:" + c)
                if v is not None and v.get("opcion"):
                    salida[c] = {**v["opcion"], "cacheado": True, "edad_s": round(edad, 1)}
            aviso = (f"Entre {franja} (hora de Madrid) el servidor está ocupado con otra tarea "
                     f"y no se consulta a OpenD.")
        else:
            espera = pedir_turno("quote")
            with _candado:
                try:
                    ret, data = contexto().get_market_snapshot(faltan)
                except Exception as e:
                    soltar_contexto()
                    return jsonify({"ok": False, "error": f"Se perdió la conexión con OpenD: {e}"}), 503
                if ret != RET_OK:
                    return jsonify({"ok": False, "error": f"OpenD devolvió un error: {data}"}), 502
                filas = data.to_dict("records")
            for f in filas:
                cod = f.get("code")
                if not cod:
                    continue
                bid, ask = f.get("bid_price"), f.get("ask_price")
                medio = None
                try:
                    if bid is not None and ask is not None and float(bid) > 0 and float(ask) > 0:
                        medio = round((float(bid) + float(ask)) / 2, 4)
                except (TypeError, ValueError):
                    medio = None
                o = {
                    "codigo": cod,
                    "ultimo": f.get("last_price"),
                    "bid": bid, "ask": ask, "medio": medio,
                    "cierre_anterior": f.get("prev_close_price"),
                    "volumen": f.get("volume"),
                    "interes_abierto": f.get("option_open_interest"),
                    "iv": f.get("option_implied_volatility"),
                    "delta": f.get("option_delta"),
                    "theta": f.get("option_theta"),
                    "gamma": f.get("option_gamma"),
                    "vega": f.get("option_vega"),
                    "fecha_dato": f.get("update_time"),
                }
                cache_set("opcion:" + cod, {"ok": True, "opcion": o})
                salida[cod] = {**o, "cacheado": False, "edad_s": 0}
            if espera > 0.5:
                aviso = f"El servidor esperó {espera:.1f} s para no pasarse del cupo de OpenD."

    resp = {"ok": True, "opciones": salida, "pedidos": len(codigos),
            "de_cache": len(codigos) - len(faltan), "sin_datos": [c for c in codigos if c not in salida]}
    if aviso:
        resp["aviso"] = aviso
    return jsonify(resp)


@app.route("/cadena")
def cadena():
    """
    Cadena de opciones.  Un vencimiento suelto o un RANGO de fechas:
        /cadena?codigo=US.TMDX&vencimiento=2026-09-18
        /cadena?codigo=US.TMDX&desde=2026-09-01&hasta=2026-11-15

    El rango (v3, 14-ago-2026) es lo que permite a la app DESCUBRIR qué vencimientos
    existen: para comparar puts a ~30, ~45 y ~60 días no se puede adivinar la fecha —
    hay semanales, mensuales y ninguna regla fiable. Con una sola llamada se ven todas
    las que hay en la ventana, y la app elige las tres más cercanas a lo que pidió.
    Además se devuelve `vencimientos`, la lista ordenada de fechas distintas.

    Se cachea 6 horas a propósito: la LISTA de contratos no cambia durante la sesión, y
    `get_option_chain` solo admite 10 llamadas cada 30 s para toda la cuenta —
    compartidas con root. Los precios se piden con /opcion, que sí es fresco.
    """
    subyacente = request.args.get("codigo", "").strip().upper()
    vto = request.args.get("vencimiento", "").strip()
    desde = request.args.get("desde", "").strip() or vto
    hasta = request.args.get("hasta", "").strip() or vto
    if not subyacente or not desde or not hasta:
        return error("Faltan parámetros. Ejemplos: /cadena?codigo=US.TMDX&vencimiento=2026-09-18 "
                     "· /cadena?codigo=US.TMDX&desde=2026-09-01&hasta=2026-11-15")

    # Futu NO admite más de 30 días de golpe ("the requested time span cannot exceed 30 days",
    # comprobado en el VPS el 14-ago-2026). Se parte el rango en tramos de 30 y se juntan.
    # Cada tramo es una llamada a get_option_chain, que es de 10 cada 30 s PARA TODA LA CUENTA,
    # así que se pide turno antes de cada uno y se limita a 3 tramos (90 días): para elegir
    # vencimientos a 30/45/60 días sobran dos.
    MAX_TRAMOS = 3
    try:
        d0 = datetime.strptime(desde, "%Y-%m-%d")
        d1 = datetime.strptime(hasta, "%Y-%m-%d")
    except ValueError:
        return error("Las fechas van en formato AAAA-MM-DD. Ejemplo: desde=2026-09-01&hasta=2026-10-15")
    if d1 < d0:
        return error("'hasta' es anterior a 'desde'.")
    tramos = []
    ini = d0
    while ini <= d1 and len(tramos) < MAX_TRAMOS:
        fin = min(ini + timedelta(days=29), d1)
        tramos.append((ini.strftime("%Y-%m-%d"), fin.strftime("%Y-%m-%d")))
        ini = fin + timedelta(days=1)
    if ini <= d1:
        return error(f"El rango es demasiado largo: como mucho {MAX_TRAMOS * 30} días "
                     f"(Futu solo sirve 30 por llamada y cada una gasta del cupo compartido).")

    def traer():
        contratos, vistos = [], set()
        for i, (a, b) in enumerate(tramos):
            if i:
                pedir_turno("chain")  # el primer turno ya lo pidió con_cache
            ret, data = contexto().get_option_chain(code=subyacente, start=a, end=b)
            if ret != RET_OK:
                # si un tramo falla pero otro ya trajo datos, se devuelve lo que hay y se dice
                if contratos:
                    return {"ok": True, "contratos": contratos, "total": len(contratos),
                            "vencimientos": sorted({str(c["vencimiento"])[:10] for c in contratos if c.get("vencimiento")}),
                            "aviso": f"Del {a} al {b} no se pudo leer: {data}"}, 200
                return {"ok": False, "error": f"OpenD devolvió un error al pedir la cadena: {data}"}, 502
            for r in data.to_dict("records"):
                cod = r.get("code")
                if cod in vistos:
                    continue  # los tramos no se solapan, pero por si acaso
                vistos.add(cod)
                contratos.append({
                    "codigo": cod,
                    "tipo": r.get("option_type"),
                    "strike": r.get("strike_price"),
                    "vencimiento": r.get("strike_time"),
                })
        # la fecha viene como "2026-09-18 00:00:00" en algunas versiones: se queda el día
        vencimientos = sorted({str(c["vencimiento"])[:10] for c in contratos if c.get("vencimiento")})
        return {"ok": True, "contratos": contratos, "total": len(contratos),
                "vencimientos": vencimientos, "tramos": len(tramos)}, 200

    payload, http = con_cache(f"cadena:{subyacente}:{desde}:{hasta}", TTL_CADENA, "chain", traer)
    return jsonify(payload), http


@app.route("/vencimientos")
def vencimientos():
    """
    SOLO LA LISTA DE FECHAS en las que vence algo. /vencimientos?codigo=US.RDDT

    Por qué existe (19-ago-2026). Hasta ahora la app descubría los vencimientos pidiendo
    CADENAS, y una cadena son 30 días por llamada (el límite de Futu), agrupadas de tres en
    tres. Para mirar hasta un año harían falta 12 llamadas de un cupo que es de 10 cada 30 s
    PARA TODA LA CUENTA, compartido con el sistema de earnings de root y con el agente. Así
    que no se miraba entera: se abrían tres ventanas colocadas donde se suponía que estaban
    los plazos pedidos.

    Y suponer dónde están fue el origen de SEIS versiones seguidas de fallos (v5.01 a v5.06):
    la ventana caía en el hueco entre dos eneros, o cogía un vencimiento que existe y no
    cotiza, o el borde dependía de la hora del día. Victor lo resumió en una frase — *"¿cómo
    puede ser que Moomoo sí tenga vencimientos y tú no los puedas sacar?"*— y tenía razón:
    Moomoo enseña la escalera entera porque la PIDE entera.

    `get_option_expiration_date` da esa lista en UNA llamada y sin ventana de 30 días. Con
    ella la app deja de adivinar: sabe que RDDT vence a 302, 394, 520, 667, 758 y 849 días,
    y pide cadena SOLO de las fechas que quiere mirar.

    Si el OpenD instalado no conociera la función, se dice con esas palabras y un 501: la app
    tiene que poder distinguir "este servidor no sabe hacerlo" (y volver a su camino de antes)
    de "ha fallado". Se cachea 6 h, como las cadenas: la lista no cambia durante la sesión.
    """
    subyacente = request.args.get("codigo", "").strip().upper()
    if not subyacente:
        return error("Falta el código. Ejemplo: /vencimientos?codigo=US.RDDT")

    def traer():
        ctx = contexto()
        fn = getattr(ctx, "get_option_expiration_date", None)
        if fn is None:
            return {"ok": False, "sin_ruta": True,
                    "error": "Este OpenD no tiene get_option_expiration_date. Actualiza futu-api."}, 501
        ret, data = fn(code=subyacente)
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir los vencimientos: {data}"}, 502
        fechas = set()
        for r in data.to_dict("records"):
            # el nombre de la columna ha cambiado entre versiones de la librería; se aceptan las dos
            f = r.get("strike_time") or r.get("expiration_date") or r.get("date")
            if f:
                fechas.add(str(f)[:10])
        return {"ok": True, "vencimientos": sorted(fechas), "total": len(fechas)}, 200

    payload, http = con_cache(f"vencimientos:{subyacente}", TTL_CADENA, "vtos", traer)
    return jsonify(payload), http


@app.route("/subyacente")
def subyacente():
    """
    Volatilidad del SUBYACENTE: implícita agregada, histórica realizada y sus rangos.
    /subyacente?codigo=US.IREN

    Por qué esta ruta y no el snapshot (comprobado en el VPS el 17-ago-2026, sobre las 142
    columnas de `get_market_snapshot`): ahí NO hay ni una columna de volatilidad histórica.
    La única con dato es `option_implied_volatility`, que es la IV de ESE contrato. La histórica
    vive solo aquí, en `get_option_underlying_overview`.

    Y el aviso que evita el error de bulto: `iv` (IV agregada del subyacente, 103,7 en IREN) NO es
    lo mismo que el `option_implied_volatility` de un contrato concreto (99,66 en la P25 de ene-27).
    El cociente IV/HV se calcula con las DOS de aquí, que son de la misma medición; mezclar la de un
    contrato con la histórica del subyacente daría un número que parece el mismo y no lo es.

    Todo llega en escala PORCENTUAL (103,733 = 103,73%), no en 0-1.
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /subyacente?codigo=US.IREN")

    def traer():
        ret, data = contexto().get_option_underlying_overview([codigo])
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir la volatilidad: {data}"}, 502
        filas = data.to_dict("records")
        if not filas:
            return {"ok": False, "error": f"OpenD no devolvió volatilidad para {codigo}."}, 404
        f = filas[0]
        def num(k):
            v = f.get(k)
            try:
                v = float(v)
            except (TypeError, ValueError):
                return None
            return None if v != v else v  # nan
        return {"ok": True, "subyacente": {
            "codigo": f.get("code") or codigo,
            "nombre": f.get("name"),
            "iv": num("iv"),
            "iv_rank": num("iv_rank"),
            "iv_percentil": num("iv_percentile"),
            "iv_previa": num("pre_iv"),
            # v4.93: volumen y OI agregados de calls y puts. Vienen en la MISMA llamada que ya se
            # hacía para la volatilidad, así que el P/C del subyacente sale a coste cero.
            "call_volumen": num("call_volume"), "put_volumen": num("put_volume"),
            "call_oi": num("call_open_interest"), "put_oi": num("put_open_interest"),
            "hv_30d": num("hv_30d"), "hv_30d_percentil": num("hv_30d_percentile"),
            "hv_60d": num("hv_60d"), "hv_90d": num("hv_90d"),
            "hv_365d": num("hv_365d"),
        }}, 200

    # 10 min: la histórica es un dato diario y no se mueve; la implícita agregada sí, pero no tanto
    # como para gastar el cupo compartido en cada búsqueda.
    payload, http = con_cache("subyacente:" + codigo, TTL_SUBYACENTE, "quote", traer)
    return jsonify(payload), http


@app.route("/valoracion")
def valoracion():
    """
    Fundamentales del subyacente: capitalización, PER, P/VC, BPA, dividendo y rango de 52 semanas.
    /valoracion?codigo=US.MRVL

    Salen del MISMO `get_market_snapshot` que ya se usa para las opciones, sin ninguna llamada de
    otro tipo. La razón por la que no se veían: pedido sobre un CONTRATO, ese bloque llega con
    `equity_valid False` y los dieciséis campos a nan — así salió en el volcado de las 142 columnas
    del 17-ago-2026. Pedido sobre el código de la ACCIÓN, el bloque es válido y trae el dato.

    El snapshot no gasta suscripción (su límite es 60 llamadas / 30 s, y aquí se pide una).
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /valoracion?codigo=US.MRVL")

    def traer():
        ret, data = contexto().get_market_snapshot([codigo])
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir los fundamentales: {data}"}, 502
        filas = data.to_dict("records")
        if not filas:
            return {"ok": False, "error": f"OpenD no devolvió nada para {codigo}."}, 404
        f = filas[0]

        def num(k):
            v = f.get(k)
            try:
                v = float(v)
            except (TypeError, ValueError):
                return None
            return None if v != v else v  # nan

        valido = bool(f.get("equity_valid"))
        salida = {
            "codigo": f.get("code") or codigo,
            "nombre": f.get("name"),
            # `equity_valid` se devuelve tal cual: si es False, la app lo dice en vez de pintar
            # una ficha vacía. Un hueco explicado no se confunde con una avería.
            "fundamentales_validos": valido,
            "ultimo": num("last_price"), "cierre_anterior": num("prev_close_price"),
            "capitalizacion": num("total_market_val"), "capitalizacion_flotante": num("circular_market_val"),
            "acciones_emitidas": num("issued_shares"), "acciones_en_circulacion": num("outstanding_shares"),
            "per": num("pe_ratio"), "per_ttm": num("pe_ttm_ratio"), "p_vc": num("pb_ratio"),
            "rentabilidad_beneficio": num("ey_ratio"),
            "bpa": num("earning_per_share"), "valor_contable_accion": num("net_asset_per_share"),
            "patrimonio": num("net_asset"), "beneficio": num("net_profit"),
            "dividendo_ttm": num("dividend_ttm"), "dividendo_ttm_pct": num("dividend_ratio_ttm"),
            "dividendo_ultimo_ejercicio": num("dividend_lfy"), "dividendo_ultimo_ejercicio_pct": num("dividend_lfy_ratio"),
            "max_52s": num("highest52weeks_price"), "min_52s": num("lowest52weeks_price"),
            "max_historico": num("highest_history_price"), "min_historico": num("lowest_history_price"),
            "rotacion": num("turnover_rate"), "ratio_volumen": num("volume_ratio"), "amplitud": num("amplitude"),
            "fecha_dato": f.get("update_time"),
        }
        return {"ok": True, "valoracion": salida}, 200

    payload, http = con_cache("valoracion:" + codigo, TTL_SUBYACENTE, "quote", traer)
    return jsonify(payload), http


@app.route("/dinero")
def dinero():
    """
    De dónde viene el dinero, repartido por TAMAÑO de orden — lo que el bot de Telegram llama
    "flujo por tamaño".  /dinero?codigo=US.MRVL

    Es `get_capital_distribution`, del mismo OpenD. Mide dinero que ENTRA y que SALE en la sesión
    separado por el tamaño de la orden que lo movió: las órdenes grandes son el rastro de quien
    mueve tamaño, las pequeñas el del minorista. Ojo con lo que NO es: sigue sin decir quién fue el
    agresor de cada cruce, así que es una pista, no una dirección.

    Se devuelven además los nombres de columna que mandó OpenD (`columnas`). Si algún día su
    librería los renombra, la app enseña la lista en vez de una ficha vacía y se arregla en un
    minuto en lugar de a ciegas.
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /dinero?codigo=US.MRVL")

    def traer():
        ctx = contexto()
        if not hasattr(ctx, "get_capital_distribution"):
            return {"ok": False, "error": "Esta versión de la librería de moomoo no tiene "
                                          "get_capital_distribution. Actualiza con: pip install -U futu-api"}, 501
        ret, data = ctx.get_capital_distribution(codigo)
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir el reparto de capital: {data}"}, 502
        filas = data.to_dict("records")
        if not filas:
            return {"ok": False, "error": f"OpenD no devolvió reparto de capital para {codigo}."}, 404
        f = filas[0]

        def num(*claves):
            """Acepta varios nombres para el mismo concepto: la librería los ha cambiado alguna vez."""
            for k in claves:
                if k in f:
                    try:
                        v = float(f.get(k))
                    except (TypeError, ValueError):
                        continue
                    if v == v:  # descarta nan
                        return v
            return None

        entra = {
            "muy_grande": num("capital_in_super", "capital_in_very_big"),
            "grande": num("capital_in_big"),
            "media": num("capital_in_mid", "capital_in_middle"),
            "pequena": num("capital_in_small", "capital_in_sml"),
        }
        sale = {
            "muy_grande": num("capital_out_super", "capital_out_very_big"),
            "grande": num("capital_out_big"),
            "media": num("capital_out_mid", "capital_out_middle"),
            "pequena": num("capital_out_small", "capital_out_sml"),
        }
        return {"ok": True, "dinero": {
            "codigo": f.get("code") or codigo,
            "entra": entra, "sale": sale,
            "fecha_dato": f.get("update_time"),
        }, "columnas": sorted(f.keys())}, 200

    # 5 min: es un acumulado del día, no un tick. Refrescarlo más a menudo no añade nada y sí gasta.
    payload, http = con_cache("dinero:" + codigo, TTL_DINERO, "quote", traer)
    return jsonify(payload), http


"""
Bajar velas de fuera.

EL USER-AGENT CORTO NO SE TOCA. Es contraintuitivo y costó un rato entenderlo, así que queda
escrito con la prueba al lado (VPS, 19-ago-2026, tres rondas seguidas en el mismo minuto y desde
la misma IP, reproducible en los dos sentidos):

    User-Agent: Mozilla/5.0            -> 200 · 200 · 200
    UA de Chrome completo              -> 429 · 429 · 429
    sin User-Agent                     -> 429 · 429 · 429

O sea que Yahoo penaliza precisamente el UA de navegador completo cuando viene de una IP de centro
de datos —lo contrario de lo que uno supondría—, y la versión anterior de este fichero mandaba
justo ese. El comentario decía "sin User-Agent de navegador la respuesta es 429": era falso, y por
creerlo se añadieron una cookie y un segundo host que no hacían falta.

El `grafico.py` del bot lleva meses pidiendo velas desde esta misma máquina con `Mozilla/5.0` y no
ha fallado nunca. Esa era la pista, y estaba delante.

El opener se crea UNA vez y se reutiliza; el tarro de cookies se queda porque no estorba y guarda
lo que Yahoo mande por su cuenta.
"""
_NAVEGADOR = "Mozilla/5.0"
_opener = None
_opener_lock = threading.Lock()


def _abridor():
    global _opener
    with _opener_lock:
        if _opener is None:
            _opener = build_opener(HTTPCookieProcessor(CookieJar()))
            _opener.addheaders = [("User-Agent", _NAVEGADOR), ("Accept", "*/*")]
        return _opener


def _pedir(url, timeout=12):
    """Devuelve el cuerpo en bytes, o lanza. No interpreta nada: eso es de quien llama."""
    with _abridor().open(url, timeout=timeout) as r:
        return r.read()


def velas_de_stooq(csv):
    """
    Convierte el CSV diario de Stooq en la misma lista de velas que Yahoo.
    Cabecera: Date,Open,High,Low,Close,Volume · un símbolo desconocido contesta 'No data'.

    Existe porque Yahoo limita por IP y la de un VPS es de centro de datos. Dos fuentes que se
    parsean a la misma forma son dos fuentes; una sola es una dependencia.
    """
    filas = [l.strip() for l in (csv or "").splitlines() if l.strip()]
    if len(filas) < 2 or not filas[0].lower().startswith("date"):
        return []
    salida = []
    for l in filas[1:]:
        p = l.split(",")
        if len(p) < 5 or len(p[0]) != 10:
            continue
        def num(i):
            try:
                v = float(p[i])
            except (TypeError, ValueError, IndexError):
                return None
            return None if v != v else v
        cierre = num(4)
        if cierre is None:
            continue
        salida.append({"f": p[0], "o": num(1), "h": num(2), "l": num(3), "c": cierre,
                       "v": num(5) if len(p) > 5 else None})
    return salida


def velas_de_yahoo(crudo):
    """
    Convierte la respuesta del gráfico de Yahoo en una lista de velas.
    Devuelve None si el símbolo no existe (Yahoo contesta con `result: null` y un `error`),
    y una lista —que puede quedar vacía— si contesta pero sin velas utilizables.

    Va aparte de la ruta para poder probarla sin salir a internet (pruebas/velas-yahoo.py):
    Yahoo manda HUECOS —días con `null` en todos los campos, y a veces un cierre suelto sin
    máximo ni mínimo—, y esa es justo la parte que se puede escribir mal sin que se note.
    """
    res = ((crudo.get("chart") or {}).get("result") or [None])[0]
    if not res:
        return None
    tiempos = res.get("timestamp") or []
    q = ((res.get("indicators") or {}).get("quote") or [{}])[0]
    salida = []
    for i, ts in enumerate(tiempos):
        def campo(nombre):
            lista = q.get(nombre) or []
            v = lista[i] if i < len(lista) else None
            try:
                v = float(v)
            except (TypeError, ValueError):
                return None
            return None if v != v else v  # nan
        cierre = campo("close")
        if cierre is None:
            continue  # una vela sin cierre no es una vela
        salida.append({"f": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d"),
                       "o": campo("open"), "h": campo("high"), "l": campo("low"),
                       "c": cierre, "v": campo("volume")})
    return salida


@app.route("/velas")
def velas():
    """
    Velas diarias para los NIVELES (soportes, resistencias, medias).  /velas?codigo=US.MRVL&rango=1y

    Esta ruta NO toca OpenD: ni suscripción, ni ritmo, ni ventana de root. Y es a propósito.

    El cupo de histórico de Futu (`request_history_kline`) es de **100 símbolos distintos cada 7
    días para toda la cuenta**, y root ya gasta 12 con el barrido nocturno de sectores (comprobado
    el 18-ago-2026: 12 consumidos, 88 libres). Un ticker mirado hoy queda apuntado una semana
    entera, así que una tarde de análisis se comería el cupo de los tres sistemas de la máquina.
    Yahoo da la misma vela diaria de cierre y no gasta nada de Futu.

    Lo que se devuelve son velas y ya: las medias, los pivotes y los retrocesos los calcula la app.
    Aquí solo viaja el DATO.
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /velas?codigo=US.MRVL")
    # "US.MRVL" -> "MRVL": Yahoo no usa el prefijo de mercado de Futu
    simbolo = codigo.split(".")[-1]
    rango = request.args.get("rango", "1y").strip().lower()
    if rango not in ("1mo", "3mo", "6mo", "1y", "2y", "5y"):
        return error("Rango no válido. Usa uno de: 1mo, 3mo, 6mo, 1y, 2y, 5y.")

    clave = f"velas:{simbolo}:{rango}"
    valor, edad = cache_get(clave, TTL_VELAS)
    if valor is not None:
        return jsonify({**valor, "cacheado": True, "edad_s": round(edad, 1)})

    intentos = []          # se guarda lo que dijo cada fuente, para que el error no sea opaco
    salida, fuente = None, None

    # --- 1) Yahoo, sus dos hosts. El segundo no es superstición: query1 y query2 van por
    #        infraestructuras distintas y uno responde a veces cuando el otro limita.
    for host in ("query1", "query2"):
        try:
            r = _pedir(f"https://{host}.finance.yahoo.com/v8/finance/chart/{quote(simbolo)}"
                       f"?range={rango}&interval=1d")
        except HTTPError as e:
            intentos.append(f"{host}: HTTP {e.code}")
            continue
        except Exception as e:
            intentos.append(f"{host}: {e}")
            continue
        try:
            crudo = json.loads(r.decode("utf-8"))
        except ValueError:
            intentos.append(f"{host}: no contestó JSON")
            continue
        v = velas_de_yahoo(crudo)
        if v is None:
            err = ((crudo.get("chart") or {}).get("error") or {}).get("description")
            return error(f"Yahoo no conoce el símbolo {simbolo}." + (f" ({err})" if err else ""), 404)
        if v:
            salida, fuente = v, "Yahoo Finance"
            break
        intentos.append(f"{host}: sin velas")

    # --- 2) Stooq, último recurso. AVISO: comprobado el 19-ago-2026 en este VPS, contesta 200
    #        pero con una página de verificación por JavaScript, no con el CSV — o sea que hoy no
    #        va a servir velas. Se queda porque no cuesta nada (solo se intenta si Yahoo falla) y
    #        porque el parseo está probado; pero no es una red de seguridad de verdad. La red de
    #        seguridad de verdad es el User-Agent corto de arriba.
    if salida is None:
        dias = {"1mo": 40, "3mo": 100, "6mo": 190, "1y": 380, "2y": 750, "5y": 1850}[rango]
        d1 = (datetime.now(timezone.utc) - timedelta(days=dias)).strftime("%Y%m%d")
        d2 = datetime.now(timezone.utc).strftime("%Y%m%d")
        try:
            r = _pedir(f"https://stooq.com/q/d/l/?s={quote(simbolo.lower())}.us&i=d&d1={d1}&d2={d2}")
            v = velas_de_stooq(r.decode("utf-8", "replace"))
            if v:
                salida, fuente = v, "Stooq"
            else:
                intentos.append("stooq: sin velas")
        except HTTPError as e:
            intentos.append(f"stooq: HTTP {e.code}")
        except Exception as e:
            intentos.append(f"stooq: {e}")

    if salida is None:
        return error(f"Ninguna fuente de velas contestó para {simbolo}. " + " · ".join(intentos), 502)

    payload = {"ok": True, "simbolo": simbolo, "velas": salida, "total": len(salida),
               "fuente": fuente + " (no gasta cupo de OpenD)"}
    if intentos:
        # si hubo que caer a la segunda fuente, se dice: un dato que viene de otro sitio del
        # habitual es una diferencia que el usuario tiene derecho a ver en pantalla
        payload["aviso"] = "Las velas vienen de " + fuente + ". " + " · ".join(intentos)
    cache_set(clave, payload)
    return jsonify({**payload, "cacheado": False, "edad_s": 0})


@app.route("/fundamentales")
def fundamentales():
    """
    La ficha profunda de un valor: estados financieros por trimestres, deuda, múltiplos contra su
    propio histórico, Morningstar, consenso de analistas y accionariado.  /fundamentales?codigo=US.IREN

    Esta ruta NO llama a OpenD y NO ejecuta nada. La ficha la genera un script del usuario `agente`
    (`fundamental_profundo.py`) y la publica en un directorio neutro; aquí solo se lee y se envuelve.

    Lo único que este puente ESCRIBE en toda su vida es el recado: un fichero vacío en `pedidos/`
    que el vigilante del agente ve en un segundo y atiende. Es una excepción consciente a la regla
    de "solo lectura", acotada a un directorio, con el nombre validado antes de tocar el disco.

    Por qué un directorio neutro y no las fichas del agente: el servicio corre con `ProtectHome=true`
    y no puede entrar en /home ni queriendo. No era una preferencia, era la única opción.

    Los tres estados:
      hay ficha            -> 200 con la ficha TAL CUAL, sin renombrar ni un campo
      hay error de HOY     -> 404 con el motivo que trae dentro
      no hay nada          -> 202 "generando", se deja el recado y la app reintenta a los 45 s
    """
    codigo = request.args.get("codigo", "").strip().upper()
    if not codigo:
        return error("Falta el parámetro 'codigo'. Ejemplo: /fundamentales?codigo=US.IREN")
    ticker = codigo.split(".")[-1]
    # El nombre acaba siendo parte de una ruta de fichero, así que se valida ANTES de tocar el
    # disco y además se le pasa un basename: el patrón ya impide barras, y aun así no se confía.
    if not re.match(r"^[A-Z][A-Z.]{0,5}$", ticker) or ticker != os.path.basename(ticker) or ticker.strip(".") == "":
        return error(f"Código no válido: {codigo}")

    ruta_ficha = os.path.join(FICHAS, f"ficha_{ticker}.json")
    ruta_error = os.path.join(FICHAS, f"error_{ticker}.json")
    ruta_pedido = os.path.join(FICHAS, "pedidos", ticker)

    valor, edad = cache_get("fundamentales:" + ticker, TTL_FUNDAMENTALES)
    if valor is not None:
        return jsonify({**valor, "cacheado": True, "edad_s": round(edad, 1)})

    # ---- 1) ¿hay ficha?
    if os.path.exists(ruta_ficha):
        try:
            with open(ruta_ficha, "r", encoding="utf-8") as f:
                ficha = json.load(f)
        except PermissionError:
            return error(f"La ficha de {ticker} existe pero el puente no puede leerla (permisos). "
                         f"Faltan los comandos de /var/lib/fichas-bloques, o el ReadWritePaths "
                         f"del servicio.", 503)
        except ValueError:
            return error(f"La ficha de {ticker} está corrupta.", 502)
        except OSError as e:
            return error(f"No se pudo leer la ficha de {ticker}: {e}", 503)

        generada = _fecha_de_ficha(ficha, ruta_ficha)
        ahora = datetime.now(timezone.utc)
        # `del_dia` se decide en hora de MADRID, no en UTC: a las 00:30 de Madrid en verano son las
        # 22:30 UTC del día anterior, y la ficha parecería de ayer sin serlo.
        hoy = (ahora.astimezone(MADRID) if MADRID else ahora).date()
        payload = {
            "ok": True, "codigo": codigo, "ticker": ticker,
            "generada": generada.isoformat(),
            "del_dia": generada.astimezone(MADRID).date() == hoy if MADRID else generada.date() == hoy,
            "ficha": ficha,
        }
        payload["edad_s"] = round((ahora - generada).total_seconds(), 1)
        cache_set("fundamentales:" + ticker, payload)
        return jsonify({**payload, "cacheado": False})

    # ---- 2) ¿hay un error de hoy? Uno de ayer no cuenta: se vuelve a intentar.
    if os.path.exists(ruta_error):
        try:
            reciente = (datetime.fromtimestamp(os.path.getmtime(ruta_error), timezone.utc)
                        .astimezone(MADRID if MADRID else timezone.utc).date()
                        == (datetime.now(MADRID) if MADRID else datetime.now(timezone.utc)).date())
        except OSError:
            reciente = False
        if reciente:
            motivo = ""
            try:
                with open(ruta_error, "r", encoding="utf-8") as f:
                    d = json.load(f)
                motivo = str(d.get("motivo") or d.get("error") or d.get("mensaje") or "").strip()
            except Exception:
                motivo = ""
            return error(motivo or f"Hoy no se pudo generar la ficha de {ticker}.", 404)

    # ---- 3) no hay nada: se deja el recado y se dice cuándo volver
    #
    # Antes, un tope. La cola de verdad (5) la lleva el vigilante, que es quien genera; esto es un
    # tope MUY por encima, y su valor está en lo que revela: si los recados se acumulan sin que nadie
    # los borre, el vigilante no está corriendo. Sin esto, ese caso se vive como "generando…" para
    # siempre, que es exactamente el síntoma más difícil de diagnosticar de toda esta ruta.
    try:
        pendientes = len(os.listdir(os.path.dirname(ruta_pedido)))
    except OSError:
        pendientes = 0
    if pendientes >= 20:
        return error(f"Hay {pendientes} recados de fichas sin atender en el servidor. Lo normal es "
                     f"que se borren en segundos, así que probablemente el vigilante de fichas no "
                     f"esté corriendo: revísalo antes de seguir pidiendo.", 503)

    try:
        os.makedirs(os.path.dirname(ruta_pedido), exist_ok=True)
        # 'a' en vez de 'w': si el recado ya está, no se pisa ni se reinicia su hora
        with open(ruta_pedido, "a", encoding="utf-8"):
            pass
    except PermissionError:
        return error(f"No se pudo dejar el recado para generar la ficha de {ticker}: el servicio no "
                     f"puede escribir en {os.path.dirname(ruta_pedido)}. Falta el ReadWritePaths del "
                     f"servicio, o los permisos de la carpeta.", 503)
    except OSError as e:
        return error(f"No se pudo dejar el recado para generar la ficha de {ticker}: {e}", 503)

    # 202: ni éxito ni error — "en ello". La app pinta "generando ficha" y reintenta; lo que NO
    # debe hacer es bloquear la pantalla esperando, que son 20-40 s.
    return jsonify({"ok": False, "estado": "generando", "ticker": ticker,
                    "reintenta_en_s": 45,
                    "aviso": "La ficha se está generando en el servidor. Suele tardar entre 20 y 40 "
                             "segundos; dentro de las franjas de mantenimiento, lo que dure la franja."}), 202


def _fecha_de_ficha(ficha, ruta):
    """
    Cuándo se generó la ficha, siempre con zona horaria.

    El campo se llama `generado` (no `generada`) y viene como "2026-07-26T02:00": sin zona,
    con precisión de minutos y en hora LOCAL DE MADRID. Parsearlo como UTC lo desplaza dos horas
    en verano, y eso convierte una ficha de esta madrugada en una de ayer.
    """
    d = None
    try:
        d = datetime.fromisoformat(str(ficha.get("generado")))
    except (TypeError, ValueError):
        d = None
    if d is not None:
        if d.tzinfo is None:
            d = d.replace(tzinfo=MADRID) if MADRID else d.astimezone()
        return d
    # sin campo utilizable, la fecha del fichero — que sí es inequívoca
    return datetime.fromtimestamp(os.path.getmtime(ruta), timezone.utc)


if __name__ == "__main__":
    print(f"Puente Bloques escuchando en el puerto {PUERTO}")
    print(f"OpenD esperado en {OPEND_HOST}:{OPEND_PORT}")
    print(f"Orígenes permitidos: {', '.join(ORIGENES)}")
    print(f"Caché: precios {TTL_COTIZA}s · cadenas {TTL_CADENA}s · máx {MAX_SUSCRIPCIONES} suscripciones")
    print("Ventanas de root respetadas: " + ", ".join(f"{a[0]:02d}:{a[1]:02d}-{b[0]:02d}:{b[1]:02d}"
                                                      for a, b in VENTANAS_ROOT))
    # host 127.0.0.1: el puente NO se asoma a internet por su cuenta. Quien lo saca fuera
    # (con HTTPS y sin abrir puertos del router) es el túnel de Cloudflare que ya existe.
    app.run(host="127.0.0.1", port=PUERTO, threaded=True)
