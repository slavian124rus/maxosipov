#!/usr/bin/env bash
# Деплой на FirstVPS: подтянуть код, пересобрать, дождаться health.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker/compose.yml"
HEALTH_URL="https://app.maxosipov.ru/api/health"

echo "→ git pull --ff-only"
git pull --ff-only

echo "→ сборка образов"
$COMPOSE build

echo "→ запуск контейнеров"
$COMPOSE up -d

echo "→ ждём /api/health до 60 с"
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" | grep -q '"ok":true'; then
    echo "✓ приложение поднялось"
    exit 0
  fi
  sleep 2
done

echo "✗ приложение не ответило за 60 с" >&2
$COMPOSE logs --tail=100 web >&2
exit 1
