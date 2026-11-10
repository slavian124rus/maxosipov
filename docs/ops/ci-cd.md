# CI/CD: GitHub Actions → сервер

Workflow: `.github/workflows/ci-cd.yml`.

| Событие | Что происходит |
|---|---|
| Pull request | `check`: `pnpm lint` (ESLint + tsc), `pnpm test` (Vitest + Postgres-сервис), `pnpm build` |
| Push в `main` | `check` → `image` (сборка `docker/Dockerfile`, публикация в `ghcr.io/slavian124rus/maxosipov:<sha>` и `:latest`) → `deploy` |

Deploy по SSH (пользователь `deploy`) копирует `docker/compose.prod.yml` и `Caddyfile` в `/opt/maxosipov/docker/`,
затем запускает `scripts/remote-deploy.sh`: `docker login ghcr.io` (временный токен), `compose pull`, `compose up -d`,
ожидание `/api/health` до 120 с. Если приложение не поднялось — автоматический откат на прошлый образ.
Миграции БД применяет контейнер `web` при старте (`node dist/migrate.js`).

Образ собирается в CI, а не на сервере: сборка (ffmpeg, mediapipe, Next.js) тяжёлая для VPS с 2 vCPU / 4 ГБ.

## Секреты GitHub

Settings → Secrets and variables → Actions → New repository secret:

| Имя | Значение |
|---|---|
| `SSH_PRIVATE_KEY` | приватный ключ пользователя `deploy` на сервере (ed25519, целиком, с `BEGIN/END`) |

Адрес сервера, пользователь и публичный host key прописаны в workflow (это не секреты).
Остальные секреты приложения лежат только на сервере в `/opt/maxosipov/.env` (права 600) и в репозиторий не попадают.

## Первичная настройка сервера (один раз)

```bash
ssh-keygen -t ed25519 -N '' -C github-actions-deploy -f deploy_key
# на сервере от root:
DEPLOY_PUBKEY="$(cat deploy_key.pub)" bash scripts/server-bootstrap.sh
```

Скрипт ставит Docker, создаёт пользователя `deploy`, включает ufw (22/80/443), fail2ban, swap 2 ГБ и каталоги
`/opt/maxosipov`, `/data/{postgres,media,backups}`. Затем создать `/opt/maxosipov/.env` по `.env.example`
(`APP_URL=https://app.maxosipov.ru`, `SITE_URL=https://maxosipov.ru`, `MEDIA_ROOT=/data/media`, `POSTGRES_PASSWORD`,
`AUTH_SECRET`, `MEDIA_URL_SIGNING_SECRET` и ключи сервисов). Приватный ключ `deploy_key` — в секрет `SSH_PRIVATE_KEY`.

## Ручной деплой / откат

```bash
ssh deploy@62.109.0.116
cd /opt/maxosipov
echo 'IMAGE=ghcr.io/slavian124rus/maxosipov:<sha>' > .deploy.env   # нужный коммит
docker compose --env-file .env --env-file .deploy.env -f docker/compose.prod.yml up -d
```

(перед этим `docker login ghcr.io`, если образа нет на сервере). Старый способ со сборкой на сервере
(`scripts/deploy.sh`, `docker/compose.yml`) остаётся как запасной вариант для машин с достаточными ресурсами.

## Что не входит в CI

`pnpm test:e2e` (Playwright), `pnpm test:media` (ffmpeg/opencv) и `pnpm test:ai` — тяжёлые, запускаются вручную
перед релизом, как описано в `docs/ops/development.md`.
