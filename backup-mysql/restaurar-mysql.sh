#!/bin/bash
# Restaura un backup creado por backup-mysql.sh.
# Uso:  ./restaurar-mysql.sh <fichero.sql.gz> [base_destino]
#
# Antes de restaurar crea una copia de seguridad de la base actual,
# por lo que una restauración errónea también es reversible.
set -euo pipefail

FICHERO="${1:-}"
BASE="${2:-}"

if [[ -z "$FICHERO" || ! -f "$FICHERO" ]]; then
  echo "Uso: $0 <fichero.sql.gz> [base_destino]"
  echo "Ejemplo: $0 /opt/backups-mysql/mensual/escandallos_db_2026-11-01_0400.sql.gz"
  echo ""
  echo "Backups disponibles:"
  ls -1ht /opt/backups-mysql/*/*.sql.gz 2>/dev/null | head -20 || echo "  (ninguno)"
  exit 1
fi

# La base por defecto es la del nombre del fichero: escandallos_db_FECHA_HORA.sql.gz
if [[ -z "$BASE" ]]; then
  BASE="$(basename "$FICHERO")"
  BASE="${BASE%%_20*}"        # quita _2026-11-01_0400.sql.gz
fi

# Restaurar necesita permisos de administración (crear base, importar):
# credenciales de root en /root/.my-restaurar.cnf (ver LEEME.md)
ADMIN_FILE="/root/.my-restaurar.cnf"
if [[ ! -f "$ADMIN_FILE" ]]; then
  echo "Falta $ADMIN_FILE (credenciales de administración para restaurar)."
  echo "Crea ese fichero con user=root y la contraseña de root — ver LEEME.md."
  exit 1
fi

echo "Fichero : $FICHERO"
echo "Tamaño  : $(du -h "$FICHERO" | cut -f1)"
echo "Base    : $BASE"
echo ""
echo "ATENCIÓN: se SOBRESCRIBIRÁ el contenido actual de la base '$BASE'."
read -r -p "Escribe la base ('${BASE}') para confirmar: " CONFIRM
if [[ "$CONFIRM" != "$BASE" ]]; then
  echo "Confirmación incorrecta. Nada se ha tocado."
  exit 1
fi

MYSQL="mysql --defaults-file=$ADMIN_FILE"

# 1. Copia de seguridad previa (por si acaso)
PREVIA="/opt/backups-mysql/pre-restauracion/${BASE}_$(date +%F_%H%M).sql.gz"
mkdir -p "$(dirname "$PREVIA")"
chmod 700 "$(dirname "$PREVIA")"
echo "[1/4] Copia de seguridad previa → $PREVIA"
mysqldump --defaults-file="$ADMIN_FILE" --single-transaction --routines --triggers --events \
  "$BASE" 2>/dev/null | gzip > "$PREVIA" \
  || echo "  (Aviso: no se pudo volcar la base actual — ¿no existe todavía?)"
chmod 600 "$PREVIA" 2>/dev/null || true

# 2. Crear la base si no existe
echo "[2/4] Asegurando que la base '$BASE' existe..."
$MYSQL -e "CREATE DATABASE IF NOT EXISTS \`$BASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Importar el backup
echo "[3/4] Importando backup (puede tardar)..."
zcat "$FICHERO" | $MYSQL "$BASE"

# 4. Verificación
echo "[4/4] Verificación:"
$MYSQL -e "USE \`$BASE\`; SHOW TABLES;" | head -40
FILAS=$($MYSQL -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$BASE';")
echo ""
echo "Restauración completada. Tablas en '$BASE': $FILAS"
echo "Si algo no va bien puedes volver a la copia previa:"
echo "  $0 $PREVIA"
