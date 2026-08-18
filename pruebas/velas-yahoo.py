"""
Prueba del parseo de las velas de Yahoo (v4.94).

Por qué existe: la ruta /velas es la única del puente que no habla con OpenD sino con internet, y
no se puede comprobar desde donde se escribe el código. Lo que SÍ se puede comprobar es la parte
que se escribe a mano — convertir la respuesta de Yahoo en velas — y ahí está el fallo probable:
Yahoo manda HUECOS (días con null en todo, cierres sueltos sin máximo ni mínimo, listas más cortas
que la de fechas). Un parseo descuidado convierte eso en velas con precio 0, y una vela a 0 arrastra
las medias y los soportes de toda la pantalla sin dar la cara.

    python3 pruebas/velas-yahoo.py

No necesita ni OpenD ni la librería de moomoo: se sustituye por un doble, porque lo que se prueba
es una función que no la usa.
"""
import json
import os
import sys
import types

# doble de la librería de moomoo: puente.py la importa al cargarse y aquí no hace falta de verdad
falso = types.ModuleType("futu")
falso.OpenQuoteContext = object
falso.RET_OK = 0
falso.SubType = types.SimpleNamespace(QUOTE="QUOTE")
sys.modules.setdefault("futu", falso)
os.environ.setdefault("BLOQUES_TOKEN", "prueba")

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "servidor"))
from puente import velas_de_yahoo  # noqa: E402

fallos = []


def comprueba(condicion, texto):
    print(("  OK  " if condicion else "  MAL ") + texto)
    if not condicion:
        fallos.append(texto)


# ---- respuesta de Yahoo tal y como llega, con los huecos que manda de verdad ----
# 1755000000 = 12-ago-2026, 1755086400 = 13-ago... y así hasta cinco días.
DIA = 86400
T0 = 1755000000
CRUDO = {"chart": {"result": [{
    "meta": {"symbol": "MRVL", "regularMarketPrice": 78.4},
    "timestamp": [T0, T0 + DIA, T0 + 2 * DIA, T0 + 3 * DIA, T0 + 4 * DIA],
    "indicators": {"quote": [{
        "open":   [70.0, 71.0, None, 74.0, 77.5],
        "high":   [72.0, 73.5, None, 76.0, 79.0],
        "low":    [69.5, 70.5, None, 73.0, 77.0],
        # el tercer día es un hueco entero; el cuarto trae cierre pero le falta el volumen
        "close":  [71.5, 73.0, None, 75.5, 78.4],
        "volume": [1000000, 1200000, None, None, 900000],
    }]},
}], "error": None}}

print("=== velas normales, con un hueco en medio ===")
v = velas_de_yahoo(CRUDO)
comprueba(isinstance(v, list) and len(v) == 4, "de 5 fechas salen 4 velas: el día sin cierre se descarta (%s)" % (len(v) if v else v))
comprueba(all(x["c"] is not None and x["c"] > 0 for x in v), "ninguna vela sale con cierre nulo o a cero")
comprueba([x["c"] for x in v] == [71.5, 73.0, 75.5, 78.4], "los cierres llegan en orden y sin tocar")
comprueba(v[2]["v"] is None, "un volumen que falta se queda en 'no hay', NO en 0 (eso sería un dato inventado)")
comprueba(v[0]["f"] < v[-1]["f"] and len(v[0]["f"]) == 10, "las fechas van en AAAA-MM-DD y de más vieja a más nueva")

print("\n=== símbolo que no existe ===")
comprueba(velas_de_yahoo({"chart": {"result": None, "error": {"code": "Not Found",
                                                              "description": "No data found"}}}) is None,
          "devuelve None (no una lista vacía): la app dice 'no conozco ese ticker', que es otra cosa")

print("\n=== respuesta rara: fechas sin la lista de precios ===")
v2 = velas_de_yahoo({"chart": {"result": [{"timestamp": [T0, T0 + DIA], "indicators": {"quote": [{}]}}]}})
comprueba(v2 == [], "sale lista vacía y la ruta contesta 'no devolvió ninguna vela', sin reventar")

print("\n=== listas más cortas que la de fechas ===")
v3 = velas_de_yahoo({"chart": {"result": [{"timestamp": [T0, T0 + DIA, T0 + 2 * DIA],
                                           "indicators": {"quote": [{"close": [10.0, 11.0]}]}}]}})
comprueba(len(v3) == 2, "no se inventa la vela que falta al final (%d)" % len(v3))

print("\n=== nan, que en JSON llega como 'NaN' ===")
v4 = velas_de_yahoo(json.loads('{"chart":{"result":[{"timestamp":[%d],"indicators":{"quote":[{"close":[NaN]}]}}]}}' % T0))
comprueba(v4 == [], "un NaN se trata como hueco, no como número")

print("\nFALLA: " + str(len(fallos)) if fallos else "\nOK")
sys.exit(1 if fallos else 0)
