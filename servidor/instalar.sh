#!/usr/bin/env bash
# =============================================================================
# Instalador del puente Bloques  ·  para Ubuntu / Debian (un VPS de Hetzner vale)
#
# Deja el puente (servidor/puente.py) instalado y arrancado como servicio del
# sistema, de forma que sobreviva a reinicios y se levante solo si se cae.
#
# Se ejecuta así, desde el servidor donde YA corre OpenD:
#
#     curl -fsSL https://raw.githubusercontent.com/GaloFly/galowillmakeyourich/main/servidor/instalar.sh | sudo bash
#
# Se puede volver a ejecutar las veces que haga falta: no duplica nada y NO
# regenera la clave si ya existe (así no se queda desparejada de la del móvil).
# =============================================================================
set -euo pipefail

DESTINO="/opt/bloques"
ENTORNO="/etc/bloques/entorno"
SERVICIO="bloques-puente"
USUARIO="bloques"
FUENTE="https://raw.githubusercontent.com/GaloFly/galowillmakeyourich/main/servidor/puente.py"

decir() { printf '\n\033[1m› %s\033[0m\n' "$*"; }
fallo() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fallo "Hay que ejecutarlo con sudo:  curl -fsSL <la dirección> | sudo bash"

# ---------------------------------------------------------------- 1. dependencias
decir "Instalando lo que hace falta (python y poco más)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 python3-venv curl >/dev/null

# ---------------------------------------------------------------- 2. usuario propio
# El puente corre con su propio usuario, sin permisos de administrador: si
# alguien lograra colarse por ahí, no manda en la máquina.
if ! id -u "$USUARIO" >/dev/null 2>&1; then
  useradd --system --home-dir "$DESTINO" --shell /usr/sbin/nologin "$USUARIO"
fi

# ---------------------------------------------------------------- 3. el programa
decir "Descargando el puente…"
mkdir -p "$DESTINO"
curl -fsSL "$FUENTE" -o "$DESTINO/puente.py" || fallo "No se pudo descargar el puente desde GitHub."

decir "Preparando el entorno de Python (esto tarda un par de minutos)…"
[ -d "$DESTINO/.venv" ] || python3 -m venv "$DESTINO/.venv"
"$DESTINO/.venv/bin/pip" install --quiet --upgrade pip
if ! "$DESTINO/.venv/bin/pip" install --quiet futu-api flask flask-cors; then
  decir "Faltaban herramientas de compilación; instalándolas y reintentando…"
  apt-get install -y -qq build-essential python3-dev >/dev/null
  "$DESTINO/.venv/bin/pip" install --quiet futu-api flask flask-cors \
    || fallo "No se pudieron instalar las librerías de Python. Mándame lo que salga arriba."
fi
chown -R "$USUARIO:$USUARIO" "$DESTINO"

# ---------------------------------------------------------------- 4. la clave
# Se genera UNA vez y se guarda con permisos de solo-lectura para root. Si el
# fichero ya existe se respeta tal cual: volver a lanzar el instalador no te
# cambia la clave por debajo (te dejaría el móvil sin conexión sin avisar).
mkdir -p "$(dirname "$ENTORNO")"
if [ ! -f "$ENTORNO" ]; then
  decir "Generando tu clave…"
  cat > "$ENTORNO" <<EOF
# Clave del puente. Se pega TAL CUAL en la app: Ajustes → Servidor propio.
# No la mandes por chat ni la pegues en ningún sitio más.
BLOQUES_TOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

# Puerto en el que escucha el puente dentro del servidor. No se toca.
BLOQUES_PUERTO=8777

# Dónde está OpenD. Si corre en esta misma máquina, así está bien.
OPEND_HOST=127.0.0.1
OPEND_PORT=11111

# Direcciones desde las que se permite llamar al puente. Cuando tengas tu
# dominio propio para la app, se añade aquí separado por comas.
BLOQUES_ORIGENES=https://galofly.github.io
EOF
  chmod 600 "$ENTORNO"
else
  decir "Ya había una clave guardada — se respeta, no se toca."
fi

# ---------------------------------------------------------------- 5. el servicio
decir "Registrando el puente como servicio del sistema…"
cat > "/etc/systemd/system/$SERVICIO.service" <<EOF
[Unit]
Description=Puente Bloques (OpenD -> app)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$DESTINO
EnvironmentFile=$ENTORNO
ExecStart=$DESTINO/.venv/bin/python3 $DESTINO/puente.py
Restart=always
RestartSec=5
# Cinturones: el puente no necesita ser administrador ni ver /home.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
RestrictAddressFamilies=AF_INET AF_INET6
MemoryMax=256M
# ProtectSystem=strict deja TODO el disco en solo lectura. La librería de moomoo escribe su
# propio registro, así que sin un sitio donde hacerlo el servicio se cae al arrancar. systemd
# crea y da permisos a /var/lib/bloques, y HOME apunta ahí para que escriba dentro.
StateDirectory=bloques
Environment=HOME=/var/lib/bloques

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --quiet "$SERVICIO"
systemctl restart "$SERVICIO"

# ---------------------------------------------------------------- 6. comprobación
decir "Comprobando que responde…"
sleep 4
CLAVE=$(grep '^BLOQUES_TOKEN=' "$ENTORNO" | cut -d= -f2)
PUERTO=$(grep '^BLOQUES_PUERTO=' "$ENTORNO" | cut -d= -f2)

if ! systemctl is-active --quiet "$SERVICIO"; then
  echo
  echo "El servicio no ha arrancado. Esto es lo que dice:"
  journalctl -u "$SERVICIO" -n 30 --no-pager || true
  fallo "Mándame esas líneas de arriba y lo miramos."
fi

RESPUESTA=$(curl -s --max-time 10 "http://127.0.0.1:$PUERTO/salud?token=$CLAVE" || true)

echo
echo "======================================================================"
if echo "$RESPUESTA" | grep -q '"ok": *true'; then
  echo "✅  EL PUENTE FUNCIONA Y OPEND CONTESTA."
elif [ -n "$RESPUESTA" ]; then
  echo "⚠️   El puente está vivo, pero OpenD no contesta bien. Ha dicho:"
  echo "     $RESPUESTA"
  echo
  echo "     Lo más habitual es que OpenD no esté arrancado o escuche en otro"
  echo "     sitio. Compruébalo con:   ss -lntp | grep 11111"
else
  echo "⚠️   El puente no ha contestado. Mira qué dice con:"
  echo "         journalctl -u $SERVICIO -n 30 --no-pager"
fi
echo "======================================================================"
echo
echo "TU CLAVE (cópiala y guárdala; se pega en el iPhone, en"
echo "Ajustes → Servidor propio. No la mandes por chat):"
echo
echo "    $CLAVE"
echo
echo "Para volver a verla más adelante:   sudo grep TOKEN $ENTORNO"
echo
echo "SIGUIENTE PASO: en esta máquina el túnel de Cloudflare YA EXISTE y corre como root."
echo "NO crees uno nuevo ni reinstales cloudflared — un segundo conector pelearía con el"
echo "que ya hay y puede tirar abajo lo de root. Solo hay que añadir una ruta en el panel:"
echo
echo "    Zero Trust → Networks → Tunnels → (el túnel existente) → Public Hostname → Add"
echo "    subdominio: puente   ·   tipo: HTTP   ·   URL: 127.0.0.1:$PUERTO"
echo
