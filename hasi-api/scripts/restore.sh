#!/bin/sh
# Usage (on the host, in the project folder): ./scripts/restore.sh backups/hasi_YYYYMMDDTHHMMSSZ.dump
set -eu
[ $# -eq 1 ] && [ -f "$1" ] || { echo "usage: $0 <file.dump>"; exit 1; }
. ./.env
printf "This will REPLACE database %s. Type RESTORE to continue: " "$POSTGRES_DB"; read ans
[ "$ans" = "RESTORE" ] || exit 1
docker compose stop api
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < "$1"
docker compose start api
echo "restore finished"
