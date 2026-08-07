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

# ¿Está OpenD escuchando donde creemos?
ss -lntp | grep 11111

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

## Lo que falta después de esto

1. **El túnel de Cloudflare**, para que el iPhone llegue hasta aquí desde fuera de casa. El dato que
   pide Cloudflare es `http://127.0.0.1:8777`.
2. **Ajustes → Servidor propio** en la app: dirección, clave y botón de probar conexión.
3. **Cloudflare Access** delante, para que esa dirección solo la abras tú.
