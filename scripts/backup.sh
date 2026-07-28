#!/usr/bin/env bash
# SubTrack: ежедневный бэкап PostgreSQL (pg_dump), хранение 30 дней (SPEC §2).
# Установка cron (root):
#   0 3 * * *  /opt/subtrack/scripts/backup.sh >> /var/log/subtrack-backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/subtrack}"
BACKUP_DIR="${BACKUP_DIR:-/root/subtrack-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DATE="$(date +%F)"

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

# Дамп базы (внутри контейнера postgres).
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U subtrack subtrack | gzip > "$BACKUP_DIR/subtrack-db-$DATE.sql.gz"

# Ротация: удаляем дампы старше KEEP_DAYS.
find "$BACKUP_DIR" -name 'subtrack-db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) backup complete: subtrack-db-$DATE.sql.gz"
