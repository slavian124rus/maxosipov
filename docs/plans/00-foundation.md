# Этап 0. Фундамент — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.

**Цель:** пустое, но «правильное» приложение: Next.js + PostgreSQL + тема + роли/права + PWA-оболочка, развёрнуто на FirstVPS по HTTPS на `maxosipov.ru` и `app.maxosipov.ru`, с ночными бэкапами.

**Архитектура:** один Next.js-проект, разделение сайта и приложения по `Host` в `middleware.ts`; модули в `src/modules/*` с публичным `index.ts`; Drizzle + PostgreSQL; Docker Compose (`web`, `worker`, `db`, `caddy`).

**Стек:** Next.js (App Router), TypeScript strict, pnpm, Tailwind CSS, shadcn/ui, Drizzle ORM + drizzle-kit + `postgres` (postgres.js), Zod, pg-boss, Serwist, Vitest, Playwright, Docker, Caddy, restic.

**Спека:** `ARCHITECTURE.md` §3–§8.3, §12, §17, §18; `DESIGN.md` §2–§5.

## Global Constraints

- Node.js 22 LTS, pnpm 9+. Все версии пакетов — актуальные стабильные на момент установки; записать их в отчёт.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- Импорт из чужого модуля — только `@/modules/<name>` (его `index.ts`). Глубокий импорт `@/modules/<name>/<file>` из другого модуля запрещён линтером.
- Таблицы — `snake_case`, первичные ключи `uuid` (`defaultRandom()`), у всех `created_at`/`updated_at` (`timestamp with time zone`, default now).
- Часовой пояс зала: `Asia/Krasnoyarsk`. В БД всё хранится в UTC.
- Тема только тёмная; цвета и шрифты — ровно из `DESIGN.md` §3–§4. Шрифты локальные, без Google Fonts.
- Сайт: `maxosipov.ru` (+ `www.` → редирект на без `www`). Приложение: `app.maxosipov.ru`. Локально: `localhost:3000` и `app.localhost:3000`.
- Папки `Видео для примера как заниматься/`, `ФОТО ЗАЛА/` — не трогать, добавить в `.gitignore`.

## Review Focus

1. `Host` с портом, в верхнем регистре или с `www.` — должен корректно определять сайт/приложение (тест в задаче 4).
2. Приложение стартует без обязательной переменной окружения — должно падать сразу с понятным сообщением, а не в рантайме (тест в задаче 2).
3. Роль «Владелец» нельзя удалить, переименовать, урезать права и нельзя снять с последнего владельца (тесты в задаче 5).
4. Миграции на пустой базе и повторный запуск сида — идемпотентны (проверка в задаче 5, шаг «сид дважды»).
5. Падение `db` — `/api/health` отвечает 503, а не висит (тест в задаче 7).

---

### Задача 1. Создать проект и инструменты качества

**Files:**
- Create: весь каркас Next.js в корне репозитория, `.gitignore`, `.prettierrc`, `.editorconfig`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `tests/smoke.test.ts`
- Modify: `package.json` (скрипты), `tsconfig.json`

**Interfaces:**
- Produces: скрипты `pnpm dev | build | start | lint | test | test:e2e | verify`; алиас импорта `@/*` → `src/*`.

- [x] **Шаг 1.** В корне: `git init`, ветка `main`. Первый коммит — только существующие `CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`, `docs/`, `prototypes/`.
- [x] **Шаг 2.** Каркас создать во временной папке (корень не пустой): `pnpm create next-app@latest _scaffold` — сначала посмотри `--help` и выбери: TypeScript, ESLint, Tailwind, `src/` dir, App Router, import alias `@/*`, pnpm. Перенеси содержимое `_scaffold` в корень (кроме `.git`), удали `_scaffold`, выполни `pnpm install`.
- [x] **Шаг 3.** `.gitignore`: добавь `.env`, `.env.*` (кроме `.env.example`), `/data`, `/Видео для примера как заниматься/`, `/ФОТО ЗАЛА/`, `/playwright-report`, `/test-results`.
- [x] **Шаг 4.** `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`.
- [x] **Шаг 5.** Установи dev-зависимости: `vitest @vitest/coverage-v8 @playwright/test prettier eslint-config-prettier`. `pnpm exec playwright install chromium`.
- [x] **Шаг 6.** `vitest.config.ts`: окружение `node`, include `src/**/*.test.ts`, `tests/**/*.test.ts`; алиас `@` → `./src`.
- [x] **Шаг 7.** `playwright.config.ts`: `testDir: 'e2e'`, один проект `mobile` с `viewport: {width: 375, height: 812}`, `isMobile: true`, `hasTouch: true`; `webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true }`.
- [x] **Шаг 8.** Скрипты в `package.json`:
  ```json
  "lint": "eslint . && tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "verify": "pnpm lint && pnpm test"
  ```
- [x] **Шаг 9.** Тест `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)` — проверка, что Vitest работает. `pnpm verify` → зелёный.
- [x] **Шаг 10.** Коммит: `chore: scaffold next.js project with tooling`.

### Задача 2. Переменные окружения и подключение к БД

**Files:**
- Create: `src/shared/env.ts`, `src/shared/env.test.ts`, `src/shared/db/index.ts`, `src/shared/db/schema.ts`, `drizzle.config.ts`, `docker/compose.dev.yml`, `.env.example`, `src/modules/gym/schema.ts`, `src/modules/gym/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env` и `env: Env` из `@/shared/env`; `db` (Drizzle, postgres.js) из `@/shared/db`; таблица `gyms` и тип `Gym` из `@/modules/gym`.

- [x] **Шаг 1.** Установи: `drizzle-orm postgres zod`; dev: `drizzle-kit tsx dotenv`.
- [x] **Шаг 2.** `docker/compose.dev.yml`: сервис `db` — `postgres:17-alpine`, порт `5432:5432`, `POSTGRES_DB=maxosipov`, `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`, том `pgdata`. Запусти `docker compose -f docker/compose.dev.yml up -d`.
- [x] **Шаг 3.** Напиши падающий тест `src/shared/env.test.ts`:
  ```ts
  import { parseEnv } from './env'
  test('throws a readable error when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ AUTH_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/)
  })
  test('accepts minimal valid env', () => {
    const e = parseEnv({ DATABASE_URL: 'postgres://a:b@localhost:5432/c', AUTH_SECRET: 'x'.repeat(32) })
    expect(e.APP_URL).toBe('http://app.localhost:3000')
    expect(e.SITE_URL).toBe('http://localhost:3000')
  })
  ```
- [x] **Шаг 4.** `pnpm test src/shared/env.test.ts` → FAIL (нет модуля).
- [x] **Шаг 5.** `src/shared/env.ts`: Zod-схема всех переменных из `ARCHITECTURE.md` §17. Обязательные сейчас: `DATABASE_URL` (url), `AUTH_SECRET` (min 32). `APP_URL` default `http://app.localhost:3000`, `SITE_URL` default `http://localhost:3000`, `NODE_ENV` default `development`. Остальные — `optional()` (их сделают обязательными этапы, которые их используют). `parseEnv` при ошибке бросает `Error` с перечнем имён невалидных переменных. `export const env = parseEnv(process.env)`.
- [x] **Шаг 6.** Тест → PASS.
- [x] **Шаг 7.** `.env.example` — все переменные §17 с пустыми значениями; локальный `.env` с `DATABASE_URL=postgres://app:app@localhost:5432/maxosipov` и случайным `AUTH_SECRET` (`openssl rand -base64 48`).
- [x] **Шаг 8.** `src/modules/gym/schema.ts` — таблица `gyms` по `ARCHITECTURE.md` §7: `id`, `name` text not null, `address` text not null, `timezone` text not null default `'Asia/Krasnoyarsk'`, `brand` jsonb not null, `settings` jsonb not null, timestamps. Типы `GymBrand = { name: string; shortName: string; colors: { accent: string }; logoUrl: string | null }`, `GymSettings = { trialDays: number; subscriptionPriceRub: number | null; aiDailyLimit: number; progressionRules: ProgressionRules; aiMemo: string }`, где `ProgressionRules = { sessionsToIncrease: number; fastTrackOnEasy: boolean; failSessionsToDrop: number; dropPercent: number }` (объяви его здесь, в `gym/schema.ts`; позже его импортирует `progression`). Типизируй jsonb через `.$type<>()`.
- [x] **Шаг 9.** `src/shared/db/schema.ts` реэкспортирует схемы модулей (`export * from '@/modules/gym/schema'`) — это единственный файл, которому разрешён прямой импорт `schema.ts` модулей. `src/shared/db/index.ts`: `postgres(env.DATABASE_URL)` + `drizzle(client, { schema })`.
- [x] **Шаг 10.** `drizzle.config.ts`: `schema: './src/shared/db/schema.ts'`, `out: './drizzle'`, dialect `postgresql`. Скрипты: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:seed": "tsx scripts/seed.ts"`.
- [x] **Шаг 11.** `pnpm db:generate && pnpm db:migrate` → в БД есть таблица `gyms` (проверь `docker compose -f docker/compose.dev.yml exec db psql -U app -d maxosipov -c '\dt'`).
- [x] **Шаг 12.** `src/modules/gym/index.ts` экспортирует `gyms`, типы и `getGym(): Promise<Gym>` (первый зал; если нет — бросить `Error('Gym not seeded')`).
- [x] **Шаг 13.** `pnpm verify` → зелёный. Коммит: `feat(db): env validation, drizzle, gyms table`.

### Задача 3. Модули-скелеты и граница импортов

**Files:**
- Create: `src/modules/{auth,rbac,access,catalog,media,training,progression,coach-ai,trainer,notifications,body,landing}/index.ts` (пустой `export {}`), `src/modules/README.md`
- Modify: `eslint.config.*`

**Interfaces:**
- Produces: правило линтера, запрещающее глубокие импорты модулей.

- [x] **Шаг 1.** Создай папки и `index.ts` для всех модулей из `ARCHITECTURE.md` §6. `src/modules/README.md` — одна фраза: «Каждый модуль отдаёт наружу только `index.ts`. См. ARCHITECTURE.md §6».
- [x] **Шаг 2.** В ESLint добавь `no-restricted-imports` с `patterns: [{ group: ['@/modules/*/*'], message: 'Импортируй модуль только через @/modules/<name>' }]`. Исключение (`overrides`/`ignores` для этого правила): файлы внутри самого модуля импортируют свои файлы относительным путём `./x` — это не затрагивается; `src/shared/db/schema.ts` — разрешён.
- [x] **Шаг 3.** Проверка: временно добавь в `src/modules/access/index.ts` строку `import '@/modules/gym/schema'` → `pnpm lint` должен упасть с этим сообщением. Удали строку → `pnpm lint` зелёный.
- [x] **Шаг 4.** Коммит: `chore: module skeletons and import boundary rule`.

### Задача 4. Тема, шрифты, UI-кит, маршрутизация сайт/приложение

**Files:**
- Create: `src/shared/fonts/*.woff2`, `src/shared/fonts/index.ts`, `src/app/globals.css` (переписать), `src/shared/surface.ts`, `src/shared/surface.test.ts`, `src/middleware.ts`, `src/app/(site)/page.tsx`, `src/app/(site)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/app/page.tsx`, `src/app/(app)/app/dev/ui/page.tsx`, `src/components/ui/*` (shadcn)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `resolveSurface(host: string | null): 'site' | 'app'`; CSS-переменные и Tailwind-классы `bg-bg`, `bg-surface-1`, `bg-surface-2`, `border-border`, `text-text`, `text-text-secondary`, `text-text-muted`, `bg-accent`, `text-accent`, `text-gold`, `text-success`, `text-warning`, `text-danger`, шрифты `font-display` (Oswald) и `font-sans` (Manrope). Внутренний путь приложения — префикс `/app` (middleware переписывает `app.maxosipov.ru/x` → `/app/x`).

- [x] **Шаг 1.** Шрифты: `pnpm add -D @fontsource-variable/oswald @fontsource-variable/manrope`, скопируй из их `files/` в `src/shared/fonts/` файлы `oswald-cyrillic-wght-normal.woff2`, `oswald-latin-wght-normal.woff2`, `manrope-cyrillic-wght-normal.woff2`, `manrope-latin-wght-normal.woff2`; затем удали эти два пакета. `src/shared/fonts/index.ts`: `next/font/local` → `oswald` (variable `--font-display`) и `manrope` (variable `--font-sans`), `display: 'swap'`.
- [x] **Шаг 2.** `globals.css`: CSS-переменные всех токенов `DESIGN.md` §3 (имена = имена токенов, например `--surface-1: #17171A`), `html { color-scheme: dark; background: var(--bg) }`. Свяжи с Tailwind (в Tailwind v4 — через `@theme`, в v3 — через `tailwind.config` `extend.colors`; выясни версию в `package.json`). Скругления: `--radius-control: 12px`, `--radius-card: 16px`, `--radius-sheet: 24px`.
- [x] **Шаг 3.** `pnpm dlx shadcn@latest init` (стиль по умолчанию, базовый цвет neutral, CSS-переменные — да), затем добавь компоненты: `button input label card sheet dialog sonner tabs switch`. После добавления перекрась их на наши токены (кнопка primary = `bg-accent`, hover `--accent-pressed`; высота кнопки 48px; радиус 12px).
- [x] **Шаг 4.** Падающий тест `src/shared/surface.test.ts`:
  ```ts
  import { resolveSurface } from './surface'
  test.each([
    ['maxosipov.ru', 'site'], ['www.maxosipov.ru', 'site'], ['MAXOSIPOV.RU', 'site'],
    ['app.maxosipov.ru', 'app'], ['APP.maxosipov.ru:443', 'app'],
    ['localhost:3000', 'site'], ['app.localhost:3000', 'app'], [null, 'site'],
  ])('%s -> %s', (host, expected) => expect(resolveSurface(host)).toBe(expected))
  ```
- [x] **Шаг 5.** `src/shared/surface.ts`: приводит к нижнему регистру, отрезает порт, `app` если хост начинается с `app.`, иначе `site`. Тест → PASS.
- [x] **Шаг 6.** `src/middleware.ts`: если `resolveSurface(host) === 'app'` и путь не начинается с `/app`, `/api`, `/_next`, `/media` и не является файлом (в последнем сегменте пути есть точка: `/sw.js`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/figure/front.svg`) — `NextResponse.rewrite` на `/app` + путь. Добавь эти случаи в тест (вынеси решение в чистую функцию `rewriteTarget(surface, pathname): string | null` в `surface.ts`: `('app','/workouts')→'/app/workouts'`, `('app','/sw.js')→null`, `('app','/media/2026/11/x/video.mp4')→null`, `('app','/api/health')→null`, `('site','/app/x')→'/404'`, `('site','/')→null`). Если хост `www.maxosipov.ru` — 308 редирект на `https://maxosipov.ru` + путь. Если surface `site` и путь начинается с `/app` — 404 (`NextResponse.rewrite('/404')`).
- [x] **Шаг 7.** Страницы-заглушки: `(site)/page.tsx` — заголовок «Максим Осипов» шрифтом `font-display`; `(app)/app/page.tsx` — «Приложение МаксИИм — скоро». `(app)/app/dev/ui/page.tsx` — витрина: все цвета токенов плашками с подписями, оба шрифта, кнопки, поле, карточка, лист снизу; страница отдаёт 404 при `NODE_ENV === 'production'` (`notFound()`).
- [x] **Шаг 8.** Корневой `layout.tsx`: `lang="ru"`, классы шрифтов, `bg-bg text-text`, `<meta name="theme-color" content="#0E0E10">`.
- [x] **Шаг 9.** Руками: `pnpm dev`, открыть `http://localhost:3000` (сайт) и `http://app.localhost:3000` (приложение), `http://app.localhost:3000/dev/ui` (витрина). Сделай скриншоты на 375 px в `docs/reports/assets/00-*.png`.
- [x] **Шаг 10.** `pnpm verify` → зелёный. Коммит: `feat(ui): theme tokens, fonts, shadcn kit, host-based routing`.

### Задача 5. Пользователи, роли и права (`rbac`), сид

**Files:**
- Create: `src/modules/auth/schema.ts` (только таблица `users` на этом этапе), `src/modules/rbac/permissions.ts`, `src/modules/rbac/schema.ts`, `src/modules/rbac/check.ts`, `src/modules/rbac/check.test.ts`, `src/modules/rbac/service.ts`, `src/modules/rbac/service.test.ts`, `src/modules/rbac/defaults.ts`, `src/modules/rbac/errors.ts`, `scripts/seed.ts`, `tests/db.ts`
- Modify: `src/modules/rbac/index.ts`, `src/modules/auth/index.ts`, `src/shared/db/schema.ts`

**Interfaces:**
- Produces:
  - `PERMISSIONS` — `as const` массив кодов ровно из `ARCHITECTURE.md` §8.3 (16 кодов); `type Permission = typeof PERMISSIONS[number]`; `type Scope = 'own' | 'all'`; `type RolePermission = { code: Permission; scope: Scope }`.
  - Таблицы: `users` (колонки §7, `role_id` fk → `roles.id`, `trainer_id` fk → `users.id` nullable, `phone` unique), `roles` (`name` unique, `is_system` bool, `permissions` jsonb `RolePermission[]`), `role_audit`.
  - Тип `Actor = { id: string; roleId: string; gymId: string; isOwner: boolean; permissions: RolePermission[] }`.
  - Чистая функция `checkPermission(actor: Actor, perm: Permission, target?: { clientTrainerId: string | null; clientId: string }): boolean` (файл `check.ts`).
  - `can(actor, perm, target?)` = `checkPermission`; `assertCan(...)` бросает `ForbiddenError` (класс в `errors.ts`, `name = 'ForbiddenError'`, `status = 403`).
  - Сервис (`service.ts`): `loadActor(userId: string): Promise<Actor>`, `createRole(actor, input: { name: string; permissions: RolePermission[] }): Promise<Role>`, `updateRole(actor, roleId, input)`, `deleteRole(actor, roleId)`, `assignRole(actor, userId, roleId)`. Все пишут `role_audit`.
  - `DEFAULT_ROLES` в `defaults.ts` — 5 ролей из `ARCHITECTURE.md` §8.3 с именами: `Владелец` (`is_system: true`), `Главный тренер`, `Тренер`, `Администратор зала`, `Клиент`.

- [x] **Шаг 1.** Схемы `users`, `roles`, `role_audit`, добавь в `src/shared/db/schema.ts`. `pnpm db:generate && pnpm db:migrate`.
- [x] **Шаг 2.** Падающие тесты `check.test.ts`:
  ```ts
  const own = (code: Permission): RolePermission => ({ code, scope: 'own' })
  const all = (code: Permission): RolePermission => ({ code, scope: 'all' })
  const actor = (perms: RolePermission[], isOwner = false): Actor =>
    ({ id: 't1', roleId: 'r', gymId: 'g', isOwner, permissions: perms })
  test('owner can everything', () => expect(checkPermission(actor([], true), 'roles.manage')).toBe(true))
  test('no permission -> false', () => expect(checkPermission(actor([]), 'clients.view')).toBe(false))
  test('scope all -> any client', () =>
    expect(checkPermission(actor([all('clients.view')]), 'clients.view', { clientId: 'c', clientTrainerId: 'other' })).toBe(true))
  test('scope own -> only my clients', () => {
    const a = actor([own('clients.view')])
    expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: 't1' })).toBe(true)
    expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: 'other' })).toBe(false)
    expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: null })).toBe(false)
  })
  test('scope own without target -> true (list of own clients)', () =>
    expect(checkPermission(actor([own('clients.view')]), 'clients.view')).toBe(true))
  ```
- [x] **Шаг 3.** Запусти → FAIL. Реализуй `permissions.ts`, `check.ts`. → PASS.
- [x] **Шаг 4.** `tests/db.ts`: хелпер `resetDb()` — `TRUNCATE` всех таблиц `CASCADE` в тестовой БД `maxosipov_test` (создай её в dev-контейнере; `DATABASE_URL` для тестов берётся из `TEST_DATABASE_URL`, если задан). Тесты сервиса запускаются последовательно (`fileParallelism: false` для файлов `*.service.test.ts` или `--no-file-parallelism`).
- [x] **Шаг 5.** Падающие тесты `service.test.ts` (перед каждым — `resetDb()` + сид ролей):
  - `deleteRole` для роли «Владелец» → бросает `ForbiddenError`;
  - `updateRole` для «Владелец» (любое изменение имени/прав) → `ForbiddenError`;
  - `assignRole`, снимающий роль «Владелец» с единственного владельца → `ForbiddenError` с текстом `Нельзя снять последнего владельца`;
  - `createRole` актором без `roles.manage` → `ForbiddenError`;
  - `createRole` владельцем → роль создана, в `role_audit` 1 запись с `action = 'role.create'`;
  - `createRole` с неизвестным кодом права → ошибка валидации (Zod).
- [x] **Шаг 6.** Реализуй `service.ts` → PASS.
- [x] **Шаг 7.** `scripts/seed.ts` (идемпотентный — `onConflictDoNothing`/upsert по уникальным полям): зал «Колизей» (`name: 'Колизей'`, `address: 'Красноярск, ул. Говорова'`, `brand: { name: 'Максим Осипов', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null }`, `settings: { trialDays: 30, subscriptionPriceRub: null, aiDailyLimit: 30, progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 }, aiMemo: '' }`); `DEFAULT_ROLES`; пользователи из `docs/plans/README.md` («Тестовые данные»): владелец, Максим (`trainer_id` у клиентов = Максим), 5 клиентов с ролью «Клиент».
- [x] **Шаг 8.** `pnpm db:seed` два раза подряд → без ошибок, количество строк не меняется (проверь `select count(*) from users` = 7, `roles` = 5).
- [x] **Шаг 9.** `rbac/index.ts` экспортирует `PERMISSIONS`, типы, `can`, `assertCan`, `ForbiddenError`, функции сервиса, `DEFAULT_ROLES`. `auth/index.ts` экспортирует таблицу `users` и тип `User`.
- [x] **Шаг 10.** `pnpm verify` → зелёный. Коммит: `feat(rbac): permissions, roles, audit, seed`.

### Задача 6. PWA-оболочка

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png`, `src/app/(app)/app/offline/page.tsx`, `src/app/sw.ts`, `scripts/make-icons.ts`
- Modify: `next.config.*`

**Interfaces:**
- Produces: устанавливаемое PWA на `app.maxosipov.ru`, service worker `/sw.js`, офлайн-страница `/app/offline`.

- [x] **Шаг 1.** `public/icons/icon.svg`: квадрат 512, фон `#0E0E10`, по центру монограмма «МО» шрифтом Oswald 500 цвета `#F5F5F7` (текст переведи в кривые не нужно — допускается `<text>` с `font-family="Oswald"`; растеризация в шаге 2 использует локальный шрифт), под ней тонкая линия `#E5322D` шириной 120 и толщиной 6.
- [x] **Шаг 2.** `pnpm add -D sharp`; `scripts/make-icons.ts` растеризует svg в 192, 512, maskable 512 (с полями 10%), apple-touch 180. Запусти, PNG закоммить. Если шрифт в svg не подхватывается — переведи монограмму в контуры вручную и опиши в отчёте.
- [x] **Шаг 3.** `src/app/manifest.ts`: `name: 'МаксИИм — тренировки с Максимом'`, `short_name: 'МаксИИм'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `background_color` и `theme_color` `#0E0E10`, `lang: 'ru'`, иконки из шага 2 (maskable с `purpose: 'maskable'`).
- [x] **Шаг 4.** Serwist: установи пакеты по официальной инструкции для Next.js App Router (`@serwist/next`, `serwist`), подключи в `next.config`, `src/app/sw.ts` — precache сборки + `defaultCache`; fallback для документов — `/app/offline`. В dev SW отключён.
- [x] **Шаг 5.** Офлайн-страница: «Нет сети. Тренировка и подходы сохраняются — отправятся сами, когда появится связь.»
- [x] **Шаг 6.** Руками: `pnpm build && pnpm start`, открыть `http://app.localhost:3000` в Chrome → DevTools → Application: manifest без ошибок, SW активен; включить Offline, обновить страницу → офлайн-страница.
- [x] **Шаг 7.** `pnpm verify` → зелёный. Коммит: `feat(pwa): manifest, icons, service worker, offline page`.

### Задача 7. Health-check, worker, Docker-образ

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/health/health.test.ts`, `src/shared/health.ts`, `src/worker/index.ts`, `src/worker/jobs.ts`, `docker/Dockerfile`, `docker/compose.yml`, `docker/Caddyfile`, `.dockerignore`
- Modify: `next.config.*` (`output: 'standalone'`), `package.json` (`"worker": "tsx src/worker/index.ts"`)

**Interfaces:**
- Produces: `checkHealth(ping: () => Promise<void>, timeoutMs = 2000): Promise<{ ok: boolean; db: 'up' | 'down' }>` (`src/shared/health.ts`); `GET /api/health` → 200 `{ok:true,db:'up'}` или 503 `{ok:false,db:'down'}`; `startWorker(): Promise<void>` с pg-boss и регистрацией задач из `jobs.ts` (сейчас одна: `heartbeat` раз в 10 минут пишет в лог).

- [ ] **Шаг 1.** Падающий тест `health.test.ts`: `checkHealth(async () => {})` → `{ok:true, db:'up'}`; `checkHealth(() => new Promise(() => {}), 50)` → `{ok:false, db:'down'}` (не виснет); `checkHealth(async () => { throw new Error('x') })` → `down`.
- [ ] **Шаг 2.** Реализуй `checkHealth` через `Promise.race` с таймаутом; route вызывает её с `db.execute(sql\`select 1\`)`. → PASS.
- [ ] **Шаг 3.** `pnpm add pg-boss`. `src/worker/index.ts`: создать `PgBoss(env.DATABASE_URL)`, `start()`, зарегистрировать задачи, корректно останавливаться по `SIGTERM`. Сверь API с README установленной версии pg-boss (`schedule`, `work`) — не выдумывай.
- [ ] **Шаг 4.** `docker/Dockerfile` — multi-stage: `deps` (pnpm install --frozen-lockfile), `build` (`pnpm build`), `runner` на `node:22-alpine` с `ffmpeg` (`apk add ffmpeg`) — понадобится worker'у; копирует `.next/standalone`, `.next/static`, `public`, `drizzle`, `src/worker`, `node_modules` нужные для worker (допустимо копировать весь `node_modules` из `deps` — опиши в отчёте размер образа). `CMD` по умолчанию — `node server.js`.
- [ ] **Шаг 5.** `docker/compose.yml`:
  - `db`: `postgres:17-alpine`, том `/data/postgres`, без публикации порта наружу, healthcheck `pg_isready`;
  - `web`: образ из Dockerfile, `env_file: ../.env`, depends_on db (healthy), команда — перед стартом `pnpm`-независимая миграция: `node scripts/migrate.js` (создай `scripts/migrate.ts` → компилируется в образ; использует `drizzle-orm/postgres-js/migrator`), затем `node server.js`;
  - `worker`: тот же образ, команда `node --import tsx src/worker/index.ts` (или скомпилируй worker отдельно — выбери и опиши в отчёте), том `/data/media`;
  - `caddy`: `caddy:2-alpine`, порты 80/443, тома `caddy_data`, `caddy_config`, `/data/media:/srv/media:ro`, `./Caddyfile:/etc/caddy/Caddyfile`.
- [ ] **Шаг 6.** `docker/Caddyfile`:
  ```
  maxosipov.ru, app.maxosipov.ru {
    encode zstd gzip
    reverse_proxy web:3000
  }
  www.maxosipov.ru {
    redir https://maxosipov.ru{uri} permanent
  }
  ```
  (раздача `/media` с проверкой подписи добавится на этапе 2).
- [ ] **Шаг 7.** Локально: `docker compose -f docker/compose.yml build` → успешно. Запуск с локальным `.env` → `curl -H 'Host: app.maxosipov.ru' http://localhost/api/health` (через web напрямую, порт 3000 временно опубликуй) → `{"ok":true,"db":"up"}`.
- [ ] **Шаг 8.** `pnpm verify` → зелёный. Коммит: `feat(infra): health check, worker, docker images, caddy`.

### Задача 8. Сервер FirstVPS, деплой, бэкапы

**Files:**
- Create: `docs/ops/server-setup.md`, `scripts/deploy.sh`, `scripts/backup.sh`, `scripts/restore-check.sh`, `docker/backup.env.example`

**Interfaces:**
- Produces: работающие `https://maxosipov.ru` и `https://app.maxosipov.ru/api/health`; ночной бэкап.

- [ ] **Шаг 1.** `docs/ops/server-setup.md` — пошагово (исполнитель пишет, владелец выполняет на сервере, если у исполнителя нет SSH):
  1. VPS: Ubuntu 24.04 LTS, 4 vCPU, 8 ГБ RAM, 160 ГБ NVMe (ARCHITECTURE §16).
  2. Пользователь `deploy` с sudo, вход по SSH-ключу, `PasswordAuthentication no`.
  3. `ufw allow 22,80,443/tcp && ufw enable`.
  4. Docker Engine + compose plugin по официальной инструкции Docker для Ubuntu.
  5. DNS у регистратора: A-записи `@`, `www`, `app` → IP сервера; дождаться применения (`dig +short app.maxosipov.ru`).
  6. Клонировать репозиторий в `/opt/maxosipov`, создать `.env` (продакшн-значения), `mkdir -p /data/postgres /data/media`.
  7. `./scripts/deploy.sh`.
- [ ] **Шаг 2.** `scripts/deploy.sh`: `set -euo pipefail`; `git pull --ff-only`; `docker compose -f docker/compose.yml build`; `docker compose -f docker/compose.yml up -d`; ожидание `/api/health` до 60 с (curl в цикле к `https://app.maxosipov.ru/api/health`), при неудаче — вывести `docker compose logs --tail=100 web` и выйти с кодом 1.
- [ ] **Шаг 3.** `scripts/backup.sh`: `pg_dump` из контейнера `db` в `/data/backups/db-$(date +%F).sql.gz`, затем `restic backup /data/backups /data/media` в S3-совместимое хранилище (переменные из `/opt/maxosipov/docker/backup.env`: `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), затем `restic forget --keep-daily 14 --keep-weekly 8 --prune`; удалить локальные дампы старше 3 дней.
- [ ] **Шаг 4.** Cron на сервере (`/etc/cron.d/maxosipov-backup`): ежедневно в 03:30 по Красноярску → `scripts/backup.sh >> /var/log/maxosipov-backup.log 2>&1`. Задокументируй в `server-setup.md`.
- [ ] **Шаг 5.** `scripts/restore-check.sh`: восстанавливает последний дамп во временный контейнер `postgres:17-alpine` и выполняет `select count(*) from users` — для ежемесячной проверки.
- [ ] **Шаг 6.** Выполнение на сервере (владелец или исполнитель с доступом): деплой → проверки:
  - `curl -sI https://maxosipov.ru` → 200, валидный сертификат;
  - `curl -sI https://www.maxosipov.ru` → 308 на `https://maxosipov.ru/`;
  - `curl -s https://app.maxosipov.ru/api/health` → `{"ok":true,"db":"up"}`;
  - `scripts/backup.sh` вручную → снапшот в `restic snapshots`.
- [ ] **Шаг 7.** Коммит: `chore(ops): server setup guide, deploy and backup scripts`.

### Задача 9. Отчёт этапа

- [ ] Сид на продакшне **не** запускать с тестовыми номерами: в `scripts/seed.ts` при `NODE_ENV === 'production'` создаются только зал и роли; владелец и Максим — по номерам из переменных `SEED_OWNER_PHONE`, `SEED_TRAINER_PHONE` (добавь в `.env.example`). Тест: `seed` в режиме production без этих переменных не падает и не создаёт пользователей.
- [ ] `pnpm test:e2e`: один e2e `e2e/smoke.spec.ts` — открывает `http://app.localhost:3000`, видит текст «Приложение МаксИИм — скоро»; открывает `http://localhost:3000`, видит «Максим Осипов».
- [ ] Отчёт `docs/reports/00-report.md` по шаблону из README. **Стоп — ждать ревью.**
