# Локальная разработка

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
