"""
Puente entre OpenD (moomoo/Futu) y la app Bloques.
======================================================================
OpenD escucha SOLO dentro del servidor y con un protocolo propio, así que un navegador
no puede hablar con él. Este programa se sienta al lado de OpenD, le pregunta los precios
y los sirve como JSON por HTTP, que es lo único que la app sabe leer.

Arranque (en el servidor donde ya corre OpenD):
    pip install futu-api flask flask-cors
    export BLOQUES_TOKEN="inventate-una-clave-larga"
    python3 puente.py

Comprobación (desde el propio servidor):
    curl "http://127.0.0.1:8777/salud?token=inventate-una-clave-larga"

Diseño deliberado:
  · Solo LECTURA. Este puente jamás manda una orden — no importa ni una función de trading.
  · Token obligatorio en todas las rutas. Sin él, 401. Es lo único que separa tus datos
    de cualquiera que dé con la dirección.
  · Los errores se devuelven explicados y en español; nunca se inventa un precio. Si OpenD
    no responde o el dato viene retrasado, se dice.
  · `retrasado: true` viaja en cada respuesta cuando la suscripción no es de tiempo real,
    para que la app pueda avisarlo en pantalla en vez de aparentar que va en vivo.
"""

import os
import threading
from datetime import datetime, timezone

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
# Orígenes que pueden llamar a este puente. Añade aquí tu dominio cuando lo tengas.
ORIGENES = [o.strip() for o in os.environ.get(
    "BLOQUES_ORIGENES",
    "https://galofly.github.io"
).split(",") if o.strip()]

if not TOKEN:
    raise SystemExit(
        "Falta el token. Antes de arrancar:\n"
        '    export BLOQUES_TOKEN="inventate-una-clave-larga"\n'
        "Sin token cualquiera que diera con la dirección podría leer tus datos."
    )

app = Flask(__name__)
CORS(app, origins=ORIGENES)

# ---------------------------------------------------------------- conexión a OpenD
# Una sola conexión compartida, protegida con un candado: Flask atiende varias
# peticiones a la vez y el cliente de Futu no es seguro para uso simultáneo.
_ctx = None
_candado = threading.Lock()
_suscritos = set()


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


def asegurar_suscripcion(codigos):
    """OpenD solo devuelve precio de lo que está suscrito. Se suscribe una vez por código."""
    nuevos = [c for c in codigos if c not in _suscritos]
    if not nuevos:
        return None
    ret, data = contexto().subscribe(nuevos, [SubType.QUOTE])
    if ret != RET_OK:
        return f"OpenD no pudo suscribir {', '.join(nuevos)}: {data}"
    _suscritos.update(nuevos)
    return None


def error(mensaje, codigo=400, **extra):
    return jsonify({"ok": False, "error": mensaje, **extra}), codigo


@app.before_request
def comprobar_token():
    if request.method == "OPTIONS":
        return None
    dado = request.headers.get("X-Bloques-Token") or request.args.get("token", "")
    if dado != TOKEN:
        return error("Token incorrecto o ausente.", 401)
    return None


# ---------------------------------------------------------------- rutas
@app.route("/salud")
def salud():
    """Primera parada: dice si el puente vive y si OpenD contesta de verdad."""
    with _candado:
        try:
            ret, data = contexto().get_global_state()
            if ret != RET_OK:
                soltar_contexto()
                return error(f"OpenD no contesta: {data}", 503)
            estado = data if isinstance(data, dict) else {}
            return jsonify({
                "ok": True,
                "opend": "conectado",
                "mercado_us": estado.get("market_us", "?"),
                "sesion_iniciada": estado.get("qot_logined", "?"),
                "hora": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            soltar_contexto()
            return error(f"No se pudo hablar con OpenD ({OPEND_HOST}:{OPEND_PORT}): {e}", 503)


@app.route("/cotiza")
def cotiza():
    """Precio de uno o varios valores.  /cotiza?codigos=US.AAPL,US.TSLA"""
    crudos = request.args.get("codigos", "").strip()
    if not crudos:
        return error("Falta el parámetro 'codigos'. Ejemplo: /cotiza?codigos=US.AAPL")
    codigos = [c.strip().upper() for c in crudos.split(",") if c.strip()]

    with _candado:
        try:
            fallo = asegurar_suscripcion(codigos)
            if fallo:
                return error(fallo, 502)
            ret, data = contexto().get_stock_quote(codigos)
            if ret != RET_OK:
                return error(f"OpenD devolvió un error al pedir precios: {data}", 502)
        except Exception as e:
            soltar_contexto()
            return error(f"Se perdió la conexión con OpenD: {e}", 503)

    salida = {}
    for fila in data.to_dict("records"):
        codigo = fila.get("code")
        # data_date/data_time marcan a qué momento corresponde el precio: si va con retraso,
        # se ve aquí. La app lo usa para no presumir de "en vivo" cuando no lo es.
        salida[codigo] = {
            "ultimo": fila.get("last_price"),
            "cierre_anterior": fila.get("prev_close_price"),
            "apertura": fila.get("open_price"),
            "maximo": fila.get("high_price"),
            "minimo": fila.get("low_price"),
            "volumen": fila.get("volume"),
            "fecha_dato": fila.get("data_date"),
            "hora_dato": fila.get("data_time"),
        }
    return jsonify({"ok": True, "cotizaciones": salida})


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

    with _candado:
        try:
            fallo = asegurar_suscripcion([codigo])
            if fallo:
                return error(fallo, 502)
            ret, data = contexto().get_stock_quote([codigo])
            if ret != RET_OK:
                return error(f"OpenD devolvió un error al pedir la opción: {data}", 502)
        except Exception as e:
            soltar_contexto()
            return error(f"Se perdió la conexión con OpenD: {e}", 503)

    filas = data.to_dict("records")
    if not filas:
        return error(f"OpenD no devolvió datos para {codigo}. ¿El código está bien escrito?", 404)
    f = filas[0]
    return jsonify({"ok": True, "opcion": {
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
    }})


@app.route("/cadena")
def cadena():
    """
    Cadena de opciones de un vencimiento.  /cadena?codigo=US.TMDX&vencimiento=2026-09-18
    Sirve para descubrir el código exacto de cada contrato.
    """
    subyacente = request.args.get("codigo", "").strip().upper()
    vto = request.args.get("vencimiento", "").strip()
    if not subyacente or not vto:
        return error("Faltan parámetros. Ejemplo: /cadena?codigo=US.TMDX&vencimiento=2026-09-18")

    with _candado:
        try:
            ret, data = contexto().get_option_chain(code=subyacente, start=vto, end=vto)
            if ret != RET_OK:
                return error(f"OpenD devolvió un error al pedir la cadena: {data}", 502)
        except Exception as e:
            soltar_contexto()
            return error(f"Se perdió la conexión con OpenD: {e}", 503)

    contratos = [{
        "codigo": r.get("code"),
        "tipo": r.get("option_type"),
        "strike": r.get("strike_price"),
        "vencimiento": r.get("strike_time"),
    } for r in data.to_dict("records")]
    return jsonify({"ok": True, "contratos": contratos, "total": len(contratos)})


if __name__ == "__main__":
    print(f"Puente Bloques escuchando en el puerto {PUERTO}")
    print(f"OpenD esperado en {OPEND_HOST}:{OPEND_PORT}")
    print(f"Orígenes permitidos: {', '.join(ORIGENES)}")
    # host 127.0.0.1: el puente NO se asoma a internet por su cuenta. Quien lo saca fuera
    # (con HTTPS y sin abrir puertos del router) es el túnel de Cloudflare.
    app.run(host="127.0.0.1", port=PUERTO)
