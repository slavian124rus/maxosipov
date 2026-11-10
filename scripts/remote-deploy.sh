#!/usr/bin/env bash
# Выполняется НА СЕРВЕРЕ (пользователь deploy) из GitHub Actions: ssh deploy@host 'bash -s' < scripts/remote-deploy.sh
# Ожидает переменные окружения (CI кладёт их в начало stdin): IMAGE, GHCR_USER, GHCR_TOKEN.
# Тянет образ из GHCR, перезапускает стек, ждёт /api/health, при провале откатывается на прошлый образ.
set -euo pipefail

: "${IMAGE:?IMAGE не задан}"
: "${GHCR_USER:?GHCR_USER не задан}"
: "${GHCR_TOKEN:?GHCR_TOKEN не задан}"

cd /opt/maxosipov
[ -f .env ] || { echo "✗ нет /opt/maxosipov/.env — создай его по docs/ops/ci-cd.md" >&2; exit 1; }

COMPOSE="docker compose --env-file .env --env-file .deploy.env -f docker/compose.prod.yml"
PREV_IMAGE="$(sed -n 's/^IMAGE=//p' .deploy.env 2>/dev/null || true)"

echo "→ вход в GHCR"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

echo "→ тянем $IMAGE"
printf 'IMAGE=%s\n' "$IMAGE" > .deploy.env
$COMPOSE pull

echo "→ запуск контейнеров"
$COMPOSE up -d --remove-orphans

echo "→ ждём /api/health до 120 с"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"ok":true'; then
    echo "✓ приложение поднялось"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "✗ приложение не ответило за 120 с" >&2
$COMPOSE logs --tail=100 web >&2 || true

if [ -n "$PREV_IMAGE" ] && [ "$PREV_IMAGE" != "$IMAGE" ]; then
  echo "↩ откат на $PREV_IMAGE" >&2
  printf 'IMAGE=%s\n' "$PREV_IMAGE" > .deploy.env
  $COMPOSE up -d --remove-orphans || true
fi
exit 1
