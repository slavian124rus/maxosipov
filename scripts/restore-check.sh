#!/usr/bin/env bash
# Ежемесячная проверка: восстанавливаем последний дамп во временный контейнер.
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="/data/backups"
LATEST="$(ls -1t "$BACKUP_DIR"/db-*.sql.gz | head -n 1)"
CONTAINER="maxosipov-restore-check-$$"

if [ -z "$LATEST" ]; then
  echo "✗ нет дампов в $BACKUP_DIR" >&2
  exit 1
fi

echo "→ восстанавливаем $LATEST во временный контейнер"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=restore \
  -e POSTGRES_DB=maxosipov \
  postgres:17-alpine > /dev/null
trap 'docker rm -f "$CONTAINER" > /dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U app -d maxosipov > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

gunzip -c "$LATEST" | docker exec -i "$CONTAINER" psql -U app -d maxosipov > /dev/null

COUNT="$(docker exec "$CONTAINER" psql -U app -d maxosipov -tAc 'select count(*) from users')"
echo "✓ восстановление прошло, пользователей в дампе: $COUNT"
