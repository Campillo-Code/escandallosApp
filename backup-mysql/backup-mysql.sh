#!/bin/bash
# Backup de MySQL con rotación semanal y mensual.
# Uso:  ./backup-mysql.sh semanal   (cron: domingo 03:00)
#       ./backup-mysql.sh mensual   (cron: día 1 a las 04:00)
set -euo pipefail

# ================= CONFIGURACIÓN =================
# Bases de datos a respaldar (ver las existentes: mysql -e "SHOW DATABASES")
BASES=("escandallos_db")

# Carpeta de destino (creada con permisos restringidos)
DIR="/opt/backups-mysql"

# Cuántas copias se conservan (las antiguas se borran automáticamente)
RET_SEMANAL=8    # 8 semanales ≈ 2 meses
RET_MENSUAL=12   # 12 mensuales = 1 año

# Credenciales: se leen de ~/.my.cnf del usuario que ejecuta el cron
# (ver LEEME.md — nunca poner la contraseña en este script)
DUMP="mysqldump --defaults-file=$HOME/.my.cnf --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4"
# ==================================================

TIPO="${1:-}"
if [[ "$TIPO" != "semanal" && "$TIPO" != "mensual" ]]; then
  echo "Uso: $0 semanal|mensual"
  exit 1
fi

DESTINO="$DIR/$TIPO"
mkdir -p "$DESTINO"
chmod 700 "$DIR" "$DESTINO"
FECHA="$(date +%F)"
HORA="$(date +%H%M)"
FALLOS=0

LOG() { echo "[$(date '+%F %T')] $*"; }

LOG "=== Inicio backup $TIPO ==="
for db in "${BASES[@]}"; do
  FICHERO="$DESTINO/${db}_${FECHA}_${HORA}.sql.gz"
  LOG "Volcando $db → $FICHERO"
  if $DUMP "$db" | gzip > "$FICHERO"; then
    gzip -t "$FICHERO"                      # comprueba integridad
    chmod 600 "$FICHERO"
    TAMANO="$(du -h "$FICHERO" | cut -f1)"
    LOG "  OK ($TAMANO)"
  else
    LOG "  ERROR al volcar $db"
    rm -f "$FICHERO"
    FALLOS=$((FALLOS + 1))
  fi
done

# Rotación: conservar solo las N más recientes
if [[ "$TIPO" == "semanal" ]]; then
  ls -1t "$DESTINO"/*.sql.gz 2>/dev/null | tail -n +$((RET_SEMANAL + 1)) | xargs -r rm -f || true
else
  ls -1t "$DESTINO"/*.sql.gz 2>/dev/null | tail -n +$((RET_MENSUAL + 1)) | xargs -r rm -f || true
fi

LOG "Copias disponibles en $DESTINO: $(ls -1 "$DESTINO"/*.sql.gz 2>/dev/null | wc -l)"
LOG "=== Fin (fallos: $FALLOS) ==="
exit "$FALLOS"
