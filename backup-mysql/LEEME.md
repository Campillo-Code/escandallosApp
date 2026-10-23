# Backups de la base de datos (VPS IONOS)

Sistema de backups automáticos de MySQL con:
- **Copia semanal** (domingos 03:00) — se conservan las últimas 8
- **Copia mensual** (día 1, 04:00) — se conservan los últimos 12
- **Restauración fácil** con copia de seguridad previa automática

## Instalación paso a paso (en el VPS)

### 1. Copiar los scripts al VPS

Desde tu ordenador:

```bash
scp backup-mysql/backup-mysql.sh backup-mysql/restaurar-mysql.sh root@212.227.39.147:/root/
```

### 2. Crear el usuario de MySQL para backups (en el VPS)

```bash
mysql -e "CREATE USER 'backup'@'localhost' IDENTIFIED BY 'Tomillo_92';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT ON *.* TO 'backup'@'localhost';
FLUSH PRIVILEGES;"
```

Guarda la contraseña — la necesitarás en el paso 3.

### 3. Credenciales sin contraseña en los scripts (en el VPS)

Crea `/root/.my.cnf` (los scripts de volcado leen de aquí, nunca guardan la contraseña en el script):

```bash
cat > /root/.my.cnf <<'EOF'
[client]
user=backup
password=PON_AQUI_PASSWORD_LARGA
EOF
chmod 600 /root/.my.cnf
```

Y `/root/.my-restaurar.cnf` con el usuario **root** (solo lo usa el script de
restauración, que necesita permisos de creación e importación):

```bash
cat > /root/.my-restaurar.cnf <<'EOF'
[client]
user=root
password=PON_AQUI_PASSWORD_DE_ROOT
EOF
chmod 600 /root/.my-restaurar.cnf
```

### 4. Preparar carpetas y permisos (en el VPS)

```bash
mkdir -p /opt/backups-mysql
chmod 700 /opt/backups-mysql
mv /root/backup-mysql.sh /root/restaurar-mysql.sh /opt/backups-mysql/
chmod +x /opt/backups-mysql/*.sh
```

Si tu base se llama distinto de `escandallos_db`, edita la línea `BASES=(...)`
del script. Para ver las bases existentes: `mysql -e "SHOW DATABASES"`.

### 5. Programar las copias con cron (en el VPS)

```bash
crontab -e
```

Añade estas dos líneas:

```cron
0 3 * * 0  /opt/backups-mysql/backup-mysql.sh semanal  >> /opt/backups-mysql/backup.log 2>&1
0 4 1 * *  /opt/backups-mysql/backup-mysql.sh mensual  >> /opt/backups-mysql/backup.log 2>&1
```

### 6. Probar la primera copia (en el VPS)

```bash
/opt/backups-mysql/backup-mysql.sh semanal
cat /opt/backups-mysql/backup.log
ls -lh /opt/backups-mysql/semanal/
```

Debes ver el fichero `.sql.gz` con un tamaño razonable y el `OK` en el log.

### 7. Probar una restauración (en el VPS)

Nunca esperes a necesitarlo. Prueba restaurando sobre una base de prueba.
Los comandos administrativos usan el fichero de root del paso 3:

```bash
# Crear base de prueba vacía (como root)
mysql --defaults-file=/root/.my-restaurar.cnf -e "CREATE DATABASE prueba_restore;"

# Restaurar el backup recién creado SOBRE la base de prueba
/opt/backups-mysql/restaurar-mysql.sh /opt/backups-mysql/semanal/escandallos_db_XXXX-XX-XX_XXXX.sql.gz prueba_restore

# Comprobar que las tablas están
mysql --defaults-file=/root/.my-restaurar.cnf -e "SHOW TABLES FROM prueba_restore;"

# Borrar la base de prueba
mysql --defaults-file=/root/.my-restaurar.cnf -e "DROP DATABASE prueba_restore;"
```

Para una restauración real (vuelve a poner la app con la BD antigua):

```bash
# 1. Cierra la app en los PC
# 2. En el VPS:
/opt/backups-mysql/restaurar-mysql.sh /opt/backups-mysql/mensual/escandallos_db_2026-11-01_0400.sql.gz
```

La restauración pide confirmación y crea antes una copia de la base actual
en `/opt/backups-mysql/pre-restauracion/`, así que siempre puedes volver atrás.

## MUY IMPORTANTE: copia fuera del VPS

Un backup que solo vive en el VPS **no protege contra la pérdida del VPS**
(fallo del proveedor, cuenta bloqueada, etc.). Ten al menos una copia fuera:

**Opción A — Arrastre automático a tu ordenador (gratis)**
En tu PC (el que tiene esta carpeta del proyecto), crea `~/backups-vps/` y un
cron que descargue las copias cada día:

```bash
mkdir -p ~/backups-vps && chmod 700 ~/backups-vps
crontab -e
```

```cron
30 4 * * *  mkdir -p ~/backups-vps && scp -q root@212.227.39.147:'/opt/backups-mysql/semanal/*.sql.gz /opt/backups-mysql/mensual/*.sql.gz' ~/backups-vps/ && find ~/backups-vps -name '*.sql.gz' -mtime +75 -delete
```

**Opción B — IONOS Object Storage (desde el panel de IONOS)**
IONOS ofrece almacenamiento S3-compatible (~0,012 €/GB/mes). Con `rclone`
configurado en el VPS, añade al final de `backup-mysql.sh`:

```bash
rclone copy --progress "$DESTINO" ionos:escandallos-backups/"$TIPO"
```

**Opción C — Copias IONOS del propio VPS (panel de IONOS)**
IONOS vende backups/snapshots del VPS como extra de pago. Sirven como red de
seguridad del servidor, pero NO sustituyen a las copias de la base: son más
difíciles de restaurar a nivel de tabla.

## Revisar que funciona

Cada cierto tiempo (cada mes):

```bash
tail -20 /opt/backups-mysql/backup.log     # ¿sin errores?
ls -lh /opt/backups-mysql/semanal/ /opt/backups-mysql/mensual/
```

El log también avisa si alguna copia falla (línea `ERROR` y código de salida
distinto de 0).
