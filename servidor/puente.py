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

import os
import threading
import time
from datetime import datetime, timezone

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

# Presupuesto de suscripciones de ESTE puente. El cupo real es de la cuenta y se comparte;
# aquí nos limitamos a un trozo pequeño y devolvemos lo que no se usa.
MAX_SUSCRIPCIONES = int(os.environ.get("BLOQUES_MAX_SUBS", "60"))
CADUCA_SUSCRIPCION = int(os.environ.get("BLOQUES_SUB_TTL", "900"))  # 15 min sin pedirse → se suelta

# Ritmo: (llamadas, segundos). La mitad de lo que documenta Futu, para dejar hueco a root.
RITMO = {
    "quote": (30, 30.0),   # get_stock_quote — el límite de snapshot es 60/30 s
    "chain": (5, 30.0),    # get_option_chain — el límite es 10/30 s
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
    """OpenD solo devuelve precio de lo que está suscrito. Se suscribe una vez por código."""
    ahora = time.monotonic()
    nuevos = [c for c in codigos if c not in _suscritos]
    for c in codigos:
        if c in _suscritos:
            _suscritos[c] = ahora  # renueva: lo que se usa, no se suelta
    if not nuevos:
        return None
    if len(_suscritos) + len(nuevos) > MAX_SUSCRIPCIONES:
        _liberar_suscripciones(len(nuevos))
    ret, data = contexto().subscribe(nuevos, [SubType.QUOTE])
    if ret != RET_OK:
        return f"OpenD no pudo suscribir {', '.join(nuevos)}: {data}"
    for c in nuevos:
        _suscritos[c] = ahora
    return None


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
        fallo = asegurar_suscripcion(codigos)
        if fallo:
            return {"ok": False, "error": fallo}, 502
        ret, data = contexto().get_stock_quote(codigos)
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
        return {"ok": True, "cotizaciones": salida}, 200

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
        fallo = asegurar_suscripcion([codigo])
        if fallo:
            return {"ok": False, "error": fallo}, 502
        ret, data = contexto().get_stock_quote([codigo])
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir la opción: {data}"}, 502
        filas = data.to_dict("records")
        if not filas:
            return {"ok": False, "error": f"OpenD no devolvió datos para {codigo}. "
                                          f"¿El código está bien escrito?"}, 404
        f = filas[0]
        return {"ok": True, "opcion": {
            "codigo": codigo,
            "ultimo": f.get("last_price"),
            "cierre_anterior": f.get("prev_close_price"),
            "volumen": f.get("volume"),
            "interes_abierto": f.get("option_open_interest"),
            "iv": f.get("option_implied_volatility"),
            "delta": f.get("option_delta"),
            "theta": f.get("option_theta"),
            "fecha_dato": f.get("data_date"),
            "hora_dato": f.get("data_time"),
        }}, 200

    payload, http = con_cache("opcion:" + codigo, TTL_OPCION, "quote", traer)
    return jsonify(payload), http


@app.route("/cadena")
def cadena():
    """
    Cadena de opciones de un vencimiento.  /cadena?codigo=US.TMDX&vencimiento=2026-09-18
    Sirve para descubrir el código exacto de cada contrato.

    Se cachea 6 horas a propósito: la LISTA de contratos de un vencimiento no cambia
    durante la sesión, y `get_option_chain` solo admite 10 llamadas cada 30 s para toda
    la cuenta — compartidas con root. Los precios de esos contratos se piden con /opcion,
    que sí es fresco.
    """
    subyacente = request.args.get("codigo", "").strip().upper()
    vto = request.args.get("vencimiento", "").strip()
    if not subyacente or not vto:
        return error("Faltan parámetros. Ejemplo: /cadena?codigo=US.TMDX&vencimiento=2026-09-18")

    def traer():
        ret, data = contexto().get_option_chain(code=subyacente, start=vto, end=vto)
        if ret != RET_OK:
            return {"ok": False, "error": f"OpenD devolvió un error al pedir la cadena: {data}"}, 502
        contratos = [{
            "codigo": r.get("code"),
            "tipo": r.get("option_type"),
            "strike": r.get("strike_price"),
            "vencimiento": r.get("strike_time"),
        } for r in data.to_dict("records")]
        return {"ok": True, "contratos": contratos, "total": len(contratos)}, 200

    payload, http = con_cache(f"cadena:{subyacente}:{vto}", TTL_CADENA, "chain", traer)
    return jsonify(payload), http


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
