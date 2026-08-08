# El puente: OpenD → app Bloques

OpenD (moomoo/Futu) habla un idioma propio y solo escucha dentro del servidor, así que un navegador
no puede preguntarle nada. El **puente** (`puente.py`) se sienta a su lado, le pregunta los precios y
los sirve de una forma que la app sí sabe leer.

**Qué da:** precio de acciones, precio de un contrato de opciones concreto (con IV, delta, theta e
interés abierto) y la cadena de opciones de un vencimiento.

**Decisiones de diseño, a propósito:**

- **Solo lectura.** No importa ni una función de trading. Este programa no puede mandar una orden
  aunque quisiera.
- **Clave obligatoria** en todas las rutas. Sin ella, 401. Es lo único que separa tus datos de
  cualquiera que dé con la dirección.
- **No se asoma a internet por su cuenta**: escucha solo en `127.0.0.1`. Quien lo saca fuera es el
  túnel de Cloudflare, con https y sin abrir ni un puerto del router.
- **Nunca se inventa un precio.** Si OpenD no responde o el dato viene con retraso, lo dice — y la
  app lo enseña en pantalla, para que nadie crea que va en vivo cuando no.
- **Tus posiciones no salen del móvil.** El puente contesta precios; no recibe ni guarda tu cartera.

---

## La máquina es compartida — esto manda sobre todo lo demás

En este VPS hay **una sola** instancia de OpenD (`127.0.0.1:11111`) y la usan a la vez el sistema de
earnings de `root` y el de venta de puts de `agente`. **Los límites de la API de Futu son por
CUENTA, no por proceso**: todo lo que gaste este puente se lo quita a los otros dos, en silencio.

De ahí cuatro reglas que gobiernan el código:

| Regla | Cómo se cumple |
|---|---|
| **Caché siempre** | Precios 20 s · cadenas de opciones **6 h** (la lista de contratos de un vencimiento no cambia durante la sesión, y `get_option_chain` solo admite 10 llamadas/30 s para toda la cuenta). |
| **Ritmo conservador** | Se usa **la mitad** del límite documentado. El resto es margen para root y el agente, que estaban aquí antes. Si toca esperar, se espera; no se rechaza. |
| **Las suscripciones se devuelven** | El cupo de suscripciones también es de la cuenta. Máximo 60 a la vez; lo que lleva 15 min sin pedirse se suelta. Lo que se sigue usando no se toca. |
| **Las ventanas de root son sagradas** | Entre **15:29-15:46** y **21:30-21:35** (Madrid) root captura. En esas franjas el puente sirve de caché o dice que no, pero **no llama a OpenD**. |

Además, y esto no es negociable: **el 11111 no se expone nunca por el túnel**. OpenD es la puerta a
la cuenta de trading y no tiene autenticación pensada para internet.

Si algún otro sistema de la máquina necesita datos de opciones, que **se los pida a este puente**.
El cliente de Futu no es seguro para uso simultáneo: tiene que haber una sola puerta con candado.

---

## Instalación (Ubuntu / Debian — un VPS de Hetzner vale)

Desde el servidor donde **ya corre OpenD**, un solo comando:

```bash
curl -fsSL https://raw.githubusercontent.com/GaloFly/galowillmakeyourich/main/servidor/instalar.sh | sudo bash
```

Hace todo: instala lo que falta, crea un usuario propio sin permisos de administrador, genera tu
clave, registra el puente como servicio del sistema (arranca solo al reiniciar y se levanta solo si
se cae) y comprueba que OpenD contesta.

Al final imprime **tu clave**. Cópiala: es lo que se pega en el iPhone.

Se puede volver a ejecutar las veces que haga falta. No duplica nada y **no** regenera la clave si ya
existe — si la cambiara por debajo, te dejaría el móvil sin conexión sin avisar.

---

## Comprobaciones

```bash
# ¿Está vivo el puente?
systemctl status bloques-puente

# ¿Qué ha dicho últimamente?
journalctl -u bloques-puente -n 30 --no-pager

# ¿Está OpenD escuchando donde creemos?  (ojo: es de root, NO se reinicia ni se mata)
ss -lntp | grep 11111

# ¿Cuántas suscripciones tiene pilladas el puente ahora mismo?
curl -s "http://127.0.0.1:8777/salud?token=TUCLAVE" | python3 -c "import json,sys; print(json.load(sys.stdin))"
# (en esta máquina no hay jq instalado — de ahí el python3)

# Ver tu clave otra vez
sudo grep TOKEN /etc/bloques/entorno

# Probar de verdad (sustituye TUCLAVE)
curl "http://127.0.0.1:8777/salud?token=TUCLAVE"
```

Después de tocar `/etc/bloques/entorno`, hay que reiniciar el puente para que lo lea:

```bash
sudo systemctl restart bloques-puente
```

---

## Cuando tengas dominio propio para la app

En `/etc/bloques/entorno`, añade tu dominio a la lista de direcciones permitidas, separado por comas:

```
BLOQUES_ORIGENES=https://galofly.github.io,https://app.tudominio.com
```

Y reinicia el puente.

---

## Sacarlo fuera: el túnel de Cloudflare YA EXISTE

En esta máquina `cloudflared` ya corre como root, arrancado en el boot, configurado **desde el panel
de Cloudflare** (no hay `config.yml` en el disco).

**No crees un túnel nuevo ni reinstales `cloudflared`.** Un segundo conector con otro token pelearía
con el que hay. Y ese túnel no es un experimento: hoy sirve **Super Calculator en producción**
(`agent.supercalcapp.com` → `127.0.0.1:8788`). Tocarlo mal tira una app que está en uso.

Añadir un Public Hostname es **aditivo y en caliente**: no reinicia el conector, no toca las rutas
existentes y no hace falta entrar en el servidor. La configuración vive en el panel, no en disco.

**Condición previa:** `alphavext.com` tiene que estar en la **misma cuenta de Cloudflare** que el
túnel. Si al desplegar el selector de dominio no aparece, es que el dominio está en otra cuenta —
y entonces hay que moverlo antes, no crear un túnel aparte.

Lo único que hay que hacer es añadir una ruta en el panel:

> Zero Trust → Networks → Tunnels → *(el túnel existente)* → **Public Hostname** → Add
> · subdominio `puente` · dominio `alphavext.com` · tipo **HTTP** · URL `127.0.0.1:8777`

El subdominio `alertas` está tomado por `puente-alertas` (puerto 8779), que es otro servicio. Cada
uno con el suyo.

## Lo que falta después de esto

1. **Ajustes → Servidor propio** en la app: dirección, clave y botón de probar conexión. *(Hecho en
   la v4.43.)*
2. **Cloudflare Access** delante, para que esa dirección solo la abras tú.
