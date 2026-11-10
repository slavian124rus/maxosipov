#!/usr/bin/env bash
# Ночной бэкап: дамп базы + медиа в S3-совместимое хранилище через restic.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker/compose.yml"
BACKUP_DIR="/data/backups"
STAMP="$(date +%F)"
DUMP="$BACKUP_DIR/db-$STAMP.sql.gz"

set -a
# shellcheck disable=SC1091
source docker/backup.env
set +a

mkdir -p "$BACKUP_DIR"

echo "→ pg_dump → $DUMP"
$COMPOSE exec -T db pg_dump -U app -d maxosipov | gzip > "$DUMP"

echo "→ restic backup"
restic backup "$BACKUP_DIR" /data/media

echo "→ restic forget --keep-daily 14 --keep-weekly 8"
restic forget --keep-daily 14 --keep-weekly 8 --prune

echo "→ удаляем локальные дампы старше 3 дней"
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +3 -delete

echo "✓ бэкап готов"
