"""
Prueba de la ruta /fundamentales (v4.97).

Se puede probar de verdad, sin servidor y sin OpenD, porque la ruta NO llama a OpenD: solo lee
ficheros y deja un recado. Así que se monta un directorio de fichas de mentira y se ejercitan los
cuatro caminos, que son justo donde una ruta como esta se equivoca en silencio:

    hay ficha            -> 200, con la ficha TAL CUAL y su fecha bien interpretada
    hay error de HOY     -> 404 con el motivo de dentro
    hay error de AYER    -> 202: se vuelve a intentar, no se hereda el fracaso de ayer
    no hay nada          -> 202 y el recado creado

Y lo que más importa de todo, porque el puente ESCRIBE un fichero con un nombre que viene de
fuera: que un nombre inventado no pueda salirse de su carpeta.

    python3 pruebas/fundamentales.py
"""
import json
import os
import shutil
import sys
import tempfile
import types
from datetime import datetime, timedelta

# doble de la librería de moomoo: puente.py la importa al cargarse y esta ruta no la usa
falso = types.ModuleType("futu")
falso.OpenQuoteContext = object
falso.RET_OK = 0
falso.SubType = types.SimpleNamespace(QUOTE="QUOTE")
sys.modules.setdefault("futu", falso)

CARPETA = tempfile.mkdtemp(prefix="fichas-prueba-")
os.makedirs(os.path.join(CARPETA, "pedidos"), exist_ok=True)
os.environ["BLOQUES_TOKEN"] = "prueba"
os.environ["BLOQUES_FICHAS"] = CARPETA

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "servidor"))
from puente import app, MADRID  # noqa: E402

cliente = app.test_client()
CAB = {"X-Bloques-Token": "prueba"}
fallos = []


def comprueba(condicion, texto):
    print(("  OK  " if condicion else "  MAL ") + texto)
    if not condicion:
        fallos.append(texto)


def pide(codigo):
    r = cliente.get("/fundamentales?codigo=" + codigo, headers=CAB)
    try:
        return r.status_code, r.get_json()
    except Exception:
        return r.status_code, None


def limpia():
    for f in os.listdir(CARPETA):
        ruta = os.path.join(CARPETA, f)
        if os.path.isfile(ruta):
            os.remove(ruta)
    for f in os.listdir(os.path.join(CARPETA, "pedidos")):
        os.remove(os.path.join(CARPETA, "pedidos", f))
    from puente import _cache
    _cache.clear()   # la ruta cachea una hora; entre casos hay que olvidar


# ---------------------------------------------------------------- 1. no hay nada
print("=== 1. no hay ficha: se deja el recado ===")
limpia()
c, d = pide("US.IREN")
comprueba(c == 202, "contesta 202 —ni éxito ni error, 'en ello'— y no 404 (%s)" % c)
comprueba(d and d.get("estado") == "generando" and d.get("reintenta_en_s") == 45,
          "dice que está generando y cuándo volver: %s" % (d and d.get("reintenta_en_s")))
comprueba(os.path.exists(os.path.join(CARPETA, "pedidos", "IREN")),
          "y el recado queda escrito, que es lo único que este puente escribe en su vida")

print("\n=== 2. pedirla otra vez no reinicia el recado ===")
antes = os.path.getmtime(os.path.join(CARPETA, "pedidos", "IREN"))
os.utime(os.path.join(CARPETA, "pedidos", "IREN"), (antes - 30, antes - 30))
pide("US.IREN")
comprueba(os.path.getmtime(os.path.join(CARPETA, "pedidos", "IREN")) == antes - 30,
          "el recado conserva su hora: reintentar no manda al vigilante a empezar de cero")

# ---------------------------------------------------------------- 3. hay ficha
print("\n=== 3. hay ficha ===")
limpia()
# la fecha viene SIN zona y en hora de Madrid; hace dos horas
hace2h = (datetime.now(MADRID) if MADRID else datetime.now()) - timedelta(hours=2)
FICHA = {"ticker": "IREN", "generado": hace2h.strftime("%Y-%m-%dT%H:%M"), "precio": 146.99,
         "financiero": {"periodos": ["2026/Q3", "2026/Q2"], "revenue": [100, 90],
                        "margen_neto_pct": 10.9},
         "multiplos": {"ev_ebitda": 14.0, "hist_ev_ebitda": {"actual": 14.0, "min": 5.0,
                                                             "max": 22.0, "mediana": 9.0, "n": 20}},
         "valoracion": {"morningstar_fair_value": 120.0, "moat": "Narrow",
                        "dcf_base": 383.17, "dcf_sensibilidad": {"wacc8%_g1%": 383.17}},
         "ownership": {"instit_pct": 61.2, "smart_money_m": 12.4}}
with open(os.path.join(CARPETA, "ficha_IREN.json"), "w", encoding="utf-8") as f:
    json.dump(FICHA, f)
c, d = pide("US.IREN")
comprueba(c == 200, "contesta 200 (%s)" % c)
comprueba(d.get("ficha") == FICHA, "la ficha viaja TAL CUAL, sin renombrar ni un campo")
# ESTA es la prueba de la zona horaria: la fecha va sin zona y en hora de Madrid, así que
# interpretarla como UTC desplazaría la edad justo dos horas en verano.
comprueba(6000 < d.get("edad_s", 0) < 8000,
          "la edad sale de la fecha de DENTRO, leída como hora de Madrid: %.0f s (dos horas son 7.200)"
          % d.get("edad_s", 0))
comprueba("dcf_base" in json.dumps(d.get("ficha")),
          "el puente NO recorta el DCF: quien decide no pintarlo es la app, y así el dato no se pierde")

# del_dia aparte, con la ficha sellada AHORA. Con la de "hace dos horas" no se puede comprobar:
# a la una de la madrugada, hace dos horas es ayer — y entonces del_dia=False es lo CORRECTO.
# (La primera versión de esta prueba lo daba por fallo del código, y el fallo era de la prueba.)
limpia()
ahora_madrid = (datetime.now(MADRID) if MADRID else datetime.now()).strftime("%Y-%m-%dT%H:%M")
with open(os.path.join(CARPETA, "ficha_IREN.json"), "w", encoding="utf-8") as f:
    json.dump({**FICHA, "generado": ahora_madrid}, f)
c, d = pide("US.IREN")
comprueba(d.get("del_dia") is True, "una ficha sellada ahora mismo sale como del día")

print("\n=== 4. una ficha vieja se nota ===")
limpia()
viejo = (datetime.now(MADRID) if MADRID else datetime.now()) - timedelta(days=9)
with open(os.path.join(CARPETA, "ficha_IREN.json"), "w", encoding="utf-8") as f:
    json.dump({**FICHA, "generado": viejo.strftime("%Y-%m-%dT%H:%M")}, f)
c, d = pide("US.IREN")
comprueba(c == 200 and d.get("del_dia") is False, "200 pero del_dia=False: la app puede avisar")
comprueba(d.get("edad_s", 0) > 8 * 86400, "y la edad son nueve días (%.0f d)" % (d.get("edad_s", 0) / 86400))

print("\n=== 5. sin el campo de fecha, la del fichero ===")
limpia()
with open(os.path.join(CARPETA, "ficha_IREN.json"), "w", encoding="utf-8") as f:
    json.dump({"ticker": "IREN"}, f)      # sin 'generado'
c, d = pide("US.IREN")
comprueba(c == 200 and d.get("edad_s", -1) >= 0,
          "no revienta por falta de fecha: usa la del fichero (%.0f s)" % d.get("edad_s", -1))

# ---------------------------------------------------------------- 6. errores
print("\n=== 6. la ficha está corrupta ===")
limpia()
with open(os.path.join(CARPETA, "ficha_IREN.json"), "w", encoding="utf-8") as f:
    f.write("{esto no es json")
c, d = pide("US.IREN")
comprueba(c == 502 and "corrupta" in (d or {}).get("error", ""),
          "502 y lo dice: %s" % (d or {}).get("error"))

print("\n=== 7. error de HOY / error de AYER ===")
limpia()
with open(os.path.join(CARPETA, "error_IREN.json"), "w", encoding="utf-8") as f:
    json.dump({"motivo": "OpenD no da fundamentales de IREN."}, f)
c, d = pide("US.IREN")
comprueba(c == 404 and "OpenD no da fundamentales" in (d or {}).get("error", ""),
          "el de HOY corta con 404 y su motivo: %s" % (d or {}).get("error"))
ayer = datetime.now().timestamp() - 26 * 3600
os.utime(os.path.join(CARPETA, "error_IREN.json"), (ayer, ayer))
from puente import _cache
_cache.clear()
c, d = pide("US.IREN")
comprueba(c == 202,
          "el de AYER no cuenta: se vuelve a intentar en vez de heredar el fracaso de ayer (%s)" % c)

# ---------------------------------------------------------------- 8. el nombre
print("\n=== 8. el nombre, que acaba siendo una ruta de fichero ===")
limpia()
for malo in ["US.../../etc/passwd", "US.TOOLONGNAME", "US.", "US...", "US.A B", "US.A1"]:
    c, d = pide(malo.replace(" ", "%20"))
    comprueba(c == 400, "rechaza %-22s -> %s" % (repr(malo), c))
fuera = os.listdir(os.path.join(CARPETA, "pedidos"))
comprueba(fuera == [], "y no ha creado NI UN fichero con esos nombres: %s" % fuera)
comprueba(not os.path.exists("/tmp/passwd"), "ni nada fuera de su carpeta")

# minúsculas SÍ se aceptan, subidas a mayúsculas: es un ticker escrito con prisa, no un ataque.
limpia()
c, d = pide("us.iren")
comprueba(c == 202 and os.path.exists(os.path.join(CARPETA, "pedidos", "IREN")),
          "y 'us.iren' se acepta como IREN: escribirlo en minúsculas no es un error del usuario")

print("\n=== 8b. si los recados se amontonan, es que el vigilante no corre ===")
limpia()
for i in range(20):
    open(os.path.join(CARPETA, "pedidos", "AAAA%02d" % i), "w").close()
c, d = pide("US.NVDA")
comprueba(c == 503 and "vigilante" in (d or {}).get("error", ""),
          "503 diciendo dónde mirar, en vez de 'generando…' eterno: %s" % (d or {}).get("error", "")[:80])

print("\n=== 9. sin token no se entra ===")
comprueba(cliente.get("/fundamentales?codigo=US.IREN").status_code == 401,
          "401 sin la clave, como todas las rutas")

shutil.rmtree(CARPETA, ignore_errors=True)
print("\nFALLA: " + str(len(fallos)) if fallos else "\nOK")
sys.exit(1 if fallos else 0)
