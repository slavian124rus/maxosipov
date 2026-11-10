# Локальная разработка

## Всё через Docker (рекомендуется)

Одна команда поднимает базу, сайт с приложением и воркер. Нужен только Docker Desktop:

```bash
pnpm docker:up        # то же: docker compose -f docker/compose.local.yml up --build
```

Первый запуск долгий (образ с ffmpeg и MediaPipe, установка зависимостей, миграции и сид).
Когда в логах появится `Ready` от `web`, открывай:

- сайт: `http://localhost:3000`
- приложение, кабинет тренера, админка: `http://app.localhost:3000`
- СМС-код для входа (`SMS_PROVIDER=console`) печатается в логах: `docker compose -f docker/compose.local.yml logs -f web`

Режим разработки: папка проекта смонтирована в контейнеры, правки видны сразу.
`node_modules` и `.next` лежат в томах Docker (версии из Windows в Linux не работают).
После изменения воркера: `docker compose -f docker/compose.local.yml restart worker`.

| Что сделать | Команда (добавь `-f docker/compose.local.yml` после `docker compose`) |
|---|---|
| остановить | `pnpm docker:down` |
| тесты | `docker compose -f docker/compose.local.yml run --rm web pnpm test` |
| сбросить всё (база, медиа, зависимости) | `docker compose -f docker/compose.local.yml down -v` |
| зайти в БД | порт `localhost:5433`, пользователь `app`, пароль `app`, база `maxosipov` |

Ограничения: service worker, офлайн и push работают только в продакшн-сборке
(`pnpm build && pnpm start` на хосте или `docker/compose.yml` на сервере); в режиме разработки
их нет. Порты 3000 и 5433 должны быть свободны (старую БД из `compose.dev.yml` останови:
`docker compose -f docker/compose.dev.yml down`).

## Без Docker для приложения (только база в Docker)

## База данных

```bash
docker compose -f docker/compose.dev.yml up -d
```

Контейнер публикует PostgreSQL на **5433**, а не на 5432: на машинах разработчиков
порт 5432 часто занят локальным PostgreSQL. В `.env`:

```
DATABASE_URL=postgres://app:app@localhost:5433/maxosipov
TEST_DATABASE_URL=postgres://app:app@localhost:5433/maxosipov_test
```

Тестовая база создаётся один раз:

```bash
docker compose -f docker/compose.dev.yml exec -T db createdb -U app maxosipov_test
```

Тесты (`pnpm test`) сами прогоняют миграции по `TEST_DATABASE_URL` и чистят таблицы
перед каждым тестом сервисов.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | сайт на `http://localhost:3000`, приложение на `http://app.localhost:3000` |
| `pnpm build` / `pnpm start` | продакшн-сборка (нужна для проверки service worker) |
| `pnpm worker` | фоновые задачи (pg-boss) |
| `pnpm verify` | `eslint` + `tsc --noEmit` + `vitest run` |
| `pnpm test:e2e` | Playwright, вьюпорт 375×812 |
| `pnpm db:generate` / `db:migrate` / `db:seed` | миграции и сид |

Витрина UI: `http://app.localhost:3000/dev/ui` (в production отдаёт 404).

## Известные особенности

- `pnpm-workspace.yaml` содержит `allowBuilds` — pnpm 12 иначе блокирует установку
  пакетов со скриптами сборки (`esbuild`, `sharp`, `@swc/core`, `unrs-resolver`).
- Разделение сайта и приложения по `Host` — в `src/proxy.ts` (конвенция Next 16, бывший `middleware.ts`).

- Логи и разовые файлы исполнителя — в папку `tmp/` (в git не попадает), а не в корень проекта.
