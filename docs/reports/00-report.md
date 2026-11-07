# Отчёт: этап 0

Все 72 шага плана `docs/plans/00-foundation.md` отмечены выполненными.

## Сделано — по задачам, с хэшами коммитов

| Задача | Что сделано | Коммиты |
|---|---|---|
| 1. Проект и инструменты качества | `git init` + первый коммит документов; каркас Next.js 16.4.5 (App Router, `src/`, TypeScript strict, Tailwind v4, ESLint) перенесён из временной папки в корень; `.gitignore`, `.editorconfig`, `.prettierrc`, `vitest.config.ts`, `playwright.config.ts`, `tests/smoke.test.ts`; скрипты `lint/test/test:e2e/verify` | `63c45f7` |
| 2. Окружение и БД | `src/shared/env.ts` (Zod, все переменные ARCHITECTURE §17, падение с читаемой ошибкой), `src/shared/db/*`, `drizzle.config.ts`, `docker/compose.dev.yml`, таблица `gyms` + типы `GymBrand/GymSettings/ProgressionRules`, `getGym()`; миграция `drizzle/0000_*.sql` | `683f812` |
| 3. Модули-скелеты | 12 модулей с `index.ts`, `src/modules/README.md`, правило `no-restricted-imports` для `@/modules/*/*` с исключением для `src/shared/db/schema.ts` (проверено: линтер падает на глубоком импорте) | `4da6b5f` |
| 4. Тема, шрифты, UI-кит, маршрутизация | Локальные Oswald/Manrope (`src/shared/fonts/*.woff2`, пакеты `@fontsource` удалены), токены DESIGN §3 в `globals.css` + `@theme`, shadcn/ui (Radix, 9 компонентов) перекрашен на токены (кнопка 48 px, радиус 12, `bg-accent`/`accent-pressed`), `resolveSurface` + `rewriteTarget` (19 тестов), `middleware.ts` (rewrite + 308 с `www`), страницы-заглушки, витрина `/dev/ui` | `f57c3a9` |
| 5. `rbac`, пользователи, сид | `PERMISSIONS` (16 кодов), `check/assertCan/ForbiddenError`, `Actor`, сервис `loadActor/createRole/updateRole/deleteRole/assignRole` с `role_audit`, `DEFAULT_ROLES` (5 ролей), таблицы `users/roles/role_audit`, `scripts/seed.ts` (идемпотентный), `tests/db.ts` | `54aebfb` |
| 6. PWA | `manifest.ts`, иконки (SVG + PNG через `sharp`), Serwist на Turbopack, `sw.ts` (precache + `defaultCache` + офлайн-заглушка для навигаций), `/app/offline`, SW отключён в dev | `8e00a8a` |
| 7. Health, worker, Docker | `checkHealth` с таймаутом, `GET /api/health` (200/503), worker на pg-boss (`heartbeat` раз в 10 минут, корректный `SIGTERM`), `docker/Dockerfile` (multi-stage, ffmpeg), `docker/compose.yml` (`db`/`web`/`worker`/`caddy`), `Caddyfile`; образы собраны и проверены | `316cbe0` |
| 8. Сервер, деплой, бэкапы | `docs/ops/server-setup.md`, `scripts/deploy.sh`, `scripts/backup.sh`, `scripts/restore-check.sh`, `docker/backup.env.example` | `316cbe0` |
| 9. Отчёт этапа | Правило production-сида (`runSeed`, `NODE_ENV=production` без `SEED_*` не создаёт пользователей) + 3 теста; e2e `e2e/smoke.spec.ts` (2 теста); этот отчёт | `51d2768` |

Служебные коммиты: `319749c` (восстановление кодировки плана после неудачной правки, `.gitignore`),
`7cdb597` (удалена неиспользуемая `@serwist/next`), `7cf5a4c` (`docs/ops/development.md`).

## Как проверить — команды и шаги руками (URL, логины тестовых пользователей)

### Подготовка

```bash
docker compose -f docker/compose.dev.yml up -d
cp .env.example .env      # заполнить DATABASE_URL, AUTH_SECRET (openssl rand -base64 48)
docker compose -f docker/compose.dev.yml exec -T db createdb -U app maxosipov_test
pnpm install
pnpm db:migrate
pnpm db:seed
```

`DATABASE_URL=postgres://app:app@localhost:5433/maxosipov` (порт **5433** — см. «Отклонения»).

### Локально

| Что | Как | Ожидание |
|---|---|---|
| Сайт | `pnpm dev` → <http://localhost:3000> | «Максим Осипов», шрифт Oswald |
| Приложение | <http://app.localhost:3000> | «Приложение МаксИИм — скоро» |
| Витрина токенов | <http://app.localhost:3000/dev/ui> | плашки цветов, оба шрифта, кнопки 48 px, карточка, лист снизу |
| Витрина в production | `pnpm build && pnpm start` → та же ссылка | 404 |
| 404 для сайта на `/app/...` | <http://localhost:3000/app/x> | 404 |
| Редирект с `www` | `curl -sI -H 'Host: www.maxosipov.ru' http://localhost:3000/` | `308 → https://maxosipov.ru/` |
| PWA | `pnpm build && pnpm start` → <http://app.localhost:3000>, DevTools → Application | manifest без ошибок, SW активен (`/serwist/sw.js`) |
| Офлайн | там же: Offline + переход на неоткрытый адрес | «Нет сети. Тренировка и подходы сохраняются — отправятся сами, когда появится связь.» |

Скриншоты 375 px: `docs/reports/assets/00-site.png`, `00-app.png`, `00-ui.png`.

### База и сид

```bash
pnpm db:seed && pnpm db:seed          # второй запуск не меняет количество строк
docker compose -f docker/compose.dev.yml exec -T db \
  psql -U app -d maxosipov -c 'select (select count(*) from users) u, (select count(*) from roles) r, (select count(*) from gyms) g'
```

Ожидание: `u = 7`, `r = 5`, `g = 1`.

Тестовые пользователи (dev-сид, `docs/plans/README.md`): владелец `+79990000001`,
Максим (главный тренер) `+79990000002`, клиенты `+79990000011…15`.
Вход по СМС появится на этапе 1 — сейчас пользователи существуют только в БД.

### Docker и health

```bash
docker compose -f docker/compose.yml build
docker compose -f docker/compose.yml up -d
curl -s -H 'Host: app.maxosipov.ru' http://localhost:3000/api/health   # {"ok":true,"db":"up"}

docker compose -f docker/compose.yml stop db
curl -s -w ' %{http_code}' -H 'Host: app.maxosipov.ru' http://localhost:3000/api/health
# {"ok":false,"db":"down"} 503 примерно через 2 секунды, без зависания

docker compose -f docker/compose.yml start db
```

### Продакшн-сид

```bash
NODE_ENV=production pnpm db:seed   # без SEED_OWNER_PHONE/SEED_TRAINER_PHONE пользователей не создаёт
```

## Результаты: pnpm lint / pnpm test / pnpm test:e2e — вывод последних строк

```
$ pnpm verify
$ eslint . && tsc --noEmit        → ошибок нет
 Test Files  7 passed (7)
      Tests  40 passed (40)
```

```
$ pnpm test:e2e
Running 2 tests using 1 worker
  ok 1 [mobile] › e2e\smoke.spec.ts:3:1 › приложение на app.localhost показывает заглушку (722ms)
  ok 2 [mobile] › e2e\smoke.spec.ts:8:1 › лендинг на localhost показывает имя тренера (378ms)
  2 passed (7.0s)
```

```
$ pnpm build
 ✓ Compiled successfully
 Route (app): / , /_not-found , /app , /app/dev/ui , /app/offline , /manifest.webmanifest , /serwist/[path]
```

Docker: `maxosipov-web:latest` и `maxosipov-worker:latest` — **487 МБ** каждый
(full `node_modules` в образ не копируется: `migrate` и `worker` собраны esbuild в `dist/`).

## Отклонения от плана — что и почему

1. **Временная папка каркаса — `scaffold`, а не `_scaffold`.** `create-next-app` отклоняет
   имена, начинающиеся с `_` (ограничения npm). Папка удалена после переноса в корень.
2. **PostgreSQL в dev опубликован на 5433, а не на 5432.** На этой машине порт 5432 занят
   локальной службой PostgreSQL: соединения шли в неё, а не в контейнер. Порт 5433 указан
   в `.env`, `.env.example` и `docs/ops/development.md`.
3. **Serwist подключён через `@serwist/turbopack`, а не `@serwist/next`.** Next 16 собирает
   Turbopack'ом по умолчанию, а `@serwist/next` работает только с webpack. Официальная
   инструкция Serwist для Turbopack: `withSerwist` в `next.config`, route handler
   `src/app/serwist/[path]/route.ts`, `SerwistProvider` в layout. Следствие: service worker
   живёт по адресу **`/serwist/sw.js`** (не `/sw.js`), регистрация отключена вне production
   (`disable={process.env.NODE_ENV !== 'production'}`). Неиспользуемый `@serwist/next` удалён.
4. **Офлайн-заглушка — своя стратегия, а не `fallbacks`.** В Serwist 9.5.13 `fallbacks.entries`
   создаёт плагин, но его `handlerDidError` не вызывается (проверено навигацией при
   `matcher: () => true` — запрос всё равно падал). Сделан класс `PagesWithOfflineFallback`
   (сеть → кэш → precache `/app/offline`) на `request.mode === 'navigate'`. Проверено
   в Chromium: офлайн-переход на неоткрытый адрес отдаёт 200 и текст офлайн-страницы.
5. **`navigationPreload` отключён.** С ним падение сети при навигации не доходило до
   обработчика, и заглушка не показывалась.
6. **pg-boss 12: `createQueue` + `schedule` + `work`.** План упоминал `schedule`/`work`;
   в 12-й версии очередь нужно создать заранее. Сверено с README и `.d.ts` установленной
   версии. Остановка — `boss.stop({ graceful: true, timeout })` по `SIGINT`/`SIGTERM`.
7. **`migrate` и `worker` в образе — esbuild-бандлы** (`dist/migrate.js`, `dist/worker.js`)
   вместо `tsx` и полного `node_modules`. Образ 487 МБ вместо ~1.2 ГБ; `tsx` в рантайме
   не нужен. Команды: `node dist/migrate.js && node server.js` (web), `node dist/worker.js` (worker).
8. **`users.role_id → roles.id` добавлен в миграцию вручную.** Drizzle не может объявить
   ссылку между схемами разных модулей, не нарушив границу импортов (`auth/schema.ts`
   не вправе импортировать `rbac/schema.ts`). Строка дописана в `drizzle/0001_*.sql`.
   **При генерации миграции с нуля связь нужно добавить заново.**
9. **`output: 'standalone'` добавлен в `next.config.ts`** — требование задачи 7.
10. **`scripts/seed.ts` разделён на `runSeed(options)` + CLI-вход** (`require.main === module`),
    чтобы протестировать правило production-сида без запуска процесса (задача 9).
11. **`pnpm-workspace.yaml`: включены `allowBuilds`** для `esbuild`, `sharp`, `@swc/core`,
    `unrs-resolver`. pnpm 12 иначе прерывает установку с `ERR_PNPM_IGNORED_BUILDS`
    (и локально, и в Docker). Это же изменение сделало `sharp` рабочим.
12. **Лишние зависимости.** Удалены неиспользуемые `@serwist/next`; `shadcn` перенесён
    в devDependencies (это генератор компонентов, а не рантайм). Добавлен только `esbuild`
    (dev) — он нужен и Serwist-Turbopack, и сборке бандлов в образе.
13. **Иконки PWA** нарисованы контурами в SVG (`<path>` для «М», круг для «О», красная
    линия), без `<text>` — растеризация шрифта в SVG не гарантируется; план это допускает.
14. **Имя файла `middleware.ts` оставлено как в плане**, хотя Next 16 предупреждает
    о переименовании в `proxy.ts` — см. «Вопросы».
15. **`app/logout` и прочие маршруты этапа 1 не создавались** — этап 0 в них не нуждается.

## Вопросы и риски

1. **`middleware.ts` → `proxy.ts`.** Next 16.4.5 предупреждает: `The "middleware" file convention
   is deprecated. Please use "proxy" instead`. Нужно решение владельца: переименовать
   (и поправить ARCHITECTURE §4 и планы) либо зафиксировать текущую мажорную версию Next.
2. **`fallbacks` в Serwist 9.5.13 не работает** (плагин подключается, но не вызывается).
   Возможно, исправлено в 10.x — тогда нашу стратегию можно упростить. Перепроверить
   при обновлении.
3. **Сервер, домены и бэкапы вживую не проверены**: у исполнителя нет SSH и продакшн-`.env`.
   `docs/ops/server-setup.md` написан так, чтобы владелец выполнил шаги и получил
   `https://app.maxosipov.ru/api/health` → `{"ok":true,"db":"up"}`. `deploy.sh`, `backup.sh`
   и `restore-check.sh` на сервере ещё не запускались — это задача владельца.
4. **`docker/compose.yml` публикует `web` на `127.0.0.1:3000`** для отладки. На сервере это
   loopback, но если не нужно — убрать публикацию порта.
5. **`POSTGRES_PASSWORD`** подставляется в `DATABASE_URL` контейнеров из `.env`, но в
   `.env.example` этой переменной нет — стоит добавить при следующем обновлении документации.
6. **`NODE_ENV=test` переключает `db` на `TEST_DATABASE_URL`.** Vitest выставляет его сам;
   ручной запуск `scripts/seed.ts` с `NODE_ENV=test` пойдёт в тестовую базу — не путать.
7. **Не покрыто автотестами:** `middleware.ts`, route `/api/health`, манифест, офлайн-режим.
   Проверены руками (curl, Chromium). Под тестами: `checkHealth`, `resolveSurface`,
   `rewriteTarget`, `rbac` (check + сервис), сид.
8. **`/data` и медиа.** В `.gitignore`; тома `/data/media` монтируются в `worker` и `caddy`.
   На машине исполнителя `/data` не создавался (Docker Desktop) — проверка шла без медиа.
9. **Таймаут health = 2000 мс.** Для продакшна с медленной базой значения достаточно,
   но при холодном старте контейнера время ответа ≈ 2.2 с — учтено в `deploy.sh` (60 с).
10. **`drizzle/0001_*.sql` правился вручную** — при пересоздании миграций проверить
    наличие `users_role_id_roles_id_fk` (см. отклонение 8).

## Версии установленных пакетов (из package.json)

Среда: Node.js **22.18.0**, pnpm **12.18.0**, Docker **29.2.1**, Next.js **16.4.5**.

Зависимости:

```
class-variance-authority ^0.7.1
cn                       ^0.5.2
drizzle-orm              ^0.45.4
lucide-react             ^1.70.0
next                     16.4.5
next-themes              ^0.4.6
pg-boss                  ^12.38.1
postgres                 ^4.1.0
radix-ui                 ^1.8.1
react                    19.3.0
react-dom                19.3.0
serwist                  ^9.5.13
sonner                   ^2.0.8
tw-animate-css           ^1.4.0
zod                      ^4.6.7
```

Dev-зависимости:

```
@playwright/test         ^1.65.0
@serwist/turbopack       ^9.5.13
@tailwindcss/turbopack   ^4
@types/node              ^20
@types/react             ^19
@types/react-dom         ^19
@vitest/coverage-v8      ^5.1.0
dotenv                   ^18.0.9
drizzle-kit              ^0.31.11
esbuild                  ^0.28.2
eslint                   ^9
eslint-config-next       16.4.5
eslint-config-prettier   ^10.1.8
prettier                 ^3.9.10
shadcn                   ^4.23.0
sharp                    ^0.35.5
tailwindcss              ^4
tsx                      ^4.23.15
typescript               ^5
vitest                   ^5.1.0
```

Фактически установлено (см. `pnpm-lock.yaml`): tailwindcss 4.3.4, typescript 5.9.3,
eslint 9.39.5, sharp 0.35.5, pg-boss 12.38.1, serwist 9.5.13, drizzle-orm 0.45.4,
zod 4.6.7, postgres 4.1.0, radix-ui 1.8.1, sonner 2.0.8, next-themes 0.4.6.

---

**Стоп — жду ревью.** Этап 1 не начинаю.
