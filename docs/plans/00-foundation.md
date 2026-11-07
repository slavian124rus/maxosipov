# Р В­РЎвЂљР В°Р С— 0. Р В¤РЎС“Р Р…Р Т‘Р В°Р СР ВµР Р…РЎвЂљ РІР‚вЂќ Р С—Р В»Р В°Р Р… РЎР‚Р ВµР В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘

> **Р вЂќР В»РЎРЏ Р С‘РЎРѓР С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЏ:** РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р в„– РЎРѓРЎвЂљРЎР‚Р С•Р С–Р С• Р С—Р С• `docs/plans/README.md`. Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР С‘ Р С—Р С• Р С—Р С•РЎР‚РЎРЏР Т‘Р С”РЎС“, РЎвЂЎР ВµР С”Р В±Р С•Р С”РЎРѓРЎвЂ№ `- [ ]` РІвЂ вЂ™ `- [x]`.

**Р В¦Р ВµР В»РЎРЉ:** Р С—РЎС“РЎРѓРЎвЂљР С•Р Вµ, Р Р…Р С• Р’В«Р С—РЎР‚Р В°Р Р†Р С‘Р В»РЎРЉР Р…Р С•Р ВµР’В» Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ: Next.js + PostgreSQL + РЎвЂљР ВµР СР В° + РЎР‚Р С•Р В»Р С‘/Р С—РЎР‚Р В°Р Р†Р В° + PWA-Р С•Р В±Р С•Р В»Р С•РЎвЂЎР С”Р В°, РЎР‚Р В°Р В·Р Р†РЎвЂРЎР‚Р Р…РЎС“РЎвЂљР С• Р Р…Р В° FirstVPS Р С—Р С• HTTPS Р Р…Р В° `maxosipov.ru` Р С‘ `app.maxosipov.ru`, РЎРѓ Р Р…Р С•РЎвЂЎР Р…РЎвЂ№Р СР С‘ Р В±РЎРЊР С”Р В°Р С—Р В°Р СР С‘.

**Р С’РЎР‚РЎвЂ¦Р С‘РЎвЂљР ВµР С”РЎвЂљРЎС“РЎР‚Р В°:** Р С•Р Т‘Р С‘Р Р… Next.js-Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ, РЎР‚Р В°Р В·Р Т‘Р ВµР В»Р ВµР Р…Р С‘Р Вµ РЎРѓР В°Р в„–РЎвЂљР В° Р С‘ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ Р С—Р С• `Host` Р Р† `middleware.ts`; Р СР С•Р Т‘РЎС“Р В»Р С‘ Р Р† `src/modules/*` РЎРѓ Р С—РЎС“Р В±Р В»Р С‘РЎвЂЎР Р…РЎвЂ№Р С `index.ts`; Drizzle + PostgreSQL; Docker Compose (`web`, `worker`, `db`, `caddy`).

**Р РЋРЎвЂљР ВµР С”:** Next.js (App Router), TypeScript strict, pnpm, Tailwind CSS, shadcn/ui, Drizzle ORM + drizzle-kit + `postgres` (postgres.js), Zod, pg-boss, Serwist, Vitest, Playwright, Docker, Caddy, restic.

**Р РЋР С—Р ВµР С”Р В°:** `ARCHITECTURE.md` Р’В§3РІР‚вЂњР’В§8.3, Р’В§12, Р’В§17, Р’В§18; `DESIGN.md` Р’В§2РІР‚вЂњР’В§5.

## Global Constraints

- Node.js 22 LTS, pnpm 9+. Р вЂ™РЎРѓР Вµ Р Р†Р ВµРЎР‚РЎРѓР С‘Р С‘ Р С—Р В°Р С”Р ВµРЎвЂљР С•Р Р† РІР‚вЂќ Р В°Р С”РЎвЂљРЎС“Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ РЎРѓРЎвЂљР В°Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р Вµ Р Р…Р В° Р СР С•Р СР ВµР Р…РЎвЂљ РЎС“РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С”Р С‘; Р В·Р В°Р С—Р С‘РЎРѓР В°РЎвЂљРЎРЉ Р С‘РЎвЂ¦ Р Р† Р С•РЎвЂљРЎвЂЎРЎвЂРЎвЂљ.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- Р ВР СР С—Р С•РЎР‚РЎвЂљ Р С‘Р В· РЎвЂЎРЎС“Р В¶Р С•Р С–Р С• Р СР С•Р Т‘РЎС“Р В»РЎРЏ РІР‚вЂќ РЎвЂљР С•Р В»РЎРЉР С”Р С• `@/modules/<name>` (Р ВµР С–Р С• `index.ts`). Р вЂњР В»РЎС“Р В±Р С•Р С”Р С‘Р в„– Р С‘Р СР С—Р С•РЎР‚РЎвЂљ `@/modules/<name>/<file>` Р С‘Р В· Р Т‘РЎР‚РЎС“Р С–Р С•Р С–Р С• Р СР С•Р Т‘РЎС“Р В»РЎРЏ Р В·Р В°Р С—РЎР‚Р ВµРЎвЂ°РЎвЂР Р… Р В»Р С‘Р Р…РЎвЂљР ВµРЎР‚Р С•Р С.
- Р СћР В°Р В±Р В»Р С‘РЎвЂ РЎвЂ№ РІР‚вЂќ `snake_case`, Р С—Р ВµРЎР‚Р Р†Р С‘РЎвЂЎР Р…РЎвЂ№Р Вµ Р С”Р В»РЎР‹РЎвЂЎР С‘ `uuid` (`defaultRandom()`), РЎС“ Р Р†РЎРѓР ВµРЎвЂ¦ `created_at`/`updated_at` (`timestamp with time zone`, default now).
- Р В§Р В°РЎРѓР С•Р Р†Р С•Р в„– Р С—Р С•РЎРЏРЎРѓ Р В·Р В°Р В»Р В°: `Asia/Krasnoyarsk`. Р вЂ™ Р вЂР вЂќ Р Р†РЎРѓРЎвЂ РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРѓРЎРЏ Р Р† UTC.
- Р СћР ВµР СР В° РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎвЂљРЎвЂР СР Р…Р В°РЎРЏ; РЎвЂ Р Р†Р ВµРЎвЂљР В° Р С‘ РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљРЎвЂ№ РІР‚вЂќ РЎР‚Р С•Р Р†Р Р…Р С• Р С‘Р В· `DESIGN.md` Р’В§3РІР‚вЂњР’В§4. Р РЃРЎР‚Р С‘РЎвЂћРЎвЂљРЎвЂ№ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ, Р В±Р ВµР В· Google Fonts.
- Р РЋР В°Р в„–РЎвЂљ: `maxosipov.ru` (+ `www.` РІвЂ вЂ™ РЎР‚Р ВµР Т‘Р С‘РЎР‚Р ВµР С”РЎвЂљ Р Р…Р В° Р В±Р ВµР В· `www`). Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ: `app.maxosipov.ru`. Р вЂєР С•Р С”Р В°Р В»РЎРЉР Р…Р С•: `localhost:3000` Р С‘ `app.localhost:3000`.
- Р СџР В°Р С—Р С”Р С‘ `Р вЂ™Р С‘Р Т‘Р ВµР С• Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р В° Р С”Р В°Р С” Р В·Р В°Р Р…Р С‘Р СР В°РЎвЂљРЎРЉРЎРѓРЎРЏ/`, `Р В¤Р С›Р СћР С› Р вЂ”Р С’Р вЂєР С’/` РІР‚вЂќ Р Р…Р Вµ РЎвЂљРЎР‚Р С•Р С–Р В°РЎвЂљРЎРЉ, Р Т‘Р С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Р† `.gitignore`.

## Review Focus

1. `Host` РЎРѓ Р С—Р С•РЎР‚РЎвЂљР С•Р С, Р Р† Р Р†Р ВµРЎР‚РЎвЂ¦Р Р…Р ВµР С РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р Вµ Р С‘Р В»Р С‘ РЎРѓ `www.` РІР‚вЂќ Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р С• Р С•Р С—РЎР‚Р ВµР Т‘Р ВµР В»РЎРЏРЎвЂљРЎРЉ РЎРѓР В°Р в„–РЎвЂљ/Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ (РЎвЂљР ВµРЎРѓРЎвЂљ Р Р† Р В·Р В°Р Т‘Р В°РЎвЂЎР Вµ 4).
2. Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљРЎС“Р ВµРЎвЂљ Р В±Р ВµР В· Р С•Р В±РЎРЏР В·Р В°РЎвЂљР ВµР В»РЎРЉР Р…Р С•Р в„– Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…Р С•Р в„– Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘РЎРЏ РІР‚вЂќ Р Т‘Р С•Р В»Р В¶Р Р…Р С• Р С—Р В°Р Т‘Р В°РЎвЂљРЎРЉ РЎРѓРЎР‚Р В°Р В·РЎС“ РЎРѓ Р С—Р С•Р Р…РЎРЏРЎвЂљР Р…РЎвЂ№Р С РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р ВµР С, Р В° Р Р…Р Вµ Р Р† РЎР‚Р В°Р Р…РЎвЂљР В°Р в„–Р СР Вµ (РЎвЂљР ВµРЎРѓРЎвЂљ Р Р† Р В·Р В°Р Т‘Р В°РЎвЂЎР Вµ 2).
3. Р В Р С•Р В»РЎРЉ Р’В«Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ Р’В» Р Р…Р ВµР В»РЎРЉР В·РЎРЏ РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ, Р С—Р ВµРЎР‚Р ВµР С‘Р СР ВµР Р…Р С•Р Р†Р В°РЎвЂљРЎРЉ, РЎС“РЎР‚Р ВµР В·Р В°РЎвЂљРЎРЉ Р С—РЎР‚Р В°Р Р†Р В° Р С‘ Р Р…Р ВµР В»РЎРЉР В·РЎРЏ РЎРѓР Р…РЎРЏРЎвЂљРЎРЉ РЎРѓ Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р ВµР С–Р С• Р Р†Р В»Р В°Р Т‘Р ВµР В»РЎРЉРЎвЂ Р В° (РЎвЂљР ВµРЎРѓРЎвЂљРЎвЂ№ Р Р† Р В·Р В°Р Т‘Р В°РЎвЂЎР Вµ 5).
4. Р СљР С‘Р С–РЎР‚Р В°РЎвЂ Р С‘Р С‘ Р Р…Р В° Р С—РЎС“РЎРѓРЎвЂљР С•Р в„– Р В±Р В°Р В·Р Вµ Р С‘ Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…РЎвЂ№Р в„– Р В·Р В°Р С—РЎС“РЎРѓР С” РЎРѓР С‘Р Т‘Р В° РІР‚вЂќ Р С‘Р Т‘Р ВµР СР С—Р С•РЎвЂљР ВµР Р…РЎвЂљР Р…РЎвЂ№ (Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° Р Р† Р В·Р В°Р Т‘Р В°РЎвЂЎР Вµ 5, РЎв‚¬Р В°Р С– Р’В«РЎРѓР С‘Р Т‘ Р Т‘Р Р†Р В°Р В¶Р Т‘РЎвЂ№Р’В»).
5. Р СџР В°Р Т‘Р ВµР Р…Р С‘Р Вµ `db` РІР‚вЂќ `/api/health` Р С•РЎвЂљР Р†Р ВµРЎвЂЎР В°Р ВµРЎвЂљ 503, Р В° Р Р…Р Вµ Р Р†Р С‘РЎРѓР С‘РЎвЂљ (РЎвЂљР ВµРЎРѓРЎвЂљ Р Р† Р В·Р В°Р Т‘Р В°РЎвЂЎР Вµ 7).

---

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 1. Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ Р С‘ Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р СР ВµР Р…РЎвЂљРЎвЂ№ Р С”Р В°РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р В°

**Files:**
- Create: Р Р†Р ВµРЎРѓРЎРЉ Р С”Р В°РЎР‚Р С”Р В°РЎРѓ Next.js Р Р† Р С”Р С•РЎР‚Р Р…Р Вµ РЎР‚Р ВµР С—Р С•Р В·Р С‘РЎвЂљР С•РЎР‚Р С‘РЎРЏ, `.gitignore`, `.prettierrc`, `.editorconfig`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `tests/smoke.test.ts`
- Modify: `package.json` (РЎРѓР С”РЎР‚Р С‘Р С—РЎвЂљРЎвЂ№), `tsconfig.json`

**Interfaces:**
- Produces: РЎРѓР С”РЎР‚Р С‘Р С—РЎвЂљРЎвЂ№ `pnpm dev | build | start | lint | test | test:e2e | verify`; Р В°Р В»Р С‘Р В°РЎРѓ Р С‘Р СР С—Р С•РЎР‚РЎвЂљР В° `@/*` РІвЂ вЂ™ `src/*`.

- [x] **Р РЃР В°Р С– 1.** Р вЂ™ Р С”Р С•РЎР‚Р Р…Р Вµ: `git init`, Р Р†Р ВµРЎвЂљР С”Р В° `main`. Р СџР ВµРЎР‚Р Р†РЎвЂ№Р в„– Р С”Р С•Р СР СР С‘РЎвЂљ РІР‚вЂќ РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“РЎР‹РЎвЂ°Р С‘Р Вµ `CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`, `docs/`, `prototypes/`.
- [x] **Р РЃР В°Р С– 2.** Р С™Р В°РЎР‚Р С”Р В°РЎРѓ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р Р†Р С• Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…Р С•Р в„– Р С—Р В°Р С—Р С”Р Вµ (Р С”Р С•РЎР‚Р ВµР Р…РЎРЉ Р Р…Р Вµ Р С—РЎС“РЎРѓРЎвЂљР С•Р в„–): `pnpm create next-app@latest _scaffold` РІР‚вЂќ РЎРѓР Р…Р В°РЎвЂЎР В°Р В»Р В° Р С—Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р С‘ `--help` Р С‘ Р Р†РЎвЂ№Р В±Р ВµРЎР‚Р С‘: TypeScript, ESLint, Tailwind, `src/` dir, App Router, import alias `@/*`, pnpm. Р СџР ВµРЎР‚Р ВµР Р…Р ВµРЎРѓР С‘ РЎРѓР С•Р Т‘Р ВµРЎР‚Р В¶Р С‘Р СР С•Р Вµ `_scaffold` Р Р† Р С”Р С•РЎР‚Р ВµР Р…РЎРЉ (Р С”РЎР‚Р С•Р СР Вµ `.git`), РЎС“Р Т‘Р В°Р В»Р С‘ `_scaffold`, Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…Р С‘ `pnpm install`.
- [x] **Р РЃР В°Р С– 3.** `.gitignore`: Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ `.env`, `.env.*` (Р С”РЎР‚Р С•Р СР Вµ `.env.example`), `/data`, `/Р вЂ™Р С‘Р Т‘Р ВµР С• Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р В° Р С”Р В°Р С” Р В·Р В°Р Р…Р С‘Р СР В°РЎвЂљРЎРЉРЎРѓРЎРЏ/`, `/Р В¤Р С›Р СћР С› Р вЂ”Р С’Р вЂєР С’/`, `/playwright-report`, `/test-results`.
- [x] **Р РЃР В°Р С– 4.** `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`.
- [x] **Р РЃР В°Р С– 5.** Р Р€РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘ dev-Р В·Р В°Р Р†Р С‘РЎРѓР С‘Р СР С•РЎРѓРЎвЂљР С‘: `vitest @vitest/coverage-v8 @playwright/test prettier eslint-config-prettier`. `pnpm exec playwright install chromium`.
- [x] **Р РЃР В°Р С– 6.** `vitest.config.ts`: Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘Р Вµ `node`, include `src/**/*.test.ts`, `tests/**/*.test.ts`; Р В°Р В»Р С‘Р В°РЎРѓ `@` РІвЂ вЂ™ `./src`.
- [x] **Р РЃР В°Р С– 7.** `playwright.config.ts`: `testDir: 'e2e'`, Р С•Р Т‘Р С‘Р Р… Р С—РЎР‚Р С•Р ВµР С”РЎвЂљ `mobile` РЎРѓ `viewport: {width: 375, height: 812}`, `isMobile: true`, `hasTouch: true`; `webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true }`.
- [x] **Р РЃР В°Р С– 8.** Р РЋР С”РЎР‚Р С‘Р С—РЎвЂљРЎвЂ№ Р Р† `package.json`:
  ```json
  "lint": "eslint . && tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "verify": "pnpm lint && pnpm test"
  ```
- [x] **Р РЃР В°Р С– 9.** Р СћР ВµРЎРѓРЎвЂљ `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)` РІР‚вЂќ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В°, РЎвЂЎРЎвЂљР С• Vitest РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р ВµРЎвЂљ. `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–.
- [x] **Р РЃР В°Р С– 10.** Р С™Р С•Р СР СР С‘РЎвЂљ: `chore: scaffold next.js project with tooling`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 2. Р СџР ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘РЎРЏ Р С‘ Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ Р С” Р вЂР вЂќ

**Files:**
- Create: `src/shared/env.ts`, `src/shared/env.test.ts`, `src/shared/db/index.ts`, `src/shared/db/schema.ts`, `drizzle.config.ts`, `docker/compose.dev.yml`, `.env.example`, `src/modules/gym/schema.ts`, `src/modules/gym/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env` Р С‘ `env: Env` Р С‘Р В· `@/shared/env`; `db` (Drizzle, postgres.js) Р С‘Р В· `@/shared/db`; РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ Р В° `gyms` Р С‘ РЎвЂљР С‘Р С— `Gym` Р С‘Р В· `@/modules/gym`.

- [x] **Р РЃР В°Р С– 1.** Р Р€РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘: `drizzle-orm postgres zod`; dev: `drizzle-kit tsx dotenv`.
- [x] **Р РЃР В°Р С– 2.** `docker/compose.dev.yml`: РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓ `db` РІР‚вЂќ `postgres:17-alpine`, Р С—Р С•РЎР‚РЎвЂљ `5432:5432`, `POSTGRES_DB=maxosipov`, `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`, РЎвЂљР С•Р С `pgdata`. Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘ `docker compose -f docker/compose.dev.yml up -d`.
- [x] **Р РЃР В°Р С– 3.** Р СњР В°Р С—Р С‘РЎв‚¬Р С‘ Р С—Р В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘Р в„– РЎвЂљР ВµРЎРѓРЎвЂљ `src/shared/env.test.ts`:
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
- [x] **Р РЃР В°Р С– 4.** `pnpm test src/shared/env.test.ts` РІвЂ вЂ™ FAIL (Р Р…Р ВµРЎвЂљ Р СР С•Р Т‘РЎС“Р В»РЎРЏ).
- [x] **Р РЃР В°Р С– 5.** `src/shared/env.ts`: Zod-РЎРѓРЎвЂ¦Р ВµР СР В° Р Р†РЎРѓР ВµРЎвЂ¦ Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№РЎвЂ¦ Р С‘Р В· `ARCHITECTURE.md` Р’В§17. Р С›Р В±РЎРЏР В·Р В°РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р Вµ РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ: `DATABASE_URL` (url), `AUTH_SECRET` (min 32). `APP_URL` default `http://app.localhost:3000`, `SITE_URL` default `http://localhost:3000`, `NODE_ENV` default `development`. Р С›РЎРѓРЎвЂљР В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ РІР‚вЂќ `optional()` (Р С‘РЎвЂ¦ РЎРѓР Т‘Р ВµР В»Р В°РЎР‹РЎвЂљ Р С•Р В±РЎРЏР В·Р В°РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р СР С‘ РЎРЊРЎвЂљР В°Р С—РЎвЂ№, Р С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№Р Вµ Р С‘РЎвЂ¦ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“РЎР‹РЎвЂљ). `parseEnv` Р С—РЎР‚Р С‘ Р С•РЎв‚¬Р С‘Р В±Р С”Р Вµ Р В±РЎР‚Р С•РЎРѓР В°Р ВµРЎвЂљ `Error` РЎРѓ Р С—Р ВµРЎР‚Р ВµРЎвЂЎР Р…Р ВµР С Р С‘Р СРЎвЂР Р… Р Р…Р ВµР Р†Р В°Р В»Р С‘Р Т‘Р Р…РЎвЂ№РЎвЂ¦ Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№РЎвЂ¦. `export const env = parseEnv(process.env)`.
- [x] **Р РЃР В°Р С– 6.** Р СћР ВµРЎРѓРЎвЂљ РІвЂ вЂ™ PASS.
- [x] **Р РЃР В°Р С– 7.** `.env.example` РІР‚вЂќ Р Р†РЎРѓР Вµ Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ Р’В§17 РЎРѓ Р С—РЎС“РЎРѓРЎвЂљРЎвЂ№Р СР С‘ Р В·Р Р…Р В°РЎвЂЎР ВµР Р…Р С‘РЎРЏР СР С‘; Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– `.env` РЎРѓ `DATABASE_URL=postgres://app:app@localhost:5432/maxosipov` Р С‘ РЎРѓР В»РЎС“РЎвЂЎР В°Р в„–Р Р…РЎвЂ№Р С `AUTH_SECRET` (`openssl rand -base64 48`).
- [x] **Р РЃР В°Р С– 8.** `src/modules/gym/schema.ts` РІР‚вЂќ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ Р В° `gyms` Р С—Р С• `ARCHITECTURE.md` Р’В§7: `id`, `name` text not null, `address` text not null, `timezone` text not null default `'Asia/Krasnoyarsk'`, `brand` jsonb not null, `settings` jsonb not null, timestamps. Р СћР С‘Р С—РЎвЂ№ `GymBrand = { name: string; shortName: string; colors: { accent: string }; logoUrl: string | null }`, `GymSettings = { trialDays: number; subscriptionPriceRub: number | null; aiDailyLimit: number; progressionRules: ProgressionRules; aiMemo: string }`, Р С–Р Т‘Р Вµ `ProgressionRules = { sessionsToIncrease: number; fastTrackOnEasy: boolean; failSessionsToDrop: number; dropPercent: number }` (Р С•Р В±РЎР‰РЎРЏР Р†Р С‘ Р ВµР С–Р С• Р В·Р Т‘Р ВµРЎРѓРЎРЉ, Р Р† `gym/schema.ts`; Р С—Р С•Р В·Р В¶Р Вµ Р ВµР С–Р С• Р С‘Р СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµРЎвЂљ `progression`). Р СћР С‘Р С—Р С‘Р В·Р С‘РЎР‚РЎС“Р в„– jsonb РЎвЂЎР ВµРЎР‚Р ВµР В· `.$type<>()`.
- [x] **Р РЃР В°Р С– 9.** `src/shared/db/schema.ts` РЎР‚Р ВµРЎРЊР С”РЎРѓР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµРЎвЂљ РЎРѓРЎвЂ¦Р ВµР СРЎвЂ№ Р СР С•Р Т‘РЎС“Р В»Р ВµР в„– (`export * from '@/modules/gym/schema'`) РІР‚вЂќ РЎРЊРЎвЂљР С• Р ВµР Т‘Р С‘Р Р…РЎРѓРЎвЂљР Р†Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎвЂћР В°Р в„–Р В», Р С”Р С•РЎвЂљР С•РЎР‚Р С•Р СРЎС“ РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬РЎвЂР Р… Р С—РЎР‚РЎРЏР СР С•Р в„– Р С‘Р СР С—Р С•РЎР‚РЎвЂљ `schema.ts` Р СР С•Р Т‘РЎС“Р В»Р ВµР в„–. `src/shared/db/index.ts`: `postgres(env.DATABASE_URL)` + `drizzle(client, { schema })`.
- [x] **Р РЃР В°Р С– 10.** `drizzle.config.ts`: `schema: './src/shared/db/schema.ts'`, `out: './drizzle'`, dialect `postgresql`. Р РЋР С”РЎР‚Р С‘Р С—РЎвЂљРЎвЂ№: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:seed": "tsx scripts/seed.ts"`.
- [x] **Р РЃР В°Р С– 11.** `pnpm db:generate && pnpm db:migrate` РІвЂ вЂ™ Р Р† Р вЂР вЂќ Р ВµРЎРѓРЎвЂљРЎРЉ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ Р В° `gyms` (Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉ `docker compose -f docker/compose.dev.yml exec db psql -U app -d maxosipov -c '\dt'`).
- [x] **Р РЃР В°Р С– 12.** `src/modules/gym/index.ts` РЎРЊР С”РЎРѓР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµРЎвЂљ `gyms`, РЎвЂљР С‘Р С—РЎвЂ№ Р С‘ `getGym(): Promise<Gym>` (Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р в„– Р В·Р В°Р В»; Р ВµРЎРѓР В»Р С‘ Р Р…Р ВµРЎвЂљ РІР‚вЂќ Р В±РЎР‚Р С•РЎРѓР С‘РЎвЂљРЎРЉ `Error('Gym not seeded')`).
- [x] **Р РЃР В°Р С– 13.** `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–. Р С™Р С•Р СР СР С‘РЎвЂљ: `feat(db): env validation, drizzle, gyms table`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 3. Р СљР С•Р Т‘РЎС“Р В»Р С‘-РЎРѓР С”Р ВµР В»Р ВµРЎвЂљРЎвЂ№ Р С‘ Р С–РЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° Р С‘Р СР С—Р С•РЎР‚РЎвЂљР С•Р Р†

**Files:**
- Create: `src/modules/{auth,rbac,access,catalog,media,training,progression,coach-ai,trainer,notifications,body,landing}/index.ts` (Р С—РЎС“РЎРѓРЎвЂљР С•Р в„– `export {}`), `src/modules/README.md`
- Modify: `eslint.config.*`

**Interfaces:**
- Produces: Р С—РЎР‚Р В°Р Р†Р С‘Р В»Р С• Р В»Р С‘Р Р…РЎвЂљР ВµРЎР‚Р В°, Р В·Р В°Р С—РЎР‚Р ВµРЎвЂ°Р В°РЎР‹РЎвЂ°Р ВµР Вµ Р С–Р В»РЎС“Р В±Р С•Р С”Р С‘Р Вµ Р С‘Р СР С—Р С•РЎР‚РЎвЂљРЎвЂ№ Р СР С•Р Т‘РЎС“Р В»Р ВµР в„–.

- [ ] **Р РЃР В°Р С– 1.** Р РЋР С•Р В·Р Т‘Р В°Р в„– Р С—Р В°Р С—Р С”Р С‘ Р С‘ `index.ts` Р Т‘Р В»РЎРЏ Р Р†РЎРѓР ВµРЎвЂ¦ Р СР С•Р Т‘РЎС“Р В»Р ВµР в„– Р С‘Р В· `ARCHITECTURE.md` Р’В§6. `src/modules/README.md` РІР‚вЂќ Р С•Р Т‘Р Р…Р В° РЎвЂћРЎР‚Р В°Р В·Р В°: Р’В«Р С™Р В°Р В¶Р Т‘РЎвЂ№Р в„– Р СР С•Р Т‘РЎС“Р В»РЎРЉ Р С•РЎвЂљР Т‘Р В°РЎвЂРЎвЂљ Р Р…Р В°РЎР‚РЎС“Р В¶РЎС“ РЎвЂљР С•Р В»РЎРЉР С”Р С• `index.ts`. Р РЋР С. ARCHITECTURE.md Р’В§6Р’В».
- [ ] **Р РЃР В°Р С– 2.** Р вЂ™ ESLint Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ `no-restricted-imports` РЎРѓ `patterns: [{ group: ['@/modules/*/*'], message: 'Р ВР СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р в„– Р СР С•Р Т‘РЎС“Р В»РЎРЉ РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎвЂЎР ВµРЎР‚Р ВµР В· @/modules/<name>' }]`. Р ВРЎРѓР С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ (`overrides`/`ignores` Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• Р С—РЎР‚Р В°Р Р†Р С‘Р В»Р В°): РЎвЂћР В°Р в„–Р В»РЎвЂ№ Р Р†Р Р…РЎС“РЎвЂљРЎР‚Р С‘ РЎРѓР В°Р СР С•Р С–Р С• Р СР С•Р Т‘РЎС“Р В»РЎРЏ Р С‘Р СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“РЎР‹РЎвЂљ РЎРѓР Р†Р С•Р С‘ РЎвЂћР В°Р в„–Р В»РЎвЂ№ Р С•РЎвЂљР Р…Р С•РЎРѓР С‘РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р С Р С—РЎС“РЎвЂљРЎвЂР С `./x` РІР‚вЂќ РЎРЊРЎвЂљР С• Р Р…Р Вµ Р В·Р В°РЎвЂљРЎР‚Р В°Р С–Р С‘Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ; `src/shared/db/schema.ts` РІР‚вЂќ РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬РЎвЂР Р….
- [ ] **Р РЃР В°Р С– 3.** Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В°: Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…Р С• Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ Р Р† `src/modules/access/index.ts` РЎРѓРЎвЂљРЎР‚Р С•Р С”РЎС“ `import '@/modules/gym/schema'` РІвЂ вЂ™ `pnpm lint` Р Т‘Р С•Р В»Р В¶Р ВµР Р… РЎС“Р С—Р В°РЎРѓРЎвЂљРЎРЉ РЎРѓ РЎРЊРЎвЂљР С‘Р С РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р ВµР С. Р Р€Р Т‘Р В°Р В»Р С‘ РЎРѓРЎвЂљРЎР‚Р С•Р С”РЎС“ РІвЂ вЂ™ `pnpm lint` Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–.
- [ ] **Р РЃР В°Р С– 4.** Р С™Р С•Р СР СР С‘РЎвЂљ: `chore: module skeletons and import boundary rule`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 4. Р СћР ВµР СР В°, РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљРЎвЂ№, UI-Р С”Р С‘РЎвЂљ, Р СР В°РЎР‚РЎв‚¬РЎР‚РЎС“РЎвЂљР С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ РЎРѓР В°Р в„–РЎвЂљ/Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ

**Files:**
- Create: `src/shared/fonts/*.woff2`, `src/shared/fonts/index.ts`, `src/app/globals.css` (Р С—Р ВµРЎР‚Р ВµР С—Р С‘РЎРѓР В°РЎвЂљРЎРЉ), `src/shared/surface.ts`, `src/shared/surface.test.ts`, `src/middleware.ts`, `src/app/(site)/page.tsx`, `src/app/(site)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/app/page.tsx`, `src/app/(app)/app/dev/ui/page.tsx`, `src/components/ui/*` (shadcn)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `resolveSurface(host: string | null): 'site' | 'app'`; CSS-Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ Р С‘ Tailwind-Р С”Р В»Р В°РЎРѓРЎРѓРЎвЂ№ `bg-bg`, `bg-surface-1`, `bg-surface-2`, `border-border`, `text-text`, `text-text-secondary`, `text-text-muted`, `bg-accent`, `text-accent`, `text-gold`, `text-success`, `text-warning`, `text-danger`, РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљРЎвЂ№ `font-display` (Oswald) Р С‘ `font-sans` (Manrope). Р вЂ™Р Р…РЎС“РЎвЂљРЎР‚Р ВµР Р…Р Р…Р С‘Р в„– Р С—РЎС“РЎвЂљРЎРЉ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ РІР‚вЂќ Р С—РЎР‚Р ВµРЎвЂћР С‘Р С”РЎРѓ `/app` (middleware Р С—Р ВµРЎР‚Р ВµР С—Р С‘РЎРѓРЎвЂ№Р Р†Р В°Р ВµРЎвЂљ `app.maxosipov.ru/x` РІвЂ вЂ™ `/app/x`).

- [ ] **Р РЃР В°Р С– 1.** Р РЃРЎР‚Р С‘РЎвЂћРЎвЂљРЎвЂ№: `pnpm add -D @fontsource-variable/oswald @fontsource-variable/manrope`, РЎРѓР С”Р С•Р С—Р С‘РЎР‚РЎС“Р в„– Р С‘Р В· Р С‘РЎвЂ¦ `files/` Р Р† `src/shared/fonts/` РЎвЂћР В°Р в„–Р В»РЎвЂ№ `oswald-cyrillic-wght-normal.woff2`, `oswald-latin-wght-normal.woff2`, `manrope-cyrillic-wght-normal.woff2`, `manrope-latin-wght-normal.woff2`; Р В·Р В°РЎвЂљР ВµР С РЎС“Р Т‘Р В°Р В»Р С‘ РЎРЊРЎвЂљР С‘ Р Т‘Р Р†Р В° Р С—Р В°Р С”Р ВµРЎвЂљР В°. `src/shared/fonts/index.ts`: `next/font/local` РІвЂ вЂ™ `oswald` (variable `--font-display`) Р С‘ `manrope` (variable `--font-sans`), `display: 'swap'`.
- [ ] **Р РЃР В°Р С– 2.** `globals.css`: CSS-Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ Р Р†РЎРѓР ВµРЎвЂ¦ РЎвЂљР С•Р С”Р ВµР Р…Р С•Р Р† `DESIGN.md` Р’В§3 (Р С‘Р СР ВµР Р…Р В° = Р С‘Р СР ВµР Р…Р В° РЎвЂљР С•Р С”Р ВµР Р…Р С•Р Р†, Р Р…Р В°Р С—РЎР‚Р С‘Р СР ВµРЎР‚ `--surface-1: #17171A`), `html { color-scheme: dark; background: var(--bg) }`. Р РЋР Р†РЎРЏР В¶Р С‘ РЎРѓ Tailwind (Р Р† Tailwind v4 РІР‚вЂќ РЎвЂЎР ВµРЎР‚Р ВµР В· `@theme`, Р Р† v3 РІР‚вЂќ РЎвЂЎР ВµРЎР‚Р ВµР В· `tailwind.config` `extend.colors`; Р Р†РЎвЂ№РЎРЏРЎРѓР Р…Р С‘ Р Р†Р ВµРЎР‚РЎРѓР С‘РЎР‹ Р Р† `package.json`). Р РЋР С”РЎР‚РЎС“Р С–Р В»Р ВµР Р…Р С‘РЎРЏ: `--radius-control: 12px`, `--radius-card: 16px`, `--radius-sheet: 24px`.
- [ ] **Р РЃР В°Р С– 3.** `pnpm dlx shadcn@latest init` (РЎРѓРЎвЂљР С‘Р В»РЎРЉ Р С—Р С• РЎС“Р СР С•Р В»РЎвЂЎР В°Р Р…Р С‘РЎР‹, Р В±Р В°Р В·Р С•Р Р†РЎвЂ№Р в„– РЎвЂ Р Р†Р ВµРЎвЂљ neutral, CSS-Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ РІР‚вЂќ Р Т‘Р В°), Р В·Р В°РЎвЂљР ВµР С Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ Р С”Р С•Р СР С—Р С•Р Р…Р ВµР Р…РЎвЂљРЎвЂ№: `button input label card sheet dialog sonner tabs switch`. Р СџР С•РЎРѓР В»Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С—Р ВµРЎР‚Р ВµР С”РЎР‚Р В°РЎРѓРЎРЉ Р С‘РЎвЂ¦ Р Р…Р В° Р Р…Р В°РЎв‚¬Р С‘ РЎвЂљР С•Р С”Р ВµР Р…РЎвЂ№ (Р С”Р Р…Р С•Р С—Р С”Р В° primary = `bg-accent`, hover `--accent-pressed`; Р Р†РЎвЂ№РЎРѓР С•РЎвЂљР В° Р С”Р Р…Р С•Р С—Р С”Р С‘ 48px; РЎР‚Р В°Р Т‘Р С‘РЎС“РЎРѓ 12px).
- [ ] **Р РЃР В°Р С– 4.** Р СџР В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘Р в„– РЎвЂљР ВµРЎРѓРЎвЂљ `src/shared/surface.test.ts`:
  ```ts
  import { resolveSurface } from './surface'
  test.each([
    ['maxosipov.ru', 'site'], ['www.maxosipov.ru', 'site'], ['MAXOSIPOV.RU', 'site'],
    ['app.maxosipov.ru', 'app'], ['APP.maxosipov.ru:443', 'app'],
    ['localhost:3000', 'site'], ['app.localhost:3000', 'app'], [null, 'site'],
  ])('%s -> %s', (host, expected) => expect(resolveSurface(host)).toBe(expected))
  ```
- [ ] **Р РЃР В°Р С– 5.** `src/shared/surface.ts`: Р С—РЎР‚Р С‘Р Р†Р С•Р Т‘Р С‘РЎвЂљ Р С” Р Р…Р С‘Р В¶Р Р…Р ВµР СРЎС“ РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚РЎС“, Р С•РЎвЂљРЎР‚Р ВµР В·Р В°Р ВµРЎвЂљ Р С—Р С•РЎР‚РЎвЂљ, `app` Р ВµРЎРѓР В»Р С‘ РЎвЂ¦Р С•РЎРѓРЎвЂљ Р Р…Р В°РЎвЂЎР С‘Р Р…Р В°Р ВµРЎвЂљРЎРѓРЎРЏ РЎРѓ `app.`, Р С‘Р Р…Р В°РЎвЂЎР Вµ `site`. Р СћР ВµРЎРѓРЎвЂљ РІвЂ вЂ™ PASS.
- [ ] **Р РЃР В°Р С– 6.** `src/middleware.ts`: Р ВµРЎРѓР В»Р С‘ `resolveSurface(host) === 'app'` Р С‘ Р С—РЎС“РЎвЂљРЎРЉ Р Р…Р Вµ Р Р…Р В°РЎвЂЎР С‘Р Р…Р В°Р ВµРЎвЂљРЎРѓРЎРЏ РЎРѓ `/app`, `/api`, `/_next`, `/media` Р С‘ Р Р…Р Вµ РЎРЏР Р†Р В»РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ РЎвЂћР В°Р в„–Р В»Р С•Р С (Р Р† Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р ВµР С РЎРѓР ВµР С–Р СР ВµР Р…РЎвЂљР Вµ Р С—РЎС“РЎвЂљР С‘ Р ВµРЎРѓРЎвЂљРЎРЉ РЎвЂљР С•РЎвЂЎР С”Р В°: `/sw.js`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/figure/front.svg`) РІР‚вЂќ `NextResponse.rewrite` Р Р…Р В° `/app` + Р С—РЎС“РЎвЂљРЎРЉ. Р вЂќР С•Р В±Р В°Р Р†РЎРЉ РЎРЊРЎвЂљР С‘ РЎРѓР В»РЎС“РЎвЂЎР В°Р С‘ Р Р† РЎвЂљР ВµРЎРѓРЎвЂљ (Р Р†РЎвЂ№Р Р…Р ВµРЎРѓР С‘ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘Р Вµ Р Р† РЎвЂЎР С‘РЎРѓРЎвЂљРЎС“РЎР‹ РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘РЎР‹ `rewriteTarget(surface, pathname): string | null` Р Р† `surface.ts`: `('app','/workouts')РІвЂ вЂ™'/app/workouts'`, `('app','/sw.js')РІвЂ вЂ™null`, `('app','/media/2026/11/x/video.mp4')РІвЂ вЂ™null`, `('app','/api/health')РІвЂ вЂ™null`, `('site','/app/x')РІвЂ вЂ™'/404'`, `('site','/')РІвЂ вЂ™null`). Р вЂўРЎРѓР В»Р С‘ РЎвЂ¦Р С•РЎРѓРЎвЂљ `www.maxosipov.ru` РІР‚вЂќ 308 РЎР‚Р ВµР Т‘Р С‘РЎР‚Р ВµР С”РЎвЂљ Р Р…Р В° `https://maxosipov.ru` + Р С—РЎС“РЎвЂљРЎРЉ. Р вЂўРЎРѓР В»Р С‘ surface `site` Р С‘ Р С—РЎС“РЎвЂљРЎРЉ Р Р…Р В°РЎвЂЎР С‘Р Р…Р В°Р ВµРЎвЂљРЎРѓРЎРЏ РЎРѓ `/app` РІР‚вЂќ 404 (`NextResponse.rewrite('/404')`).
- [ ] **Р РЃР В°Р С– 7.** Р РЋРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎвЂ№-Р В·Р В°Р С–Р В»РЎС“РЎв‚¬Р С”Р С‘: `(site)/page.tsx` РІР‚вЂќ Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С•Р С” Р’В«Р СљР В°Р С”РЎРѓР С‘Р С Р С›РЎРѓР С‘Р С—Р С•Р Р†Р’В» РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљР С•Р С `font-display`; `(app)/app/page.tsx` РІР‚вЂќ Р’В«Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р СљР В°Р С”РЎРѓР ВР ВР С РІР‚вЂќ РЎРѓР С”Р С•РЎР‚Р С•Р’В». `(app)/app/dev/ui/page.tsx` РІР‚вЂќ Р Р†Р С‘РЎвЂљРЎР‚Р С‘Р Р…Р В°: Р Р†РЎРѓР Вµ РЎвЂ Р Р†Р ВµРЎвЂљР В° РЎвЂљР С•Р С”Р ВµР Р…Р С•Р Р† Р С—Р В»Р В°РЎв‚¬Р С”Р В°Р СР С‘ РЎРѓ Р С—Р С•Р Т‘Р С—Р С‘РЎРѓРЎРЏР СР С‘, Р С•Р В±Р В° РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљР В°, Р С”Р Р…Р С•Р С—Р С”Р С‘, Р С—Р С•Р В»Р Вµ, Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°, Р В»Р С‘РЎРѓРЎвЂљ РЎРѓР Р…Р С‘Р В·РЎС“; РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° Р С•РЎвЂљР Т‘Р В°РЎвЂРЎвЂљ 404 Р С—РЎР‚Р С‘ `NODE_ENV === 'production'` (`notFound()`).
- [ ] **Р РЃР В°Р С– 8.** Р С™Р С•РЎР‚Р Р…Р ВµР Р†Р С•Р в„– `layout.tsx`: `lang="ru"`, Р С”Р В»Р В°РЎРѓРЎРѓРЎвЂ№ РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљР С•Р Р†, `bg-bg text-text`, `<meta name="theme-color" content="#0E0E10">`.
- [ ] **Р РЃР В°Р С– 9.** Р В РЎС“Р С”Р В°Р СР С‘: `pnpm dev`, Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ `http://localhost:3000` (РЎРѓР В°Р в„–РЎвЂљ) Р С‘ `http://app.localhost:3000` (Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ), `http://app.localhost:3000/dev/ui` (Р Р†Р С‘РЎвЂљРЎР‚Р С‘Р Р…Р В°). Р РЋР Т‘Р ВµР В»Р В°Р в„– РЎРѓР С”РЎР‚Р С‘Р Р…РЎв‚¬Р С•РЎвЂљРЎвЂ№ Р Р…Р В° 375 px Р Р† `docs/reports/assets/00-*.png`.
- [ ] **Р РЃР В°Р С– 10.** `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–. Р С™Р С•Р СР СР С‘РЎвЂљ: `feat(ui): theme tokens, fonts, shadcn kit, host-based routing`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 5. Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р С‘, РЎР‚Р С•Р В»Р С‘ Р С‘ Р С—РЎР‚Р В°Р Р†Р В° (`rbac`), РЎРѓР С‘Р Т‘

**Files:**
- Create: `src/modules/auth/schema.ts` (РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ Р В° `users` Р Р…Р В° РЎРЊРЎвЂљР С•Р С РЎРЊРЎвЂљР В°Р С—Р Вµ), `src/modules/rbac/permissions.ts`, `src/modules/rbac/schema.ts`, `src/modules/rbac/check.ts`, `src/modules/rbac/check.test.ts`, `src/modules/rbac/service.ts`, `src/modules/rbac/service.test.ts`, `src/modules/rbac/defaults.ts`, `src/modules/rbac/errors.ts`, `scripts/seed.ts`, `tests/db.ts`
- Modify: `src/modules/rbac/index.ts`, `src/modules/auth/index.ts`, `src/shared/db/schema.ts`

**Interfaces:**
- Produces:
  - `PERMISSIONS` РІР‚вЂќ `as const` Р СР В°РЎРѓРЎРѓР С‘Р Р† Р С”Р С•Р Т‘Р С•Р Р† РЎР‚Р С•Р Р†Р Р…Р С• Р С‘Р В· `ARCHITECTURE.md` Р’В§8.3 (16 Р С”Р С•Р Т‘Р С•Р Р†); `type Permission = typeof PERMISSIONS[number]`; `type Scope = 'own' | 'all'`; `type RolePermission = { code: Permission; scope: Scope }`.
  - Р СћР В°Р В±Р В»Р С‘РЎвЂ РЎвЂ№: `users` (Р С”Р С•Р В»Р С•Р Р…Р С”Р С‘ Р’В§7, `role_id` fk РІвЂ вЂ™ `roles.id`, `trainer_id` fk РІвЂ вЂ™ `users.id` nullable, `phone` unique), `roles` (`name` unique, `is_system` bool, `permissions` jsonb `RolePermission[]`), `role_audit`.
  - Р СћР С‘Р С— `Actor = { id: string; roleId: string; gymId: string; isOwner: boolean; permissions: RolePermission[] }`.
  - Р В§Р С‘РЎРѓРЎвЂљР В°РЎРЏ РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ `checkPermission(actor: Actor, perm: Permission, target?: { clientTrainerId: string | null; clientId: string }): boolean` (РЎвЂћР В°Р в„–Р В» `check.ts`).
  - `can(actor, perm, target?)` = `checkPermission`; `assertCan(...)` Р В±РЎР‚Р С•РЎРѓР В°Р ВµРЎвЂљ `ForbiddenError` (Р С”Р В»Р В°РЎРѓРЎРѓ Р Р† `errors.ts`, `name = 'ForbiddenError'`, `status = 403`).
  - Р РЋР ВµРЎР‚Р Р†Р С‘РЎРѓ (`service.ts`): `loadActor(userId: string): Promise<Actor>`, `createRole(actor, input: { name: string; permissions: RolePermission[] }): Promise<Role>`, `updateRole(actor, roleId, input)`, `deleteRole(actor, roleId)`, `assignRole(actor, userId, roleId)`. Р вЂ™РЎРѓР Вµ Р С—Р С‘РЎв‚¬РЎС“РЎвЂљ `role_audit`.
  - `DEFAULT_ROLES` Р Р† `defaults.ts` РІР‚вЂќ 5 РЎР‚Р С•Р В»Р ВµР в„– Р С‘Р В· `ARCHITECTURE.md` Р’В§8.3 РЎРѓ Р С‘Р СР ВµР Р…Р В°Р СР С‘: `Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ ` (`is_system: true`), `Р вЂњР В»Р В°Р Р†Р Р…РЎвЂ№Р в„– РЎвЂљРЎР‚Р ВµР Р…Р ВµРЎР‚`, `Р СћРЎР‚Р ВµР Р…Р ВµРЎР‚`, `Р С’Р Т‘Р СР С‘Р Р…Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂљР С•РЎР‚ Р В·Р В°Р В»Р В°`, `Р С™Р В»Р С‘Р ВµР Р…РЎвЂљ`.

- [ ] **Р РЃР В°Р С– 1.** Р РЋРЎвЂ¦Р ВµР СРЎвЂ№ `users`, `roles`, `role_audit`, Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ Р Р† `src/shared/db/schema.ts`. `pnpm db:generate && pnpm db:migrate`.
- [ ] **Р РЃР В°Р С– 2.** Р СџР В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘Р Вµ РЎвЂљР ВµРЎРѓРЎвЂљРЎвЂ№ `check.test.ts`:
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
- [ ] **Р РЃР В°Р С– 3.** Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘ РІвЂ вЂ™ FAIL. Р В Р ВµР В°Р В»Р С‘Р В·РЎС“Р в„– `permissions.ts`, `check.ts`. РІвЂ вЂ™ PASS.
- [ ] **Р РЃР В°Р С– 4.** `tests/db.ts`: РЎвЂ¦Р ВµР В»Р С—Р ВµРЎР‚ `resetDb()` РІР‚вЂќ `TRUNCATE` Р Р†РЎРѓР ВµРЎвЂ¦ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ  `CASCADE` Р Р† РЎвЂљР ВµРЎРѓРЎвЂљР С•Р Р†Р С•Р в„– Р вЂР вЂќ `maxosipov_test` (РЎРѓР С•Р В·Р Т‘Р В°Р в„– Р ВµРЎвЂ Р Р† dev-Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚Р Вµ; `DATABASE_URL` Р Т‘Р В»РЎРЏ РЎвЂљР ВµРЎРѓРЎвЂљР С•Р Р† Р В±Р ВµРЎР‚РЎвЂРЎвЂљРЎРѓРЎРЏ Р С‘Р В· `TEST_DATABASE_URL`, Р ВµРЎРѓР В»Р С‘ Р В·Р В°Р Т‘Р В°Р Р…). Р СћР ВµРЎРѓРЎвЂљРЎвЂ№ РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓР В° Р В·Р В°Р С—РЎС“РЎРѓР С”Р В°РЎР‹РЎвЂљРЎРѓРЎРЏ Р С—Р С•РЎРѓР В»Р ВµР Т‘Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉР Р…Р С• (`fileParallelism: false` Р Т‘Р В»РЎРЏ РЎвЂћР В°Р в„–Р В»Р С•Р Р† `*.service.test.ts` Р С‘Р В»Р С‘ `--no-file-parallelism`).
- [ ] **Р РЃР В°Р С– 5.** Р СџР В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘Р Вµ РЎвЂљР ВµРЎРѓРЎвЂљРЎвЂ№ `service.test.ts` (Р С—Р ВµРЎР‚Р ВµР Т‘ Р С”Р В°Р В¶Р Т‘РЎвЂ№Р С РІР‚вЂќ `resetDb()` + РЎРѓР С‘Р Т‘ РЎР‚Р С•Р В»Р ВµР в„–):
  - `deleteRole` Р Т‘Р В»РЎРЏ РЎР‚Р С•Р В»Р С‘ Р’В«Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ Р’В» РІвЂ вЂ™ Р В±РЎР‚Р С•РЎРѓР В°Р ВµРЎвЂљ `ForbiddenError`;
  - `updateRole` Р Т‘Р В»РЎРЏ Р’В«Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ Р’В» (Р В»РЎР‹Р В±Р С•Р Вµ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘Р Вµ Р С‘Р СР ВµР Р…Р С‘/Р С—РЎР‚Р В°Р Р†) РІвЂ вЂ™ `ForbiddenError`;
  - `assignRole`, РЎРѓР Р…Р С‘Р СР В°РЎР‹РЎвЂ°Р С‘Р в„– РЎР‚Р С•Р В»РЎРЉ Р’В«Р вЂ™Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ Р’В» РЎРѓ Р ВµР Т‘Р С‘Р Р…РЎРѓРЎвЂљР Р†Р ВµР Р…Р Р…Р С•Р С–Р С• Р Р†Р В»Р В°Р Т‘Р ВµР В»РЎРЉРЎвЂ Р В° РІвЂ вЂ™ `ForbiddenError` РЎРѓ РЎвЂљР ВµР С”РЎРѓРЎвЂљР С•Р С `Р СњР ВµР В»РЎРЉР В·РЎРЏ РЎРѓР Р…РЎРЏРЎвЂљРЎРЉ Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р ВµР С–Р С• Р Р†Р В»Р В°Р Т‘Р ВµР В»РЎРЉРЎвЂ Р В°`;
  - `createRole` Р В°Р С”РЎвЂљР С•РЎР‚Р С•Р С Р В±Р ВµР В· `roles.manage` РІвЂ вЂ™ `ForbiddenError`;
  - `createRole` Р Р†Р В»Р В°Р Т‘Р ВµР В»РЎРЉРЎвЂ Р ВµР С РІвЂ вЂ™ РЎР‚Р С•Р В»РЎРЉ РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р В°, Р Р† `role_audit` 1 Р В·Р В°Р С—Р С‘РЎРѓРЎРЉ РЎРѓ `action = 'role.create'`;
  - `createRole` РЎРѓ Р Р…Р ВµР С‘Р В·Р Р†Р ВµРЎРѓРЎвЂљР Р…РЎвЂ№Р С Р С”Р С•Р Т‘Р С•Р С Р С—РЎР‚Р В°Р Р†Р В° РІвЂ вЂ™ Р С•РЎв‚¬Р С‘Р В±Р С”Р В° Р Р†Р В°Р В»Р С‘Р Т‘Р В°РЎвЂ Р С‘Р С‘ (Zod).
- [ ] **Р РЃР В°Р С– 6.** Р В Р ВµР В°Р В»Р С‘Р В·РЎС“Р в„– `service.ts` РІвЂ вЂ™ PASS.
- [ ] **Р РЃР В°Р С– 7.** `scripts/seed.ts` (Р С‘Р Т‘Р ВµР СР С—Р С•РЎвЂљР ВµР Р…РЎвЂљР Р…РЎвЂ№Р в„– РІР‚вЂќ `onConflictDoNothing`/upsert Р С—Р С• РЎС“Р Р…Р С‘Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р С Р С—Р С•Р В»РЎРЏР С): Р В·Р В°Р В» Р’В«Р С™Р С•Р В»Р С‘Р В·Р ВµР в„–Р’В» (`name: 'Р С™Р С•Р В»Р С‘Р В·Р ВµР в„–'`, `address: 'Р С™РЎР‚Р В°РЎРѓР Р…Р С•РЎРЏРЎР‚РЎРѓР С”, РЎС“Р В». Р вЂњР С•Р Р†Р С•РЎР‚Р С•Р Р†Р В°'`, `brand: { name: 'Р СљР В°Р С”РЎРѓР С‘Р С Р С›РЎРѓР С‘Р С—Р С•Р Р†', shortName: 'Р СљР В°Р С”РЎРѓР ВР ВР С', colors: { accent: '#E5322D' }, logoUrl: null }`, `settings: { trialDays: 30, subscriptionPriceRub: null, aiDailyLimit: 30, progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 }, aiMemo: '' }`); `DEFAULT_ROLES`; Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р С‘ Р С‘Р В· `docs/plans/README.md` (Р’В«Р СћР ВµРЎРѓРЎвЂљР С•Р Р†РЎвЂ№Р Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р ВµР’В»): Р Р†Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ , Р СљР В°Р С”РЎРѓР С‘Р С (`trainer_id` РЎС“ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР С•Р Р† = Р СљР В°Р С”РЎРѓР С‘Р С), 5 Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР С•Р Р† РЎРѓ РЎР‚Р С•Р В»РЎРЉРЎР‹ Р’В«Р С™Р В»Р С‘Р ВµР Р…РЎвЂљР’В».
- [ ] **Р РЃР В°Р С– 8.** `pnpm db:seed` Р Т‘Р Р†Р В° РЎР‚Р В°Р В·Р В° Р С—Р С•Р Т‘РЎР‚РЎРЏР Т‘ РІвЂ вЂ™ Р В±Р ВµР В· Р С•РЎв‚¬Р С‘Р В±Р С•Р С”, Р С”Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р С• РЎРѓРЎвЂљРЎР‚Р С•Р С” Р Р…Р Вµ Р СР ВµР Р…РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ (Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉ `select count(*) from users` = 7, `roles` = 5).
- [ ] **Р РЃР В°Р С– 9.** `rbac/index.ts` РЎРЊР С”РЎРѓР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµРЎвЂљ `PERMISSIONS`, РЎвЂљР С‘Р С—РЎвЂ№, `can`, `assertCan`, `ForbiddenError`, РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘Р С‘ РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓР В°, `DEFAULT_ROLES`. `auth/index.ts` РЎРЊР С”РЎРѓР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµРЎвЂљ РЎвЂљР В°Р В±Р В»Р С‘РЎвЂ РЎС“ `users` Р С‘ РЎвЂљР С‘Р С— `User`.
- [ ] **Р РЃР В°Р С– 10.** `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–. Р С™Р С•Р СР СР С‘РЎвЂљ: `feat(rbac): permissions, roles, audit, seed`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 6. PWA-Р С•Р В±Р С•Р В»Р С•РЎвЂЎР С”Р В°

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png`, `src/app/(app)/app/offline/page.tsx`, `src/app/sw.ts`, `scripts/make-icons.ts`
- Modify: `next.config.*`

**Interfaces:**
- Produces: РЎС“РЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР СР С•Р Вµ PWA Р Р…Р В° `app.maxosipov.ru`, service worker `/sw.js`, Р С•РЎвЂћР В»Р В°Р в„–Р Р…-РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° `/app/offline`.

- [ ] **Р РЃР В°Р С– 1.** `public/icons/icon.svg`: Р С”Р Р†Р В°Р Т‘РЎР‚Р В°РЎвЂљ 512, РЎвЂћР С•Р Р… `#0E0E10`, Р С—Р С• РЎвЂ Р ВµР Р…РЎвЂљРЎР‚РЎС“ Р СР С•Р Р…Р С•Р С–РЎР‚Р В°Р СР СР В° Р’В«Р СљР С›Р’В» РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљР С•Р С Oswald 500 РЎвЂ Р Р†Р ВµРЎвЂљР В° `#F5F5F7` (РЎвЂљР ВµР С”РЎРѓРЎвЂљ Р С—Р ВµРЎР‚Р ВµР Р†Р ВµР Т‘Р С‘ Р Р† Р С”РЎР‚Р С‘Р Р†РЎвЂ№Р Вµ Р Р…Р Вµ Р Р…РЎС“Р В¶Р Р…Р С• РІР‚вЂќ Р Т‘Р С•Р С—РЎС“РЎРѓР С”Р В°Р ВµРЎвЂљРЎРѓРЎРЏ `<text>` РЎРѓ `font-family="Oswald"`; РЎР‚Р В°РЎРѓРЎвЂљР ВµРЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р Р† РЎв‚¬Р В°Р С–Р Вµ 2 Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµРЎвЂљ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљ), Р С—Р С•Р Т‘ Р Р…Р ВµР в„– РЎвЂљР С•Р Р…Р С”Р В°РЎРЏ Р В»Р С‘Р Р…Р С‘РЎРЏ `#E5322D` РЎв‚¬Р С‘РЎР‚Р С‘Р Р…Р С•Р в„– 120 Р С‘ РЎвЂљР С•Р В»РЎвЂ°Р С‘Р Р…Р С•Р в„– 6.
- [ ] **Р РЃР В°Р С– 2.** `pnpm add -D sharp`; `scripts/make-icons.ts` РЎР‚Р В°РЎРѓРЎвЂљР ВµРЎР‚Р С‘Р В·РЎС“Р ВµРЎвЂљ svg Р Р† 192, 512, maskable 512 (РЎРѓ Р С—Р С•Р В»РЎРЏР СР С‘ 10%), apple-touch 180. Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘, PNG Р В·Р В°Р С”Р С•Р СР СР С‘РЎвЂљРЎРЉ. Р вЂўРЎРѓР В»Р С‘ РЎв‚¬РЎР‚Р С‘РЎвЂћРЎвЂљ Р Р† svg Р Р…Р Вµ Р С—Р С•Р Т‘РЎвЂ¦Р Р†Р В°РЎвЂљРЎвЂ№Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ РІР‚вЂќ Р С—Р ВµРЎР‚Р ВµР Р†Р ВµР Т‘Р С‘ Р СР С•Р Р…Р С•Р С–РЎР‚Р В°Р СР СРЎС“ Р Р† Р С”Р С•Р Р…РЎвЂљРЎС“РЎР‚РЎвЂ№ Р Р†РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹ Р С‘ Р С•Р С—Р С‘РЎв‚¬Р С‘ Р Р† Р С•РЎвЂљРЎвЂЎРЎвЂРЎвЂљР Вµ.
- [ ] **Р РЃР В°Р С– 3.** `src/app/manifest.ts`: `name: 'Р СљР В°Р С”РЎРѓР ВР ВР С РІР‚вЂќ РЎвЂљРЎР‚Р ВµР Р…Р С‘РЎР‚Р С•Р Р†Р С”Р С‘ РЎРѓ Р СљР В°Р С”РЎРѓР С‘Р СР С•Р С'`, `short_name: 'Р СљР В°Р С”РЎРѓР ВР ВР С'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `background_color` Р С‘ `theme_color` `#0E0E10`, `lang: 'ru'`, Р С‘Р С”Р С•Р Р…Р С”Р С‘ Р С‘Р В· РЎв‚¬Р В°Р С–Р В° 2 (maskable РЎРѓ `purpose: 'maskable'`).
- [ ] **Р РЃР В°Р С– 4.** Serwist: РЎС“РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘ Р С—Р В°Р С”Р ВµРЎвЂљРЎвЂ№ Р С—Р С• Р С•РЎвЂћР С‘РЎвЂ Р С‘Р В°Р В»РЎРЉР Р…Р С•Р в„– Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘Р С‘ Р Т‘Р В»РЎРЏ Next.js App Router (`@serwist/next`, `serwist`), Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР С‘ Р Р† `next.config`, `src/app/sw.ts` РІР‚вЂќ precache РЎРѓР В±Р С•РЎР‚Р С”Р С‘ + `defaultCache`; fallback Р Т‘Р В»РЎРЏ Р Т‘Р С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР С•Р Р† РІР‚вЂќ `/app/offline`. Р вЂ™ dev SW Р С•РЎвЂљР С”Р В»РЎР‹РЎвЂЎРЎвЂР Р….
- [ ] **Р РЃР В°Р С– 5.** Р С›РЎвЂћР В»Р В°Р в„–Р Р…-РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В°: Р’В«Р СњР ВµРЎвЂљ РЎРѓР ВµРЎвЂљР С‘. Р СћРЎР‚Р ВµР Р…Р С‘РЎР‚Р С•Р Р†Р С”Р В° Р С‘ Р С—Р С•Р Т‘РЎвЂ¦Р С•Р Т‘РЎвЂ№ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ РІР‚вЂќ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†РЎРЏРЎвЂљРЎРѓРЎРЏ РЎРѓР В°Р СР С‘, Р С”Р С•Р С–Р Т‘Р В° Р С—Р С•РЎРЏР Р†Р С‘РЎвЂљРЎРѓРЎРЏ РЎРѓР Р†РЎРЏР В·РЎРЉ.Р’В»
- [ ] **Р РЃР В°Р С– 6.** Р В РЎС“Р С”Р В°Р СР С‘: `pnpm build && pnpm start`, Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ `http://app.localhost:3000` Р Р† Chrome РІвЂ вЂ™ DevTools РІвЂ вЂ™ Application: manifest Р В±Р ВµР В· Р С•РЎв‚¬Р С‘Р В±Р С•Р С”, SW Р В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р…; Р Р†Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Offline, Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“ РІвЂ вЂ™ Р С•РЎвЂћР В»Р В°Р в„–Р Р…-РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В°.
- [ ] **Р РЃР В°Р С– 7.** `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–. Р С™Р С•Р СР СР С‘РЎвЂљ: `feat(pwa): manifest, icons, service worker, offline page`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 7. Health-check, worker, Docker-Р С•Р В±РЎР‚Р В°Р В·

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/health/health.test.ts`, `src/shared/health.ts`, `src/worker/index.ts`, `src/worker/jobs.ts`, `docker/Dockerfile`, `docker/compose.yml`, `docker/Caddyfile`, `.dockerignore`
- Modify: `next.config.*` (`output: 'standalone'`), `package.json` (`"worker": "tsx src/worker/index.ts"`)

**Interfaces:**
- Produces: `checkHealth(ping: () => Promise<void>, timeoutMs = 2000): Promise<{ ok: boolean; db: 'up' | 'down' }>` (`src/shared/health.ts`); `GET /api/health` РІвЂ вЂ™ 200 `{ok:true,db:'up'}` Р С‘Р В»Р С‘ 503 `{ok:false,db:'down'}`; `startWorker(): Promise<void>` РЎРѓ pg-boss Р С‘ РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘Р ВµР в„– Р В·Р В°Р Т‘Р В°РЎвЂЎ Р С‘Р В· `jobs.ts` (РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ Р С•Р Т‘Р Р…Р В°: `heartbeat` РЎР‚Р В°Р В· Р Р† 10 Р СР С‘Р Р…РЎС“РЎвЂљ Р С—Р С‘РЎв‚¬Р ВµРЎвЂљ Р Р† Р В»Р С•Р С–).

- [ ] **Р РЃР В°Р С– 1.** Р СџР В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘Р в„– РЎвЂљР ВµРЎРѓРЎвЂљ `health.test.ts`: `checkHealth(async () => {})` РІвЂ вЂ™ `{ok:true, db:'up'}`; `checkHealth(() => new Promise(() => {}), 50)` РІвЂ вЂ™ `{ok:false, db:'down'}` (Р Р…Р Вµ Р Р†Р С‘РЎРѓР Р…Р ВµРЎвЂљ); `checkHealth(async () => { throw new Error('x') })` РІвЂ вЂ™ `down`.
- [ ] **Р РЃР В°Р С– 2.** Р В Р ВµР В°Р В»Р С‘Р В·РЎС“Р в„– `checkHealth` РЎвЂЎР ВµРЎР‚Р ВµР В· `Promise.race` РЎРѓ РЎвЂљР В°Р в„–Р СР В°РЎС“РЎвЂљР С•Р С; route Р Р†РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµРЎвЂљ Р ВµРЎвЂ РЎРѓ `db.execute(sql\`select 1\`)`. РІвЂ вЂ™ PASS.
- [ ] **Р РЃР В°Р С– 3.** `pnpm add pg-boss`. `src/worker/index.ts`: РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ `PgBoss(env.DATABASE_URL)`, `start()`, Р В·Р В°РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р В·Р В°Р Т‘Р В°РЎвЂЎР С‘, Р С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р С• Р С•РЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р С—Р С• `SIGTERM`. Р РЋР Р†Р ВµРЎР‚РЎРЉ API РЎРѓ README РЎС“РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р Р…Р С•Р в„– Р Р†Р ВµРЎР‚РЎРѓР С‘Р С‘ pg-boss (`schedule`, `work`) РІР‚вЂќ Р Р…Р Вµ Р Р†РЎвЂ№Р Т‘РЎС“Р СРЎвЂ№Р Р†Р В°Р в„–.
- [ ] **Р РЃР В°Р С– 4.** `docker/Dockerfile` РІР‚вЂќ multi-stage: `deps` (pnpm install --frozen-lockfile), `build` (`pnpm build`), `runner` Р Р…Р В° `node:22-alpine` РЎРѓ `ffmpeg` (`apk add ffmpeg`) РІР‚вЂќ Р С—Р С•Р Р…Р В°Р Т‘Р С•Р В±Р С‘РЎвЂљРЎРѓРЎРЏ worker'РЎС“; Р С”Р С•Р С—Р С‘РЎР‚РЎС“Р ВµРЎвЂљ `.next/standalone`, `.next/static`, `public`, `drizzle`, `src/worker`, `node_modules` Р Р…РЎС“Р В¶Р Р…РЎвЂ№Р Вµ Р Т‘Р В»РЎРЏ worker (Р Т‘Р С•Р С—РЎС“РЎРѓРЎвЂљР С‘Р СР С• Р С”Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р Р†Р ВµРЎРѓРЎРЉ `node_modules` Р С‘Р В· `deps` РІР‚вЂќ Р С•Р С—Р С‘РЎв‚¬Р С‘ Р Р† Р С•РЎвЂљРЎвЂЎРЎвЂРЎвЂљР Вµ РЎР‚Р В°Р В·Р СР ВµРЎР‚ Р С•Р В±РЎР‚Р В°Р В·Р В°). `CMD` Р С—Р С• РЎС“Р СР С•Р В»РЎвЂЎР В°Р Р…Р С‘РЎР‹ РІР‚вЂќ `node server.js`.
- [ ] **Р РЃР В°Р С– 5.** `docker/compose.yml`:
  - `db`: `postgres:17-alpine`, РЎвЂљР С•Р С `/data/postgres`, Р В±Р ВµР В· Р С—РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂ Р С‘Р С‘ Р С—Р С•РЎР‚РЎвЂљР В° Р Р…Р В°РЎР‚РЎС“Р В¶РЎС“, healthcheck `pg_isready`;
  - `web`: Р С•Р В±РЎР‚Р В°Р В· Р С‘Р В· Dockerfile, `env_file: ../.env`, depends_on db (healthy), Р С”Р С•Р СР В°Р Р…Р Т‘Р В° РІР‚вЂќ Р С—Р ВµРЎР‚Р ВµР Т‘ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР С•Р С `pnpm`-Р Р…Р ВµР В·Р В°Р Р†Р С‘РЎРѓР С‘Р СР В°РЎРЏ Р СР С‘Р С–РЎР‚Р В°РЎвЂ Р С‘РЎРЏ: `node scripts/migrate.js` (РЎРѓР С•Р В·Р Т‘Р В°Р в„– `scripts/migrate.ts` РІвЂ вЂ™ Р С”Р С•Р СР С—Р С‘Р В»Р С‘РЎР‚РЎС“Р ВµРЎвЂљРЎРѓРЎРЏ Р Р† Р С•Р В±РЎР‚Р В°Р В·; Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµРЎвЂљ `drizzle-orm/postgres-js/migrator`), Р В·Р В°РЎвЂљР ВµР С `node server.js`;
  - `worker`: РЎвЂљР С•РЎвЂљ Р В¶Р Вµ Р С•Р В±РЎР‚Р В°Р В·, Р С”Р С•Р СР В°Р Р…Р Т‘Р В° `node --import tsx src/worker/index.ts` (Р С‘Р В»Р С‘ РЎРѓР С”Р С•Р СР С—Р С‘Р В»Р С‘РЎР‚РЎС“Р в„– worker Р С•РЎвЂљР Т‘Р ВµР В»РЎРЉР Р…Р С• РІР‚вЂќ Р Р†РЎвЂ№Р В±Р ВµРЎР‚Р С‘ Р С‘ Р С•Р С—Р С‘РЎв‚¬Р С‘ Р Р† Р С•РЎвЂљРЎвЂЎРЎвЂРЎвЂљР Вµ), РЎвЂљР С•Р С `/data/media`;
  - `caddy`: `caddy:2-alpine`, Р С—Р С•РЎР‚РЎвЂљРЎвЂ№ 80/443, РЎвЂљР С•Р СР В° `caddy_data`, `caddy_config`, `/data/media:/srv/media:ro`, `./Caddyfile:/etc/caddy/Caddyfile`.
- [ ] **Р РЃР В°Р С– 6.** `docker/Caddyfile`:
  ```
  maxosipov.ru, app.maxosipov.ru {
    encode zstd gzip
    reverse_proxy web:3000
  }
  www.maxosipov.ru {
    redir https://maxosipov.ru{uri} permanent
  }
  ```
  (РЎР‚Р В°Р В·Р Т‘Р В°РЎвЂЎР В° `/media` РЎРѓ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С•Р в„– Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР С‘ Р Т‘Р С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р Р…Р В° РЎРЊРЎвЂљР В°Р С—Р Вµ 2).
- [ ] **Р РЃР В°Р С– 7.** Р вЂєР С•Р С”Р В°Р В»РЎРЉР Р…Р С•: `docker compose -f docker/compose.yml build` РІвЂ вЂ™ РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•. Р вЂ”Р В°Р С—РЎС“РЎРѓР С” РЎРѓ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р С `.env` РІвЂ вЂ™ `curl -H 'Host: app.maxosipov.ru' http://localhost/api/health` (РЎвЂЎР ВµРЎР‚Р ВµР В· web Р Р…Р В°Р С—РЎР‚РЎРЏР СРЎС“РЎР‹, Р С—Р С•РЎР‚РЎвЂљ 3000 Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…Р С• Р С•Р С—РЎС“Р В±Р В»Р С‘Р С”РЎС“Р в„–) РІвЂ вЂ™ `{"ok":true,"db":"up"}`.
- [ ] **Р РЃР В°Р С– 8.** `pnpm verify` РІвЂ вЂ™ Р В·Р ВµР В»РЎвЂР Р…РЎвЂ№Р в„–. Р С™Р С•Р СР СР С‘РЎвЂљ: `feat(infra): health check, worker, docker images, caddy`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 8. Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ FirstVPS, Р Т‘Р ВµР С—Р В»Р С•Р в„–, Р В±РЎРЊР С”Р В°Р С—РЎвЂ№

**Files:**
- Create: `docs/ops/server-setup.md`, `scripts/deploy.sh`, `scripts/backup.sh`, `scripts/restore-check.sh`, `docker/backup.env.example`

**Interfaces:**
- Produces: РЎР‚Р В°Р В±Р С•РЎвЂљР В°РЎР‹РЎвЂ°Р С‘Р Вµ `https://maxosipov.ru` Р С‘ `https://app.maxosipov.ru/api/health`; Р Р…Р С•РЎвЂЎР Р…Р С•Р в„– Р В±РЎРЊР С”Р В°Р С—.

- [ ] **Р РЃР В°Р С– 1.** `docs/ops/server-setup.md` РІР‚вЂќ Р С—Р С•РЎв‚¬Р В°Р С–Р С•Р Р†Р С• (Р С‘РЎРѓР С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉ Р С—Р С‘РЎв‚¬Р ВµРЎвЂљ, Р Р†Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ  Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…РЎРЏР ВµРЎвЂљ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ, Р ВµРЎРѓР В»Р С‘ РЎС“ Р С‘РЎРѓР С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЏ Р Р…Р ВµРЎвЂљ SSH):
  1. VPS: Ubuntu 24.04 LTS, 4 vCPU, 8 Р вЂњР вЂ RAM, 160 Р вЂњР вЂ NVMe (ARCHITECTURE Р’В§16).
  2. Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ `deploy` РЎРѓ sudo, Р Р†РЎвЂ¦Р С•Р Т‘ Р С—Р С• SSH-Р С”Р В»РЎР‹РЎвЂЎРЎС“, `PasswordAuthentication no`.
  3. `ufw allow 22,80,443/tcp && ufw enable`.
  4. Docker Engine + compose plugin Р С—Р С• Р С•РЎвЂћР С‘РЎвЂ Р С‘Р В°Р В»РЎРЉР Р…Р С•Р в„– Р С‘Р Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘Р С‘ Docker Р Т‘Р В»РЎРЏ Ubuntu.
  5. DNS РЎС“ РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂљР С•РЎР‚Р В°: A-Р В·Р В°Р С—Р С‘РЎРѓР С‘ `@`, `www`, `app` РІвЂ вЂ™ IP РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°; Р Т‘Р С•Р В¶Р Т‘Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р С—РЎР‚Р С‘Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ (`dig +short app.maxosipov.ru`).
  6. Р С™Р В»Р С•Р Р…Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎР‚Р ВµР С—Р С•Р В·Р С‘РЎвЂљР С•РЎР‚Р С‘Р в„– Р Р† `/opt/maxosipov`, РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ `.env` (Р С—РЎР‚Р С•Р Т‘Р В°Р С”РЎв‚¬Р Р…-Р В·Р Р…Р В°РЎвЂЎР ВµР Р…Р С‘РЎРЏ), `mkdir -p /data/postgres /data/media`.
  7. `./scripts/deploy.sh`.
- [ ] **Р РЃР В°Р С– 2.** `scripts/deploy.sh`: `set -euo pipefail`; `git pull --ff-only`; `docker compose -f docker/compose.yml build`; `docker compose -f docker/compose.yml up -d`; Р С•Р В¶Р С‘Р Т‘Р В°Р Р…Р С‘Р Вµ `/api/health` Р Т‘Р С• 60 РЎРѓ (curl Р Р† РЎвЂ Р С‘Р С”Р В»Р Вµ Р С” `https://app.maxosipov.ru/api/health`), Р С—РЎР‚Р С‘ Р Р…Р ВµРЎС“Р Т‘Р В°РЎвЂЎР Вµ РІР‚вЂќ Р Р†РЎвЂ№Р Р†Р ВµРЎРѓРЎвЂљР С‘ `docker compose logs --tail=100 web` Р С‘ Р Р†РЎвЂ№Р в„–РЎвЂљР С‘ РЎРѓ Р С”Р С•Р Т‘Р С•Р С 1.
- [ ] **Р РЃР В°Р С– 3.** `scripts/backup.sh`: `pg_dump` Р С‘Р В· Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚Р В° `db` Р Р† `/data/backups/db-$(date +%F).sql.gz`, Р В·Р В°РЎвЂљР ВµР С `restic backup /data/backups /data/media` Р Р† S3-РЎРѓР С•Р Р†Р СР ВµРЎРѓРЎвЂљР С‘Р СР С•Р Вµ РЎвЂ¦РЎР‚Р В°Р Р…Р С‘Р В»Р С‘РЎвЂ°Р Вµ (Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р Вµ Р С‘Р В· `/opt/maxosipov/docker/backup.env`: `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), Р В·Р В°РЎвЂљР ВµР С `restic forget --keep-daily 14 --keep-weekly 8 --prune`; РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ Р Т‘Р В°Р СР С—РЎвЂ№ РЎРѓРЎвЂљР В°РЎР‚РЎв‚¬Р Вµ 3 Р Т‘Р Р…Р ВµР в„–.
- [ ] **Р РЃР В°Р С– 4.** Cron Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ (`/etc/cron.d/maxosipov-backup`): Р ВµР В¶Р ВµР Т‘Р Р…Р ВµР Р†Р Р…Р С• Р Р† 03:30 Р С—Р С• Р С™РЎР‚Р В°РЎРѓР Р…Р С•РЎРЏРЎР‚РЎРѓР С”РЎС“ РІвЂ вЂ™ `scripts/backup.sh >> /var/log/maxosipov-backup.log 2>&1`. Р вЂ”Р В°Р Т‘Р С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР С‘РЎР‚РЎС“Р в„– Р Р† `server-setup.md`.
- [ ] **Р РЃР В°Р С– 5.** `scripts/restore-check.sh`: Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµРЎвЂљ Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р С‘Р в„– Р Т‘Р В°Р СР С— Р Р†Р С• Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ `postgres:17-alpine` Р С‘ Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…РЎРЏР ВµРЎвЂљ `select count(*) from users` РІР‚вЂќ Р Т‘Р В»РЎРЏ Р ВµР В¶Р ВµР СР ВµРЎРѓРЎРЏРЎвЂЎР Р…Р С•Р в„– Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С‘.
- [ ] **Р РЃР В°Р С– 6.** Р вЂ™РЎвЂ№Р С—Р С•Р В»Р Р…Р ВµР Р…Р С‘Р Вµ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ (Р Р†Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ  Р С‘Р В»Р С‘ Р С‘РЎРѓР С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉ РЎРѓ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р С•Р С): Р Т‘Р ВµР С—Р В»Р С•Р в„– РІвЂ вЂ™ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С‘:
  - `curl -sI https://maxosipov.ru` РІвЂ вЂ™ 200, Р Р†Р В°Р В»Р С‘Р Т‘Р Р…РЎвЂ№Р в„– РЎРѓР ВµРЎР‚РЎвЂљР С‘РЎвЂћР С‘Р С”Р В°РЎвЂљ;
  - `curl -sI https://www.maxosipov.ru` РІвЂ вЂ™ 308 Р Р…Р В° `https://maxosipov.ru/`;
  - `curl -s https://app.maxosipov.ru/api/health` РІвЂ вЂ™ `{"ok":true,"db":"up"}`;
  - `scripts/backup.sh` Р Р†РЎР‚РЎС“РЎвЂЎР Р…РЎС“РЎР‹ РІвЂ вЂ™ РЎРѓР Р…Р В°Р С—РЎв‚¬Р С•РЎвЂљ Р Р† `restic snapshots`.
- [ ] **Р РЃР В°Р С– 7.** Р С™Р С•Р СР СР С‘РЎвЂљ: `chore(ops): server setup guide, deploy and backup scripts`.

### Р вЂ”Р В°Р Т‘Р В°РЎвЂЎР В° 9. Р С›РЎвЂљРЎвЂЎРЎвЂРЎвЂљ РЎРЊРЎвЂљР В°Р С—Р В°

- [ ] Р РЋР С‘Р Т‘ Р Р…Р В° Р С—РЎР‚Р С•Р Т‘Р В°Р С”РЎв‚¬Р Р…Р Вµ **Р Р…Р Вµ** Р В·Р В°Р С—РЎС“РЎРѓР С”Р В°РЎвЂљРЎРЉ РЎРѓ РЎвЂљР ВµРЎРѓРЎвЂљР С•Р Р†РЎвЂ№Р СР С‘ Р Р…Р С•Р СР ВµРЎР‚Р В°Р СР С‘: Р Р† `scripts/seed.ts` Р С—РЎР‚Р С‘ `NODE_ENV === 'production'` РЎРѓР С•Р В·Р Т‘Р В°РЎР‹РЎвЂљРЎРѓРЎРЏ РЎвЂљР С•Р В»РЎРЉР С”Р С• Р В·Р В°Р В» Р С‘ РЎР‚Р С•Р В»Р С‘; Р Р†Р В»Р В°Р Т‘Р ВµР В»Р ВµРЎвЂ  Р С‘ Р СљР В°Р С”РЎРѓР С‘Р С РІР‚вЂќ Р С—Р С• Р Р…Р С•Р СР ВµРЎР‚Р В°Р С Р С‘Р В· Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№РЎвЂ¦ `SEED_OWNER_PHONE`, `SEED_TRAINER_PHONE` (Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ Р Р† `.env.example`). Р СћР ВµРЎРѓРЎвЂљ: `seed` Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ production Р В±Р ВµР В· РЎРЊРЎвЂљР С‘РЎвЂ¦ Р С—Р ВµРЎР‚Р ВµР СР ВµР Р…Р Р…РЎвЂ№РЎвЂ¦ Р Р…Р Вµ Р С—Р В°Р Т‘Р В°Р ВµРЎвЂљ Р С‘ Р Р…Р Вµ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂРЎвЂљ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР в„–.
- [ ] `pnpm test:e2e`: Р С•Р Т‘Р С‘Р Р… e2e `e2e/smoke.spec.ts` РІР‚вЂќ Р С•РЎвЂљР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµРЎвЂљ `http://app.localhost:3000`, Р Р†Р С‘Р Т‘Р С‘РЎвЂљ РЎвЂљР ВµР С”РЎРѓРЎвЂљ Р’В«Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р СљР В°Р С”РЎРѓР ВР ВР С РІР‚вЂќ РЎРѓР С”Р С•РЎР‚Р С•Р’В»; Р С•РЎвЂљР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµРЎвЂљ `http://localhost:3000`, Р Р†Р С‘Р Т‘Р С‘РЎвЂљ Р’В«Р СљР В°Р С”РЎРѓР С‘Р С Р С›РЎРѓР С‘Р С—Р С•Р Р†Р’В».
- [ ] Р С›РЎвЂљРЎвЂЎРЎвЂРЎвЂљ `docs/reports/00-report.md` Р С—Р С• РЎв‚¬Р В°Р В±Р В»Р С•Р Р…РЎС“ Р С‘Р В· README. **Р РЋРЎвЂљР С•Р С— РІР‚вЂќ Р В¶Р Т‘Р В°РЎвЂљРЎРЉ РЎР‚Р ВµР Р†РЎРЉРЎР‹.**
