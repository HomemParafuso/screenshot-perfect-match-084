#!/bin/sh
# Runs inside the "backup" container. Writes compressed custom-format dumps to /backups.
set -eu
TS=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/backups/hasi_${TS}.dump"
pg_dump -Fc -f "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
echo "[backup] wrote $FILE"
find /backups -name 'hasi_*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
