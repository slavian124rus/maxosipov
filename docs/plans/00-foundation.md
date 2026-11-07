# Р­С‚Р°Рї 0. Р¤СѓРЅРґР°РјРµРЅС‚ вЂ” РїР»Р°РЅ СЂРµР°Р»РёР·Р°С†РёРё

> **Р”Р»СЏ РёСЃРїРѕР»РЅРёС‚РµР»СЏ:** СЂР°Р±РѕС‚Р°Р№ СЃС‚СЂРѕРіРѕ РїРѕ `docs/plans/README.md`. Р—Р°РґР°С‡Рё РїРѕ РїРѕСЂСЏРґРєСѓ, С‡РµРєР±РѕРєСЃС‹ `- [ ]` в†’ `- [x]`.

**Р¦РµР»СЊ:** РїСѓСЃС‚РѕРµ, РЅРѕ В«РїСЂР°РІРёР»СЊРЅРѕРµВ» РїСЂРёР»РѕР¶РµРЅРёРµ: Next.js + PostgreSQL + С‚РµРјР° + СЂРѕР»Рё/РїСЂР°РІР° + PWA-РѕР±РѕР»РѕС‡РєР°, СЂР°Р·РІС‘СЂРЅСѓС‚Рѕ РЅР° FirstVPS РїРѕ HTTPS РЅР° `maxosipov.ru` Рё `app.maxosipov.ru`, СЃ РЅРѕС‡РЅС‹РјРё Р±СЌРєР°РїР°РјРё.

**РђСЂС…РёС‚РµРєС‚СѓСЂР°:** РѕРґРёРЅ Next.js-РїСЂРѕРµРєС‚, СЂР°Р·РґРµР»РµРЅРёРµ СЃР°Р№С‚Р° Рё РїСЂРёР»РѕР¶РµРЅРёСЏ РїРѕ `Host` РІ `middleware.ts`; РјРѕРґСѓР»Рё РІ `src/modules/*` СЃ РїСѓР±Р»РёС‡РЅС‹Рј `index.ts`; Drizzle + PostgreSQL; Docker Compose (`web`, `worker`, `db`, `caddy`).

**РЎС‚РµРє:** Next.js (App Router), TypeScript strict, pnpm, Tailwind CSS, shadcn/ui, Drizzle ORM + drizzle-kit + `postgres` (postgres.js), Zod, pg-boss, Serwist, Vitest, Playwright, Docker, Caddy, restic.

**РЎРїРµРєР°:** `ARCHITECTURE.md` В§3вЂ“В§8.3, В§12, В§17, В§18; `DESIGN.md` В§2вЂ“В§5.

## Global Constraints

- Node.js 22 LTS, pnpm 9+. Р’СЃРµ РІРµСЂСЃРёРё РїР°РєРµС‚РѕРІ вЂ” Р°РєС‚СѓР°Р»СЊРЅС‹Рµ СЃС‚Р°Р±РёР»СЊРЅС‹Рµ РЅР° РјРѕРјРµРЅС‚ СѓСЃС‚Р°РЅРѕРІРєРё; Р·Р°РїРёСЃР°С‚СЊ РёС… РІ РѕС‚С‡С‘С‚.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- РРјРїРѕСЂС‚ РёР· С‡СѓР¶РѕРіРѕ РјРѕРґСѓР»СЏ вЂ” С‚РѕР»СЊРєРѕ `@/modules/<name>` (РµРіРѕ `index.ts`). Р“Р»СѓР±РѕРєРёР№ РёРјРїРѕСЂС‚ `@/modules/<name>/<file>` РёР· РґСЂСѓРіРѕРіРѕ РјРѕРґСѓР»СЏ Р·Р°РїСЂРµС‰С‘РЅ Р»РёРЅС‚РµСЂРѕРј.
- РўР°Р±Р»РёС†С‹ вЂ” `snake_case`, РїРµСЂРІРёС‡РЅС‹Рµ РєР»СЋС‡Рё `uuid` (`defaultRandom()`), Сѓ РІСЃРµС… `created_at`/`updated_at` (`timestamp with time zone`, default now).
- Р§Р°СЃРѕРІРѕР№ РїРѕСЏСЃ Р·Р°Р»Р°: `Asia/Krasnoyarsk`. Р’ Р‘Р” РІСЃС‘ С…СЂР°РЅРёС‚СЃСЏ РІ UTC.
- РўРµРјР° С‚РѕР»СЊРєРѕ С‚С‘РјРЅР°СЏ; С†РІРµС‚Р° Рё С€СЂРёС„С‚С‹ вЂ” СЂРѕРІРЅРѕ РёР· `DESIGN.md` В§3вЂ“В§4. РЁСЂРёС„С‚С‹ Р»РѕРєР°Р»СЊРЅС‹Рµ, Р±РµР· Google Fonts.
- РЎР°Р№С‚: `maxosipov.ru` (+ `www.` в†’ СЂРµРґРёСЂРµРєС‚ РЅР° Р±РµР· `www`). РџСЂРёР»РѕР¶РµРЅРёРµ: `app.maxosipov.ru`. Р›РѕРєР°Р»СЊРЅРѕ: `localhost:3000` Рё `app.localhost:3000`.
- РџР°РїРєРё `Р’РёРґРµРѕ РґР»СЏ РїСЂРёРјРµСЂР° РєР°Рє Р·Р°РЅРёРјР°С‚СЊСЃСЏ/`, `Р¤РћРўРћ Р—РђР›Рђ/` вЂ” РЅРµ С‚СЂРѕРіР°С‚СЊ, РґРѕР±Р°РІРёС‚СЊ РІ `.gitignore`.

## Review Focus

1. `Host` СЃ РїРѕСЂС‚РѕРј, РІ РІРµСЂС…РЅРµРј СЂРµРіРёСЃС‚СЂРµ РёР»Рё СЃ `www.` вЂ” РґРѕР»Р¶РµРЅ РєРѕСЂСЂРµРєС‚РЅРѕ РѕРїСЂРµРґРµР»СЏС‚СЊ СЃР°Р№С‚/РїСЂРёР»РѕР¶РµРЅРёРµ (С‚РµСЃС‚ РІ Р·Р°РґР°С‡Рµ 4).
2. РџСЂРёР»РѕР¶РµРЅРёРµ СЃС‚Р°СЂС‚СѓРµС‚ Р±РµР· РѕР±СЏР·Р°С‚РµР»СЊРЅРѕР№ РїРµСЂРµРјРµРЅРЅРѕР№ РѕРєСЂСѓР¶РµРЅРёСЏ вЂ” РґРѕР»Р¶РЅРѕ РїР°РґР°С‚СЊ СЃСЂР°Р·Сѓ СЃ РїРѕРЅСЏС‚РЅС‹Рј СЃРѕРѕР±С‰РµРЅРёРµРј, Р° РЅРµ РІ СЂР°РЅС‚Р°Р№РјРµ (С‚РµСЃС‚ РІ Р·Р°РґР°С‡Рµ 2).
3. Р РѕР»СЊ В«Р’Р»Р°РґРµР»РµС†В» РЅРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ, РїРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ, СѓСЂРµР·Р°С‚СЊ РїСЂР°РІР° Рё РЅРµР»СЊР·СЏ СЃРЅСЏС‚СЊ СЃ РїРѕСЃР»РµРґРЅРµРіРѕ РІР»Р°РґРµР»СЊС†Р° (С‚РµСЃС‚С‹ РІ Р·Р°РґР°С‡Рµ 5).
4. РњРёРіСЂР°С†РёРё РЅР° РїСѓСЃС‚РѕР№ Р±Р°Р·Рµ Рё РїРѕРІС‚РѕСЂРЅС‹Р№ Р·Р°РїСѓСЃРє СЃРёРґР° вЂ” РёРґРµРјРїРѕС‚РµРЅС‚РЅС‹ (РїСЂРѕРІРµСЂРєР° РІ Р·Р°РґР°С‡Рµ 5, С€Р°Рі В«СЃРёРґ РґРІР°Р¶РґС‹В»).
5. РџР°РґРµРЅРёРµ `db` вЂ” `/api/health` РѕС‚РІРµС‡Р°РµС‚ 503, Р° РЅРµ РІРёСЃРёС‚ (С‚РµСЃС‚ РІ Р·Р°РґР°С‡Рµ 7).

---

### Р—Р°РґР°С‡Р° 1. РЎРѕР·РґР°С‚СЊ РїСЂРѕРµРєС‚ Рё РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹ РєР°С‡РµСЃС‚РІР°

**Files:**
- Create: РІРµСЃСЊ РєР°СЂРєР°СЃ Next.js РІ РєРѕСЂРЅРµ СЂРµРїРѕР·РёС‚РѕСЂРёСЏ, `.gitignore`, `.prettierrc`, `.editorconfig`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `tests/smoke.test.ts`
- Modify: `package.json` (СЃРєСЂРёРїС‚С‹), `tsconfig.json`

**Interfaces:**
- Produces: СЃРєСЂРёРїС‚С‹ `pnpm dev | build | start | lint | test | test:e2e | verify`; Р°Р»РёР°СЃ РёРјРїРѕСЂС‚Р° `@/*` в†’ `src/*`.

- [x] **РЁР°Рі 1.** Р’ РєРѕСЂРЅРµ: `git init`, РІРµС‚РєР° `main`. РџРµСЂРІС‹Р№ РєРѕРјРјРёС‚ вЂ” С‚РѕР»СЊРєРѕ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ `CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`, `docs/`, `prototypes/`.
- [x] **РЁР°Рі 2.** РљР°СЂРєР°СЃ СЃРѕР·РґР°С‚СЊ РІРѕ РІСЂРµРјРµРЅРЅРѕР№ РїР°РїРєРµ (РєРѕСЂРµРЅСЊ РЅРµ РїСѓСЃС‚РѕР№): `pnpm create next-app@latest _scaffold` вЂ” СЃРЅР°С‡Р°Р»Р° РїРѕСЃРјРѕС‚СЂРё `--help` Рё РІС‹Р±РµСЂРё: TypeScript, ESLint, Tailwind, `src/` dir, App Router, import alias `@/*`, pnpm. РџРµСЂРµРЅРµСЃРё СЃРѕРґРµСЂР¶РёРјРѕРµ `_scaffold` РІ РєРѕСЂРµРЅСЊ (РєСЂРѕРјРµ `.git`), СѓРґР°Р»Рё `_scaffold`, РІС‹РїРѕР»РЅРё `pnpm install`.
- [x] **РЁР°Рі 3.** `.gitignore`: РґРѕР±Р°РІСЊ `.env`, `.env.*` (РєСЂРѕРјРµ `.env.example`), `/data`, `/Р’РёРґРµРѕ РґР»СЏ РїСЂРёРјРµСЂР° РєР°Рє Р·Р°РЅРёРјР°С‚СЊСЃСЏ/`, `/Р¤РћРўРћ Р—РђР›Рђ/`, `/playwright-report`, `/test-results`.
- [x] **РЁР°Рі 4.** `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`.
- [x] **РЁР°Рі 5.** РЈСЃС‚Р°РЅРѕРІРё dev-Р·Р°РІРёСЃРёРјРѕСЃС‚Рё: `vitest @vitest/coverage-v8 @playwright/test prettier eslint-config-prettier`. `pnpm exec playwright install chromium`.
- [x] **РЁР°Рі 6.** `vitest.config.ts`: РѕРєСЂСѓР¶РµРЅРёРµ `node`, include `src/**/*.test.ts`, `tests/**/*.test.ts`; Р°Р»РёР°СЃ `@` в†’ `./src`.
- [x] **РЁР°Рі 7.** `playwright.config.ts`: `testDir: 'e2e'`, РѕРґРёРЅ РїСЂРѕРµРєС‚ `mobile` СЃ `viewport: {width: 375, height: 812}`, `isMobile: true`, `hasTouch: true`; `webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true }`.
- [x] **РЁР°Рі 8.** РЎРєСЂРёРїС‚С‹ РІ `package.json`:
  ```json
  "lint": "eslint . && tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "verify": "pnpm lint && pnpm test"
  ```
- [x] **РЁР°Рі 9.** РўРµСЃС‚ `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)` вЂ” РїСЂРѕРІРµСЂРєР°, С‡С‚Рѕ Vitest СЂР°Р±РѕС‚Р°РµС‚. `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№.
- [x] **РЁР°Рі 10.** РљРѕРјРјРёС‚: `chore: scaffold next.js project with tooling`.

### Р—Р°РґР°С‡Р° 2. РџРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ Рё РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р‘Р”

**Files:**
- Create: `src/shared/env.ts`, `src/shared/env.test.ts`, `src/shared/db/index.ts`, `src/shared/db/schema.ts`, `drizzle.config.ts`, `docker/compose.dev.yml`, `.env.example`, `src/modules/gym/schema.ts`, `src/modules/gym/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env` Рё `env: Env` РёР· `@/shared/env`; `db` (Drizzle, postgres.js) РёР· `@/shared/db`; С‚Р°Р±Р»РёС†Р° `gyms` Рё С‚РёРї `Gym` РёР· `@/modules/gym`.

- [ ] **РЁР°Рі 1.** РЈСЃС‚Р°РЅРѕРІРё: `drizzle-orm postgres zod`; dev: `drizzle-kit tsx dotenv`.
- [ ] **РЁР°Рі 2.** `docker/compose.dev.yml`: СЃРµСЂРІРёСЃ `db` вЂ” `postgres:17-alpine`, РїРѕСЂС‚ `5432:5432`, `POSTGRES_DB=maxosipov`, `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`, С‚РѕРј `pgdata`. Р—Р°РїСѓСЃС‚Рё `docker compose -f docker/compose.dev.yml up -d`.
- [ ] **РЁР°Рі 3.** РќР°РїРёС€Рё РїР°РґР°СЋС‰РёР№ С‚РµСЃС‚ `src/shared/env.test.ts`:
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
- [ ] **РЁР°Рі 4.** `pnpm test src/shared/env.test.ts` в†’ FAIL (РЅРµС‚ РјРѕРґСѓР»СЏ).
- [ ] **РЁР°Рі 5.** `src/shared/env.ts`: Zod-СЃС…РµРјР° РІСЃРµС… РїРµСЂРµРјРµРЅРЅС‹С… РёР· `ARCHITECTURE.md` В§17. РћР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ СЃРµР№С‡Р°СЃ: `DATABASE_URL` (url), `AUTH_SECRET` (min 32). `APP_URL` default `http://app.localhost:3000`, `SITE_URL` default `http://localhost:3000`, `NODE_ENV` default `development`. РћСЃС‚Р°Р»СЊРЅС‹Рµ вЂ” `optional()` (РёС… СЃРґРµР»Р°СЋС‚ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹РјРё СЌС‚Р°РїС‹, РєРѕС‚РѕСЂС‹Рµ РёС… РёСЃРїРѕР»СЊР·СѓСЋС‚). `parseEnv` РїСЂРё РѕС€РёР±РєРµ Р±СЂРѕСЃР°РµС‚ `Error` СЃ РїРµСЂРµС‡РЅРµРј РёРјС‘РЅ РЅРµРІР°Р»РёРґРЅС‹С… РїРµСЂРµРјРµРЅРЅС‹С…. `export const env = parseEnv(process.env)`.
- [ ] **РЁР°Рі 6.** РўРµСЃС‚ в†’ PASS.
- [ ] **РЁР°Рі 7.** `.env.example` вЂ” РІСЃРµ РїРµСЂРµРјРµРЅРЅС‹Рµ В§17 СЃ РїСѓСЃС‚С‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё; Р»РѕРєР°Р»СЊРЅС‹Р№ `.env` СЃ `DATABASE_URL=postgres://app:app@localhost:5432/maxosipov` Рё СЃР»СѓС‡Р°Р№РЅС‹Рј `AUTH_SECRET` (`openssl rand -base64 48`).
- [ ] **РЁР°Рі 8.** `src/modules/gym/schema.ts` вЂ” С‚Р°Р±Р»РёС†Р° `gyms` РїРѕ `ARCHITECTURE.md` В§7: `id`, `name` text not null, `address` text not null, `timezone` text not null default `'Asia/Krasnoyarsk'`, `brand` jsonb not null, `settings` jsonb not null, timestamps. РўРёРїС‹ `GymBrand = { name: string; shortName: string; colors: { accent: string }; logoUrl: string | null }`, `GymSettings = { trialDays: number; subscriptionPriceRub: number | null; aiDailyLimit: number; progressionRules: ProgressionRules; aiMemo: string }`, РіРґРµ `ProgressionRules = { sessionsToIncrease: number; fastTrackOnEasy: boolean; failSessionsToDrop: number; dropPercent: number }` (РѕР±СЉСЏРІРё РµРіРѕ Р·РґРµСЃСЊ, РІ `gym/schema.ts`; РїРѕР·Р¶Рµ РµРіРѕ РёРјРїРѕСЂС‚РёСЂСѓРµС‚ `progression`). РўРёРїРёР·РёСЂСѓР№ jsonb С‡РµСЂРµР· `.$type<>()`.
- [ ] **РЁР°Рі 9.** `src/shared/db/schema.ts` СЂРµСЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚ СЃС…РµРјС‹ РјРѕРґСѓР»РµР№ (`export * from '@/modules/gym/schema'`) вЂ” СЌС‚Рѕ РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ С„Р°Р№Р», РєРѕС‚РѕСЂРѕРјСѓ СЂР°Р·СЂРµС€С‘РЅ РїСЂСЏРјРѕР№ РёРјРїРѕСЂС‚ `schema.ts` РјРѕРґСѓР»РµР№. `src/shared/db/index.ts`: `postgres(env.DATABASE_URL)` + `drizzle(client, { schema })`.
- [ ] **РЁР°Рі 10.** `drizzle.config.ts`: `schema: './src/shared/db/schema.ts'`, `out: './drizzle'`, dialect `postgresql`. РЎРєСЂРёРїС‚С‹: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:seed": "tsx scripts/seed.ts"`.
- [ ] **РЁР°Рі 11.** `pnpm db:generate && pnpm db:migrate` в†’ РІ Р‘Р” РµСЃС‚СЊ С‚Р°Р±Р»РёС†Р° `gyms` (РїСЂРѕРІРµСЂСЊ `docker compose -f docker/compose.dev.yml exec db psql -U app -d maxosipov -c '\dt'`).
- [ ] **РЁР°Рі 12.** `src/modules/gym/index.ts` СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚ `gyms`, С‚РёРїС‹ Рё `getGym(): Promise<Gym>` (РїРµСЂРІС‹Р№ Р·Р°Р»; РµСЃР»Рё РЅРµС‚ вЂ” Р±СЂРѕСЃРёС‚СЊ `Error('Gym not seeded')`).
- [ ] **РЁР°Рі 13.** `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№. РљРѕРјРјРёС‚: `feat(db): env validation, drizzle, gyms table`.

### Р—Р°РґР°С‡Р° 3. РњРѕРґСѓР»Рё-СЃРєРµР»РµС‚С‹ Рё РіСЂР°РЅРёС†Р° РёРјРїРѕСЂС‚РѕРІ

**Files:**
- Create: `src/modules/{auth,rbac,access,catalog,media,training,progression,coach-ai,trainer,notifications,body,landing}/index.ts` (РїСѓСЃС‚РѕР№ `export {}`), `src/modules/README.md`
- Modify: `eslint.config.*`

**Interfaces:**
- Produces: РїСЂР°РІРёР»Рѕ Р»РёРЅС‚РµСЂР°, Р·Р°РїСЂРµС‰Р°СЋС‰РµРµ РіР»СѓР±РѕРєРёРµ РёРјРїРѕСЂС‚С‹ РјРѕРґСѓР»РµР№.

- [ ] **РЁР°Рі 1.** РЎРѕР·РґР°Р№ РїР°РїРєРё Рё `index.ts` РґР»СЏ РІСЃРµС… РјРѕРґСѓР»РµР№ РёР· `ARCHITECTURE.md` В§6. `src/modules/README.md` вЂ” РѕРґРЅР° С„СЂР°Р·Р°: В«РљР°Р¶РґС‹Р№ РјРѕРґСѓР»СЊ РѕС‚РґР°С‘С‚ РЅР°СЂСѓР¶Сѓ С‚РѕР»СЊРєРѕ `index.ts`. РЎРј. ARCHITECTURE.md В§6В».
- [ ] **РЁР°Рі 2.** Р’ ESLint РґРѕР±Р°РІСЊ `no-restricted-imports` СЃ `patterns: [{ group: ['@/modules/*/*'], message: 'РРјРїРѕСЂС‚РёСЂСѓР№ РјРѕРґСѓР»СЊ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· @/modules/<name>' }]`. РСЃРєР»СЋС‡РµРЅРёРµ (`overrides`/`ignores` РґР»СЏ СЌС‚РѕРіРѕ РїСЂР°РІРёР»Р°): С„Р°Р№Р»С‹ РІРЅСѓС‚СЂРё СЃР°РјРѕРіРѕ РјРѕРґСѓР»СЏ РёРјРїРѕСЂС‚РёСЂСѓСЋС‚ СЃРІРѕРё С„Р°Р№Р»С‹ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Рј РїСѓС‚С‘Рј `./x` вЂ” СЌС‚Рѕ РЅРµ Р·Р°С‚СЂР°РіРёРІР°РµС‚СЃСЏ; `src/shared/db/schema.ts` вЂ” СЂР°Р·СЂРµС€С‘РЅ.
- [ ] **РЁР°Рі 3.** РџСЂРѕРІРµСЂРєР°: РІСЂРµРјРµРЅРЅРѕ РґРѕР±Р°РІСЊ РІ `src/modules/access/index.ts` СЃС‚СЂРѕРєСѓ `import '@/modules/gym/schema'` в†’ `pnpm lint` РґРѕР»Р¶РµРЅ СѓРїР°СЃС‚СЊ СЃ СЌС‚РёРј СЃРѕРѕР±С‰РµРЅРёРµРј. РЈРґР°Р»Рё СЃС‚СЂРѕРєСѓ в†’ `pnpm lint` Р·РµР»С‘РЅС‹Р№.
- [ ] **РЁР°Рі 4.** РљРѕРјРјРёС‚: `chore: module skeletons and import boundary rule`.

### Р—Р°РґР°С‡Р° 4. РўРµРјР°, С€СЂРёС„С‚С‹, UI-РєРёС‚, РјР°СЂС€СЂСѓС‚РёР·Р°С†РёСЏ СЃР°Р№С‚/РїСЂРёР»РѕР¶РµРЅРёРµ

**Files:**
- Create: `src/shared/fonts/*.woff2`, `src/shared/fonts/index.ts`, `src/app/globals.css` (РїРµСЂРµРїРёСЃР°С‚СЊ), `src/shared/surface.ts`, `src/shared/surface.test.ts`, `src/middleware.ts`, `src/app/(site)/page.tsx`, `src/app/(site)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/app/page.tsx`, `src/app/(app)/app/dev/ui/page.tsx`, `src/components/ui/*` (shadcn)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `resolveSurface(host: string | null): 'site' | 'app'`; CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ Рё Tailwind-РєР»Р°СЃСЃС‹ `bg-bg`, `bg-surface-1`, `bg-surface-2`, `border-border`, `text-text`, `text-text-secondary`, `text-text-muted`, `bg-accent`, `text-accent`, `text-gold`, `text-success`, `text-warning`, `text-danger`, С€СЂРёС„С‚С‹ `font-display` (Oswald) Рё `font-sans` (Manrope). Р’РЅСѓС‚СЂРµРЅРЅРёР№ РїСѓС‚СЊ РїСЂРёР»РѕР¶РµРЅРёСЏ вЂ” РїСЂРµС„РёРєСЃ `/app` (middleware РїРµСЂРµРїРёСЃС‹РІР°РµС‚ `app.maxosipov.ru/x` в†’ `/app/x`).

- [ ] **РЁР°Рі 1.** РЁСЂРёС„С‚С‹: `pnpm add -D @fontsource-variable/oswald @fontsource-variable/manrope`, СЃРєРѕРїРёСЂСѓР№ РёР· РёС… `files/` РІ `src/shared/fonts/` С„Р°Р№Р»С‹ `oswald-cyrillic-wght-normal.woff2`, `oswald-latin-wght-normal.woff2`, `manrope-cyrillic-wght-normal.woff2`, `manrope-latin-wght-normal.woff2`; Р·Р°С‚РµРј СѓРґР°Р»Рё СЌС‚Рё РґРІР° РїР°РєРµС‚Р°. `src/shared/fonts/index.ts`: `next/font/local` в†’ `oswald` (variable `--font-display`) Рё `manrope` (variable `--font-sans`), `display: 'swap'`.
- [ ] **РЁР°Рі 2.** `globals.css`: CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ РІСЃРµС… С‚РѕРєРµРЅРѕРІ `DESIGN.md` В§3 (РёРјРµРЅР° = РёРјРµРЅР° С‚РѕРєРµРЅРѕРІ, РЅР°РїСЂРёРјРµСЂ `--surface-1: #17171A`), `html { color-scheme: dark; background: var(--bg) }`. РЎРІСЏР¶Рё СЃ Tailwind (РІ Tailwind v4 вЂ” С‡РµСЂРµР· `@theme`, РІ v3 вЂ” С‡РµСЂРµР· `tailwind.config` `extend.colors`; РІС‹СЏСЃРЅРё РІРµСЂСЃРёСЋ РІ `package.json`). РЎРєСЂСѓРіР»РµРЅРёСЏ: `--radius-control: 12px`, `--radius-card: 16px`, `--radius-sheet: 24px`.
- [ ] **РЁР°Рі 3.** `pnpm dlx shadcn@latest init` (СЃС‚РёР»СЊ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, Р±Р°Р·РѕРІС‹Р№ С†РІРµС‚ neutral, CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ вЂ” РґР°), Р·Р°С‚РµРј РґРѕР±Р°РІСЊ РєРѕРјРїРѕРЅРµРЅС‚С‹: `button input label card sheet dialog sonner tabs switch`. РџРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ РїРµСЂРµРєСЂР°СЃСЊ РёС… РЅР° РЅР°С€Рё С‚РѕРєРµРЅС‹ (РєРЅРѕРїРєР° primary = `bg-accent`, hover `--accent-pressed`; РІС‹СЃРѕС‚Р° РєРЅРѕРїРєРё 48px; СЂР°РґРёСѓСЃ 12px).
- [ ] **РЁР°Рі 4.** РџР°РґР°СЋС‰РёР№ С‚РµСЃС‚ `src/shared/surface.test.ts`:
  ```ts
  import { resolveSurface } from './surface'
  test.each([
    ['maxosipov.ru', 'site'], ['www.maxosipov.ru', 'site'], ['MAXOSIPOV.RU', 'site'],
    ['app.maxosipov.ru', 'app'], ['APP.maxosipov.ru:443', 'app'],
    ['localhost:3000', 'site'], ['app.localhost:3000', 'app'], [null, 'site'],
  ])('%s -> %s', (host, expected) => expect(resolveSurface(host)).toBe(expected))
  ```
- [ ] **РЁР°Рі 5.** `src/shared/surface.ts`: РїСЂРёРІРѕРґРёС‚ Рє РЅРёР¶РЅРµРјСѓ СЂРµРіРёСЃС‚СЂСѓ, РѕС‚СЂРµР·Р°РµС‚ РїРѕСЂС‚, `app` РµСЃР»Рё С…РѕСЃС‚ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ `app.`, РёРЅР°С‡Рµ `site`. РўРµСЃС‚ в†’ PASS.
- [ ] **РЁР°Рі 6.** `src/middleware.ts`: РµСЃР»Рё `resolveSurface(host) === 'app'` Рё РїСѓС‚СЊ РЅРµ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ `/app`, `/api`, `/_next`, `/media` Рё РЅРµ СЏРІР»СЏРµС‚СЃСЏ С„Р°Р№Р»РѕРј (РІ РїРѕСЃР»РµРґРЅРµРј СЃРµРіРјРµРЅС‚Рµ РїСѓС‚Рё РµСЃС‚СЊ С‚РѕС‡РєР°: `/sw.js`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/figure/front.svg`) вЂ” `NextResponse.rewrite` РЅР° `/app` + РїСѓС‚СЊ. Р”РѕР±Р°РІСЊ СЌС‚Рё СЃР»СѓС‡Р°Рё РІ С‚РµСЃС‚ (РІС‹РЅРµСЃРё СЂРµС€РµРЅРёРµ РІ С‡РёСЃС‚СѓСЋ С„СѓРЅРєС†РёСЋ `rewriteTarget(surface, pathname): string | null` РІ `surface.ts`: `('app','/workouts')в†’'/app/workouts'`, `('app','/sw.js')в†’null`, `('app','/media/2026/11/x/video.mp4')в†’null`, `('app','/api/health')в†’null`, `('site','/app/x')в†’'/404'`, `('site','/')в†’null`). Р•СЃР»Рё С…РѕСЃС‚ `www.maxosipov.ru` вЂ” 308 СЂРµРґРёСЂРµРєС‚ РЅР° `https://maxosipov.ru` + РїСѓС‚СЊ. Р•СЃР»Рё surface `site` Рё РїСѓС‚СЊ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ `/app` вЂ” 404 (`NextResponse.rewrite('/404')`).
- [ ] **РЁР°Рі 7.** РЎС‚СЂР°РЅРёС†С‹-Р·Р°РіР»СѓС€РєРё: `(site)/page.tsx` вЂ” Р·Р°РіРѕР»РѕРІРѕРє В«РњР°РєСЃРёРј РћСЃРёРїРѕРІВ» С€СЂРёС„С‚РѕРј `font-display`; `(app)/app/page.tsx` вЂ” В«РџСЂРёР»РѕР¶РµРЅРёРµ РњР°РєСЃРРРј вЂ” СЃРєРѕСЂРѕВ». `(app)/app/dev/ui/page.tsx` вЂ” РІРёС‚СЂРёРЅР°: РІСЃРµ С†РІРµС‚Р° С‚РѕРєРµРЅРѕРІ РїР»Р°С€РєР°РјРё СЃ РїРѕРґРїРёСЃСЏРјРё, РѕР±Р° С€СЂРёС„С‚Р°, РєРЅРѕРїРєРё, РїРѕР»Рµ, РєР°СЂС‚РѕС‡РєР°, Р»РёСЃС‚ СЃРЅРёР·Сѓ; СЃС‚СЂР°РЅРёС†Р° РѕС‚РґР°С‘С‚ 404 РїСЂРё `NODE_ENV === 'production'` (`notFound()`).
- [ ] **РЁР°Рі 8.** РљРѕСЂРЅРµРІРѕР№ `layout.tsx`: `lang="ru"`, РєР»Р°СЃСЃС‹ С€СЂРёС„С‚РѕРІ, `bg-bg text-text`, `<meta name="theme-color" content="#0E0E10">`.
- [ ] **РЁР°Рі 9.** Р СѓРєР°РјРё: `pnpm dev`, РѕС‚РєСЂС‹С‚СЊ `http://localhost:3000` (СЃР°Р№С‚) Рё `http://app.localhost:3000` (РїСЂРёР»РѕР¶РµРЅРёРµ), `http://app.localhost:3000/dev/ui` (РІРёС‚СЂРёРЅР°). РЎРґРµР»Р°Р№ СЃРєСЂРёРЅС€РѕС‚С‹ РЅР° 375 px РІ `docs/reports/assets/00-*.png`.
- [ ] **РЁР°Рі 10.** `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№. РљРѕРјРјРёС‚: `feat(ui): theme tokens, fonts, shadcn kit, host-based routing`.

### Р—Р°РґР°С‡Р° 5. РџРѕР»СЊР·РѕРІР°С‚РµР»Рё, СЂРѕР»Рё Рё РїСЂР°РІР° (`rbac`), СЃРёРґ

**Files:**
- Create: `src/modules/auth/schema.ts` (С‚РѕР»СЊРєРѕ С‚Р°Р±Р»РёС†Р° `users` РЅР° СЌС‚РѕРј СЌС‚Р°РїРµ), `src/modules/rbac/permissions.ts`, `src/modules/rbac/schema.ts`, `src/modules/rbac/check.ts`, `src/modules/rbac/check.test.ts`, `src/modules/rbac/service.ts`, `src/modules/rbac/service.test.ts`, `src/modules/rbac/defaults.ts`, `src/modules/rbac/errors.ts`, `scripts/seed.ts`, `tests/db.ts`
- Modify: `src/modules/rbac/index.ts`, `src/modules/auth/index.ts`, `src/shared/db/schema.ts`

**Interfaces:**
- Produces:
  - `PERMISSIONS` вЂ” `as const` РјР°СЃСЃРёРІ РєРѕРґРѕРІ СЂРѕРІРЅРѕ РёР· `ARCHITECTURE.md` В§8.3 (16 РєРѕРґРѕРІ); `type Permission = typeof PERMISSIONS[number]`; `type Scope = 'own' | 'all'`; `type RolePermission = { code: Permission; scope: Scope }`.
  - РўР°Р±Р»РёС†С‹: `users` (РєРѕР»РѕРЅРєРё В§7, `role_id` fk в†’ `roles.id`, `trainer_id` fk в†’ `users.id` nullable, `phone` unique), `roles` (`name` unique, `is_system` bool, `permissions` jsonb `RolePermission[]`), `role_audit`.
  - РўРёРї `Actor = { id: string; roleId: string; gymId: string; isOwner: boolean; permissions: RolePermission[] }`.
  - Р§РёСЃС‚Р°СЏ С„СѓРЅРєС†РёСЏ `checkPermission(actor: Actor, perm: Permission, target?: { clientTrainerId: string | null; clientId: string }): boolean` (С„Р°Р№Р» `check.ts`).
  - `can(actor, perm, target?)` = `checkPermission`; `assertCan(...)` Р±СЂРѕСЃР°РµС‚ `ForbiddenError` (РєР»Р°СЃСЃ РІ `errors.ts`, `name = 'ForbiddenError'`, `status = 403`).
  - РЎРµСЂРІРёСЃ (`service.ts`): `loadActor(userId: string): Promise<Actor>`, `createRole(actor, input: { name: string; permissions: RolePermission[] }): Promise<Role>`, `updateRole(actor, roleId, input)`, `deleteRole(actor, roleId)`, `assignRole(actor, userId, roleId)`. Р’СЃРµ РїРёС€СѓС‚ `role_audit`.
  - `DEFAULT_ROLES` РІ `defaults.ts` вЂ” 5 СЂРѕР»РµР№ РёР· `ARCHITECTURE.md` В§8.3 СЃ РёРјРµРЅР°РјРё: `Р’Р»Р°РґРµР»РµС†` (`is_system: true`), `Р“Р»Р°РІРЅС‹Р№ С‚СЂРµРЅРµСЂ`, `РўСЂРµРЅРµСЂ`, `РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ Р·Р°Р»Р°`, `РљР»РёРµРЅС‚`.

- [ ] **РЁР°Рі 1.** РЎС…РµРјС‹ `users`, `roles`, `role_audit`, РґРѕР±Р°РІСЊ РІ `src/shared/db/schema.ts`. `pnpm db:generate && pnpm db:migrate`.
- [ ] **РЁР°Рі 2.** РџР°РґР°СЋС‰РёРµ С‚РµСЃС‚С‹ `check.test.ts`:
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
- [ ] **РЁР°Рі 3.** Р—Р°РїСѓСЃС‚Рё в†’ FAIL. Р РµР°Р»РёР·СѓР№ `permissions.ts`, `check.ts`. в†’ PASS.
- [ ] **РЁР°Рі 4.** `tests/db.ts`: С…РµР»РїРµСЂ `resetDb()` вЂ” `TRUNCATE` РІСЃРµС… С‚Р°Р±Р»РёС† `CASCADE` РІ С‚РµСЃС‚РѕРІРѕР№ Р‘Р” `maxosipov_test` (СЃРѕР·РґР°Р№ РµС‘ РІ dev-РєРѕРЅС‚РµР№РЅРµСЂРµ; `DATABASE_URL` РґР»СЏ С‚РµСЃС‚РѕРІ Р±РµСЂС‘С‚СЃСЏ РёР· `TEST_DATABASE_URL`, РµСЃР»Рё Р·Р°РґР°РЅ). РўРµСЃС‚С‹ СЃРµСЂРІРёСЃР° Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕ (`fileParallelism: false` РґР»СЏ С„Р°Р№Р»РѕРІ `*.service.test.ts` РёР»Рё `--no-file-parallelism`).
- [ ] **РЁР°Рі 5.** РџР°РґР°СЋС‰РёРµ С‚РµСЃС‚С‹ `service.test.ts` (РїРµСЂРµРґ РєР°Р¶РґС‹Рј вЂ” `resetDb()` + СЃРёРґ СЂРѕР»РµР№):
  - `deleteRole` РґР»СЏ СЂРѕР»Рё В«Р’Р»Р°РґРµР»РµС†В» в†’ Р±СЂРѕСЃР°РµС‚ `ForbiddenError`;
  - `updateRole` РґР»СЏ В«Р’Р»Р°РґРµР»РµС†В» (Р»СЋР±РѕРµ РёР·РјРµРЅРµРЅРёРµ РёРјРµРЅРё/РїСЂР°РІ) в†’ `ForbiddenError`;
  - `assignRole`, СЃРЅРёРјР°СЋС‰РёР№ СЂРѕР»СЊ В«Р’Р»Р°РґРµР»РµС†В» СЃ РµРґРёРЅСЃС‚РІРµРЅРЅРѕРіРѕ РІР»Р°РґРµР»СЊС†Р° в†’ `ForbiddenError` СЃ С‚РµРєСЃС‚РѕРј `РќРµР»СЊР·СЏ СЃРЅСЏС‚СЊ РїРѕСЃР»РµРґРЅРµРіРѕ РІР»Р°РґРµР»СЊС†Р°`;
  - `createRole` Р°РєС‚РѕСЂРѕРј Р±РµР· `roles.manage` в†’ `ForbiddenError`;
  - `createRole` РІР»Р°РґРµР»СЊС†РµРј в†’ СЂРѕР»СЊ СЃРѕР·РґР°РЅР°, РІ `role_audit` 1 Р·Р°РїРёСЃСЊ СЃ `action = 'role.create'`;
  - `createRole` СЃ РЅРµРёР·РІРµСЃС‚РЅС‹Рј РєРѕРґРѕРј РїСЂР°РІР° в†’ РѕС€РёР±РєР° РІР°Р»РёРґР°С†РёРё (Zod).
- [ ] **РЁР°Рі 6.** Р РµР°Р»РёР·СѓР№ `service.ts` в†’ PASS.
- [ ] **РЁР°Рі 7.** `scripts/seed.ts` (РёРґРµРјРїРѕС‚РµРЅС‚РЅС‹Р№ вЂ” `onConflictDoNothing`/upsert РїРѕ СѓРЅРёРєР°Р»СЊРЅС‹Рј РїРѕР»СЏРј): Р·Р°Р» В«РљРѕР»РёР·РµР№В» (`name: 'РљРѕР»РёР·РµР№'`, `address: 'РљСЂР°СЃРЅРѕСЏСЂСЃРє, СѓР». Р“РѕРІРѕСЂРѕРІР°'`, `brand: { name: 'РњР°РєСЃРёРј РћСЃРёРїРѕРІ', shortName: 'РњР°РєСЃРРРј', colors: { accent: '#E5322D' }, logoUrl: null }`, `settings: { trialDays: 30, subscriptionPriceRub: null, aiDailyLimit: 30, progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 }, aiMemo: '' }`); `DEFAULT_ROLES`; РїРѕР»СЊР·РѕРІР°С‚РµР»Рё РёР· `docs/plans/README.md` (В«РўРµСЃС‚РѕРІС‹Рµ РґР°РЅРЅС‹РµВ»): РІР»Р°РґРµР»РµС†, РњР°РєСЃРёРј (`trainer_id` Сѓ РєР»РёРµРЅС‚РѕРІ = РњР°РєСЃРёРј), 5 РєР»РёРµРЅС‚РѕРІ СЃ СЂРѕР»СЊСЋ В«РљР»РёРµРЅС‚В».
- [ ] **РЁР°Рі 8.** `pnpm db:seed` РґРІР° СЂР°Р·Р° РїРѕРґСЂСЏРґ в†’ Р±РµР· РѕС€РёР±РѕРє, РєРѕР»РёС‡РµСЃС‚РІРѕ СЃС‚СЂРѕРє РЅРµ РјРµРЅСЏРµС‚СЃСЏ (РїСЂРѕРІРµСЂСЊ `select count(*) from users` = 7, `roles` = 5).
- [ ] **РЁР°Рі 9.** `rbac/index.ts` СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚ `PERMISSIONS`, С‚РёРїС‹, `can`, `assertCan`, `ForbiddenError`, С„СѓРЅРєС†РёРё СЃРµСЂРІРёСЃР°, `DEFAULT_ROLES`. `auth/index.ts` СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚ С‚Р°Р±Р»РёС†Сѓ `users` Рё С‚РёРї `User`.
- [ ] **РЁР°Рі 10.** `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№. РљРѕРјРјРёС‚: `feat(rbac): permissions, roles, audit, seed`.

### Р—Р°РґР°С‡Р° 6. PWA-РѕР±РѕР»РѕС‡РєР°

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png`, `src/app/(app)/app/offline/page.tsx`, `src/app/sw.ts`, `scripts/make-icons.ts`
- Modify: `next.config.*`

**Interfaces:**
- Produces: СѓСЃС‚Р°РЅР°РІР»РёРІР°РµРјРѕРµ PWA РЅР° `app.maxosipov.ru`, service worker `/sw.js`, РѕС„Р»Р°Р№РЅ-СЃС‚СЂР°РЅРёС†Р° `/app/offline`.

- [ ] **РЁР°Рі 1.** `public/icons/icon.svg`: РєРІР°РґСЂР°С‚ 512, С„РѕРЅ `#0E0E10`, РїРѕ С†РµРЅС‚СЂСѓ РјРѕРЅРѕРіСЂР°РјРјР° В«РњРћВ» С€СЂРёС„С‚РѕРј Oswald 500 С†РІРµС‚Р° `#F5F5F7` (С‚РµРєСЃС‚ РїРµСЂРµРІРµРґРё РІ РєСЂРёРІС‹Рµ РЅРµ РЅСѓР¶РЅРѕ вЂ” РґРѕРїСѓСЃРєР°РµС‚СЃСЏ `<text>` СЃ `font-family="Oswald"`; СЂР°СЃС‚РµСЂРёР·Р°С†РёСЏ РІ С€Р°РіРµ 2 РёСЃРїРѕР»СЊР·СѓРµС‚ Р»РѕРєР°Р»СЊРЅС‹Р№ С€СЂРёС„С‚), РїРѕРґ РЅРµР№ С‚РѕРЅРєР°СЏ Р»РёРЅРёСЏ `#E5322D` С€РёСЂРёРЅРѕР№ 120 Рё С‚РѕР»С‰РёРЅРѕР№ 6.
- [ ] **РЁР°Рі 2.** `pnpm add -D sharp`; `scripts/make-icons.ts` СЂР°СЃС‚РµСЂРёР·СѓРµС‚ svg РІ 192, 512, maskable 512 (СЃ РїРѕР»СЏРјРё 10%), apple-touch 180. Р—Р°РїСѓСЃС‚Рё, PNG Р·Р°РєРѕРјРјРёС‚СЊ. Р•СЃР»Рё С€СЂРёС„С‚ РІ svg РЅРµ РїРѕРґС…РІР°С‚С‹РІР°РµС‚СЃСЏ вЂ” РїРµСЂРµРІРµРґРё РјРѕРЅРѕРіСЂР°РјРјСѓ РІ РєРѕРЅС‚СѓСЂС‹ РІСЂСѓС‡РЅСѓСЋ Рё РѕРїРёС€Рё РІ РѕС‚С‡С‘С‚Рµ.
- [ ] **РЁР°Рі 3.** `src/app/manifest.ts`: `name: 'РњР°РєСЃРРРј вЂ” С‚СЂРµРЅРёСЂРѕРІРєРё СЃ РњР°РєСЃРёРјРѕРј'`, `short_name: 'РњР°РєСЃРРРј'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `background_color` Рё `theme_color` `#0E0E10`, `lang: 'ru'`, РёРєРѕРЅРєРё РёР· С€Р°РіР° 2 (maskable СЃ `purpose: 'maskable'`).
- [ ] **РЁР°Рі 4.** Serwist: СѓСЃС‚Р°РЅРѕРІРё РїР°РєРµС‚С‹ РїРѕ РѕС„РёС†РёР°Р»СЊРЅРѕР№ РёРЅСЃС‚СЂСѓРєС†РёРё РґР»СЏ Next.js App Router (`@serwist/next`, `serwist`), РїРѕРґРєР»СЋС‡Рё РІ `next.config`, `src/app/sw.ts` вЂ” precache СЃР±РѕСЂРєРё + `defaultCache`; fallback РґР»СЏ РґРѕРєСѓРјРµРЅС‚РѕРІ вЂ” `/app/offline`. Р’ dev SW РѕС‚РєР»СЋС‡С‘РЅ.
- [ ] **РЁР°Рі 5.** РћС„Р»Р°Р№РЅ-СЃС‚СЂР°РЅРёС†Р°: В«РќРµС‚ СЃРµС‚Рё. РўСЂРµРЅРёСЂРѕРІРєР° Рё РїРѕРґС…РѕРґС‹ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ вЂ” РѕС‚РїСЂР°РІСЏС‚СЃСЏ СЃР°РјРё, РєРѕРіРґР° РїРѕСЏРІРёС‚СЃСЏ СЃРІСЏР·СЊ.В»
- [ ] **РЁР°Рі 6.** Р СѓРєР°РјРё: `pnpm build && pnpm start`, РѕС‚РєСЂС‹С‚СЊ `http://app.localhost:3000` РІ Chrome в†’ DevTools в†’ Application: manifest Р±РµР· РѕС€РёР±РѕРє, SW Р°РєС‚РёРІРµРЅ; РІРєР»СЋС‡РёС‚СЊ Offline, РѕР±РЅРѕРІРёС‚СЊ СЃС‚СЂР°РЅРёС†Сѓ в†’ РѕС„Р»Р°Р№РЅ-СЃС‚СЂР°РЅРёС†Р°.
- [ ] **РЁР°Рі 7.** `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№. РљРѕРјРјРёС‚: `feat(pwa): manifest, icons, service worker, offline page`.

### Р—Р°РґР°С‡Р° 7. Health-check, worker, Docker-РѕР±СЂР°Р·

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/health/health.test.ts`, `src/shared/health.ts`, `src/worker/index.ts`, `src/worker/jobs.ts`, `docker/Dockerfile`, `docker/compose.yml`, `docker/Caddyfile`, `.dockerignore`
- Modify: `next.config.*` (`output: 'standalone'`), `package.json` (`"worker": "tsx src/worker/index.ts"`)

**Interfaces:**
- Produces: `checkHealth(ping: () => Promise<void>, timeoutMs = 2000): Promise<{ ok: boolean; db: 'up' | 'down' }>` (`src/shared/health.ts`); `GET /api/health` в†’ 200 `{ok:true,db:'up'}` РёР»Рё 503 `{ok:false,db:'down'}`; `startWorker(): Promise<void>` СЃ pg-boss Рё СЂРµРіРёСЃС‚СЂР°С†РёРµР№ Р·Р°РґР°С‡ РёР· `jobs.ts` (СЃРµР№С‡Р°СЃ РѕРґРЅР°: `heartbeat` СЂР°Р· РІ 10 РјРёРЅСѓС‚ РїРёС€РµС‚ РІ Р»РѕРі).

- [ ] **РЁР°Рі 1.** РџР°РґР°СЋС‰РёР№ С‚РµСЃС‚ `health.test.ts`: `checkHealth(async () => {})` в†’ `{ok:true, db:'up'}`; `checkHealth(() => new Promise(() => {}), 50)` в†’ `{ok:false, db:'down'}` (РЅРµ РІРёСЃРЅРµС‚); `checkHealth(async () => { throw new Error('x') })` в†’ `down`.
- [ ] **РЁР°Рі 2.** Р РµР°Р»РёР·СѓР№ `checkHealth` С‡РµСЂРµР· `Promise.race` СЃ С‚Р°Р№РјР°СѓС‚РѕРј; route РІС‹Р·С‹РІР°РµС‚ РµС‘ СЃ `db.execute(sql\`select 1\`)`. в†’ PASS.
- [ ] **РЁР°Рі 3.** `pnpm add pg-boss`. `src/worker/index.ts`: СЃРѕР·РґР°С‚СЊ `PgBoss(env.DATABASE_URL)`, `start()`, Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Рё, РєРѕСЂСЂРµРєС‚РЅРѕ РѕСЃС‚Р°РЅР°РІР»РёРІР°С‚СЊСЃСЏ РїРѕ `SIGTERM`. РЎРІРµСЂСЊ API СЃ README СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕР№ РІРµСЂСЃРёРё pg-boss (`schedule`, `work`) вЂ” РЅРµ РІС‹РґСѓРјС‹РІР°Р№.
- [ ] **РЁР°Рі 4.** `docker/Dockerfile` вЂ” multi-stage: `deps` (pnpm install --frozen-lockfile), `build` (`pnpm build`), `runner` РЅР° `node:22-alpine` СЃ `ffmpeg` (`apk add ffmpeg`) вЂ” РїРѕРЅР°РґРѕР±РёС‚СЃСЏ worker'Сѓ; РєРѕРїРёСЂСѓРµС‚ `.next/standalone`, `.next/static`, `public`, `drizzle`, `src/worker`, `node_modules` РЅСѓР¶РЅС‹Рµ РґР»СЏ worker (РґРѕРїСѓСЃС‚РёРјРѕ РєРѕРїРёСЂРѕРІР°С‚СЊ РІРµСЃСЊ `node_modules` РёР· `deps` вЂ” РѕРїРёС€Рё РІ РѕС‚С‡С‘С‚Рµ СЂР°Р·РјРµСЂ РѕР±СЂР°Р·Р°). `CMD` РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ вЂ” `node server.js`.
- [ ] **РЁР°Рі 5.** `docker/compose.yml`:
  - `db`: `postgres:17-alpine`, С‚РѕРј `/data/postgres`, Р±РµР· РїСѓР±Р»РёРєР°С†РёРё РїРѕСЂС‚Р° РЅР°СЂСѓР¶Сѓ, healthcheck `pg_isready`;
  - `web`: РѕР±СЂР°Р· РёР· Dockerfile, `env_file: ../.env`, depends_on db (healthy), РєРѕРјР°РЅРґР° вЂ” РїРµСЂРµРґ СЃС‚Р°СЂС‚РѕРј `pnpm`-РЅРµР·Р°РІРёСЃРёРјР°СЏ РјРёРіСЂР°С†РёСЏ: `node scripts/migrate.js` (СЃРѕР·РґР°Р№ `scripts/migrate.ts` в†’ РєРѕРјРїРёР»РёСЂСѓРµС‚СЃСЏ РІ РѕР±СЂР°Р·; РёСЃРїРѕР»СЊР·СѓРµС‚ `drizzle-orm/postgres-js/migrator`), Р·Р°С‚РµРј `node server.js`;
  - `worker`: С‚РѕС‚ Р¶Рµ РѕР±СЂР°Р·, РєРѕРјР°РЅРґР° `node --import tsx src/worker/index.ts` (РёР»Рё СЃРєРѕРјРїРёР»РёСЂСѓР№ worker РѕС‚РґРµР»СЊРЅРѕ вЂ” РІС‹Р±РµСЂРё Рё РѕРїРёС€Рё РІ РѕС‚С‡С‘С‚Рµ), С‚РѕРј `/data/media`;
  - `caddy`: `caddy:2-alpine`, РїРѕСЂС‚С‹ 80/443, С‚РѕРјР° `caddy_data`, `caddy_config`, `/data/media:/srv/media:ro`, `./Caddyfile:/etc/caddy/Caddyfile`.
- [ ] **РЁР°Рі 6.** `docker/Caddyfile`:
  ```
  maxosipov.ru, app.maxosipov.ru {
    encode zstd gzip
    reverse_proxy web:3000
  }
  www.maxosipov.ru {
    redir https://maxosipov.ru{uri} permanent
  }
  ```
  (СЂР°Р·РґР°С‡Р° `/media` СЃ РїСЂРѕРІРµСЂРєРѕР№ РїРѕРґРїРёСЃРё РґРѕР±Р°РІРёС‚СЃСЏ РЅР° СЌС‚Р°РїРµ 2).
- [ ] **РЁР°Рі 7.** Р›РѕРєР°Р»СЊРЅРѕ: `docker compose -f docker/compose.yml build` в†’ СѓСЃРїРµС€РЅРѕ. Р—Р°РїСѓСЃРє СЃ Р»РѕРєР°Р»СЊРЅС‹Рј `.env` в†’ `curl -H 'Host: app.maxosipov.ru' http://localhost/api/health` (С‡РµСЂРµР· web РЅР°РїСЂСЏРјСѓСЋ, РїРѕСЂС‚ 3000 РІСЂРµРјРµРЅРЅРѕ РѕРїСѓР±Р»РёРєСѓР№) в†’ `{"ok":true,"db":"up"}`.
- [ ] **РЁР°Рі 8.** `pnpm verify` в†’ Р·РµР»С‘РЅС‹Р№. РљРѕРјРјРёС‚: `feat(infra): health check, worker, docker images, caddy`.

### Р—Р°РґР°С‡Р° 8. РЎРµСЂРІРµСЂ FirstVPS, РґРµРїР»РѕР№, Р±СЌРєР°РїС‹

**Files:**
- Create: `docs/ops/server-setup.md`, `scripts/deploy.sh`, `scripts/backup.sh`, `scripts/restore-check.sh`, `docker/backup.env.example`

**Interfaces:**
- Produces: СЂР°Р±РѕС‚Р°СЋС‰РёРµ `https://maxosipov.ru` Рё `https://app.maxosipov.ru/api/health`; РЅРѕС‡РЅРѕР№ Р±СЌРєР°Рї.

- [ ] **РЁР°Рі 1.** `docs/ops/server-setup.md` вЂ” РїРѕС€Р°РіРѕРІРѕ (РёСЃРїРѕР»РЅРёС‚РµР»СЊ РїРёС€РµС‚, РІР»Р°РґРµР»РµС† РІС‹РїРѕР»РЅСЏРµС‚ РЅР° СЃРµСЂРІРµСЂРµ, РµСЃР»Рё Сѓ РёСЃРїРѕР»РЅРёС‚РµР»СЏ РЅРµС‚ SSH):
  1. VPS: Ubuntu 24.04 LTS, 4 vCPU, 8 Р“Р‘ RAM, 160 Р“Р‘ NVMe (ARCHITECTURE В§16).
  2. РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ `deploy` СЃ sudo, РІС…РѕРґ РїРѕ SSH-РєР»СЋС‡Сѓ, `PasswordAuthentication no`.
  3. `ufw allow 22,80,443/tcp && ufw enable`.
  4. Docker Engine + compose plugin РїРѕ РѕС„РёС†РёР°Р»СЊРЅРѕР№ РёРЅСЃС‚СЂСѓРєС†РёРё Docker РґР»СЏ Ubuntu.
  5. DNS Сѓ СЂРµРіРёСЃС‚СЂР°С‚РѕСЂР°: A-Р·Р°РїРёСЃРё `@`, `www`, `app` в†’ IP СЃРµСЂРІРµСЂР°; РґРѕР¶РґР°С‚СЊСЃСЏ РїСЂРёРјРµРЅРµРЅРёСЏ (`dig +short app.maxosipov.ru`).
  6. РљР»РѕРЅРёСЂРѕРІР°С‚СЊ СЂРµРїРѕР·РёС‚РѕСЂРёР№ РІ `/opt/maxosipov`, СЃРѕР·РґР°С‚СЊ `.env` (РїСЂРѕРґР°РєС€РЅ-Р·РЅР°С‡РµРЅРёСЏ), `mkdir -p /data/postgres /data/media`.
  7. `./scripts/deploy.sh`.
- [ ] **РЁР°Рі 2.** `scripts/deploy.sh`: `set -euo pipefail`; `git pull --ff-only`; `docker compose -f docker/compose.yml build`; `docker compose -f docker/compose.yml up -d`; РѕР¶РёРґР°РЅРёРµ `/api/health` РґРѕ 60 СЃ (curl РІ С†РёРєР»Рµ Рє `https://app.maxosipov.ru/api/health`), РїСЂРё РЅРµСѓРґР°С‡Рµ вЂ” РІС‹РІРµСЃС‚Рё `docker compose logs --tail=100 web` Рё РІС‹Р№С‚Рё СЃ РєРѕРґРѕРј 1.
- [ ] **РЁР°Рі 3.** `scripts/backup.sh`: `pg_dump` РёР· РєРѕРЅС‚РµР№РЅРµСЂР° `db` РІ `/data/backups/db-$(date +%F).sql.gz`, Р·Р°С‚РµРј `restic backup /data/backups /data/media` РІ S3-СЃРѕРІРјРµСЃС‚РёРјРѕРµ С…СЂР°РЅРёР»РёС‰Рµ (РїРµСЂРµРјРµРЅРЅС‹Рµ РёР· `/opt/maxosipov/docker/backup.env`: `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), Р·Р°С‚РµРј `restic forget --keep-daily 14 --keep-weekly 8 --prune`; СѓРґР°Р»РёС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Рµ РґР°РјРїС‹ СЃС‚Р°СЂС€Рµ 3 РґРЅРµР№.
- [ ] **РЁР°Рі 4.** Cron РЅР° СЃРµСЂРІРµСЂРµ (`/etc/cron.d/maxosipov-backup`): РµР¶РµРґРЅРµРІРЅРѕ РІ 03:30 РїРѕ РљСЂР°СЃРЅРѕСЏСЂСЃРєСѓ в†’ `scripts/backup.sh >> /var/log/maxosipov-backup.log 2>&1`. Р—Р°РґРѕРєСѓРјРµРЅС‚РёСЂСѓР№ РІ `server-setup.md`.
- [ ] **РЁР°Рі 5.** `scripts/restore-check.sh`: РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РїРѕСЃР»РµРґРЅРёР№ РґР°РјРї РІРѕ РІСЂРµРјРµРЅРЅС‹Р№ РєРѕРЅС‚РµР№РЅРµСЂ `postgres:17-alpine` Рё РІС‹РїРѕР»РЅСЏРµС‚ `select count(*) from users` вЂ” РґР»СЏ РµР¶РµРјРµСЃСЏС‡РЅРѕР№ РїСЂРѕРІРµСЂРєРё.
- [ ] **РЁР°Рі 6.** Р’С‹РїРѕР»РЅРµРЅРёРµ РЅР° СЃРµСЂРІРµСЂРµ (РІР»Р°РґРµР»РµС† РёР»Рё РёСЃРїРѕР»РЅРёС‚РµР»СЊ СЃ РґРѕСЃС‚СѓРїРѕРј): РґРµРїР»РѕР№ в†’ РїСЂРѕРІРµСЂРєРё:
  - `curl -sI https://maxosipov.ru` в†’ 200, РІР°Р»РёРґРЅС‹Р№ СЃРµСЂС‚РёС„РёРєР°С‚;
  - `curl -sI https://www.maxosipov.ru` в†’ 308 РЅР° `https://maxosipov.ru/`;
  - `curl -s https://app.maxosipov.ru/api/health` в†’ `{"ok":true,"db":"up"}`;
  - `scripts/backup.sh` РІСЂСѓС‡РЅСѓСЋ в†’ СЃРЅР°РїС€РѕС‚ РІ `restic snapshots`.
- [ ] **РЁР°Рі 7.** РљРѕРјРјРёС‚: `chore(ops): server setup guide, deploy and backup scripts`.

### Р—Р°РґР°С‡Р° 9. РћС‚С‡С‘С‚ СЌС‚Р°РїР°

- [ ] РЎРёРґ РЅР° РїСЂРѕРґР°РєС€РЅРµ **РЅРµ** Р·Р°РїСѓСЃРєР°С‚СЊ СЃ С‚РµСЃС‚РѕРІС‹РјРё РЅРѕРјРµСЂР°РјРё: РІ `scripts/seed.ts` РїСЂРё `NODE_ENV === 'production'` СЃРѕР·РґР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ Р·Р°Р» Рё СЂРѕР»Рё; РІР»Р°РґРµР»РµС† Рё РњР°РєСЃРёРј вЂ” РїРѕ РЅРѕРјРµСЂР°Рј РёР· РїРµСЂРµРјРµРЅРЅС‹С… `SEED_OWNER_PHONE`, `SEED_TRAINER_PHONE` (РґРѕР±Р°РІСЊ РІ `.env.example`). РўРµСЃС‚: `seed` РІ СЂРµР¶РёРјРµ production Р±РµР· СЌС‚РёС… РїРµСЂРµРјРµРЅРЅС‹С… РЅРµ РїР°РґР°РµС‚ Рё РЅРµ СЃРѕР·РґР°С‘С‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.
- [ ] `pnpm test:e2e`: РѕРґРёРЅ e2e `e2e/smoke.spec.ts` вЂ” РѕС‚РєСЂС‹РІР°РµС‚ `http://app.localhost:3000`, РІРёРґРёС‚ С‚РµРєСЃС‚ В«РџСЂРёР»РѕР¶РµРЅРёРµ РњР°РєСЃРРРј вЂ” СЃРєРѕСЂРѕВ»; РѕС‚РєСЂС‹РІР°РµС‚ `http://localhost:3000`, РІРёРґРёС‚ В«РњР°РєСЃРёРј РћСЃРёРїРѕРІВ».
- [ ] РћС‚С‡С‘С‚ `docs/reports/00-report.md` РїРѕ С€Р°Р±Р»РѕРЅСѓ РёР· README. **РЎС‚РѕРї вЂ” Р¶РґР°С‚СЊ СЂРµРІСЊСЋ.**
