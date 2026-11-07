> **ОТМЕНЁН 2026-11-07:** владелец отказался от MAX. Файл удаляется в исправлении F9 (`docs/reports/01-review.md`).

# Этап 1b. Вход через MAX — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Начинай только когда владелец подтвердил: организация на business.max.ru создана, бот прошёл модерацию, в `.env` есть `MAX_BOT_TOKEN`, `MAX_BOT_NAME`, `MAX_WEBHOOK_SECRET`.

**Цель:** кнопка «Войти через MAX» на экране входа: открывается бот Максима, клиент делится контактом — и он вошёл в приложение.

**Архитектура:** одноразовый токен входа → deep-link на бота → бот получает старт с токеном, просит контакт → вебхук привязывает подтверждённый телефон к токену → страница приложения, опрашивающая статус токена, получает сессию. См. `ARCHITECTURE.md` §8.1.

**Стек:** MAX Bot API (HTTP), Route Handlers, Drizzle.

**Спека:** `ARCHITECTURE.md` §8.1 (MAX), §12.

## Global Constraints

- Токен входа: 32 байта base64url, TTL 5 минут, одноразовый. В БД хранится `sha256`.
- Телефон берём **только** из контакта, которым пользователь поделился сам (контакт должен принадлежать отправителю — проверить по полям, которые даёт API: id владельца контакта = id отправителя).
- Вебхук принимает запросы только с секретом `MAX_WEBHOOK_SECRET` (способ передачи — как в документации MAX: заголовок или параметр; иначе — секрет в пути `/api/max/webhook/<secret>`).
- Тексты бота: приветствие «Привет! Это бот Максима Осипова. Нажми кнопку ниже, чтобы войти в приложение МаксИИм.», кнопка «Поделиться номером», успех «Готово! Вернись в приложение — ты уже вошёл.», ошибка «Ссылка устарела. Вернись в приложение и нажми „Войти через MAX“ ещё раз.»

## Review Focus

1. Пользователь делится **чужим** контактом (пересланным) → вход не выполняется, бот пишет «Поделись своим номером кнопкой ниже» (тест задачи 2).
2. Токен открыт дважды / после 5 минут → ошибка «Ссылка устарела» (тест задачи 1).
3. Повторная доставка одного и того же обновления вебхуком → без двойной обработки (идемпотентность по id обновления, тест задачи 2).
4. Вкладка приложения закрыта, пока пользователь был в боте → при возврате и повторном открытии `/login/max?t=…` вход завершается (задача 3).
5. Пользователь MAX уже привязан к другому номеру → ошибка с текстом из этапа 1 (`signInWithVerifiedPhone`).

---

### Задача 1. Токены входа

**Files:** Create `src/modules/auth/max/login-token.ts`, `src/modules/auth/max/login-token.test.ts`; Modify `src/modules/auth/schema.ts` (+ `login_tokens(id, token_hash unique, status ('pending'|'confirmed'|'consumed'), phone null, provider_user_id null, name null, expires_at, created_at)`).

**Interfaces — Produces:** `createLoginToken(): Promise<{ token: string; deepLink: string }>` (`https://max.ru/${MAX_BOT_NAME}?start=${token}` — **сверь формат deep-link с документацией MAX**); `confirmLoginToken(token, { phone, providerUserId, name }): Promise<'ok' | 'expired' | 'not_found'>`; `consumeLoginToken(token): Promise<{ phone: string; providerUserId: string; name: string | null } | 'pending' | 'expired'>`.

- [ ] Тесты: создать → `consume` = `'pending'`; `confirm` → `consume` возвращает данные; второй `consume` → `'expired'`; `confirm` через 5 мин 1 с → `'expired'`. → реализация → PASS → коммит `feat(auth): max login tokens`.

### Задача 2. Клиент MAX Bot API и вебхук

**Files:** Create `docs/ops/max-bot.md`, `src/modules/auth/max/api.ts`, `src/modules/auth/max/updates.ts`, `src/modules/auth/max/updates.test.ts`, `src/app/api/max/webhook/route.ts`, `scripts/max-set-webhook.ts`; Modify `src/modules/auth/schema.ts` (+ `max_updates(update_id pk, received_at)`).

**Interfaces — Produces:** `handleMaxUpdate(update: unknown): Promise<void>`; `maxApi.sendMessage(chatId, text, keyboard?)`.

- [ ] **Шаг 1.** **Открой официальную документацию MAX Bot API (dev.max.ru)** и выпиши в `docs/ops/max-bot.md`: базовый URL и способ авторизации, тип обновления «пользователь запустил бота» и где в нём параметр старта, как отправить сообщение с кнопкой запроса контакта, как выглядит обновление с контактом (поля телефона и id владельца контакта), как установить вебхук и как проверяется секрет. Ничего из этого не выдумывать; чего нет в документации — вопрос в отчёте.
- [ ] **Шаг 2.** Тесты `updates.test.ts` на фикстурах из документации (сохрани примеры JSON в `src/modules/auth/max/fixtures/`): старт с валидным токеном → отправлено приветствие с кнопкой контакта, в `login_tokens` сохранён `provider_user_id`; контакт отправителя → `confirmLoginToken` вызван с нормализованным телефоном, отправлен текст успеха; чужой контакт → текст «Поделись своим номером кнопкой ниже», токен не подтверждён; повтор того же `update_id` → ничего не происходит; просроченный токен → текст ошибки из Global Constraints.
- [ ] **Шаг 3.** Реализация + роут вебхука (проверка секрета → 401 без него; всегда отвечать 200 быстро после записи `update_id`). `scripts/max-set-webhook.ts` регистрирует `${APP_URL}/api/max/webhook`.
- [ ] **Шаг 4.** `pnpm verify` → коммит `feat(auth): max bot webhook`.

### Задача 3. Экран входа через MAX

**Files:** Create `src/app/(app)/app/login/max/page.tsx`, `src/app/api/auth/max/start/route.ts`, `src/app/api/auth/max/status/route.ts`; Modify `src/app/(app)/app/login/page.tsx` (включить кнопку, если задан `MAX_BOT_TOKEN`).

- [ ] `start` создаёт токен, кладёт его в cookie `max_login` (httpOnly, 5 мин) и редиректит на `/login/max?t=<token>`. Страница показывает кнопку «Открыть MAX» (deep-link) и текст «Нажми „Поделиться номером“ в боте и возвращайся сюда»; каждые 2 с опрашивает `GET /api/auth/max/status?t=…`; при данных → `signInWithVerifiedPhone(phone, { provider: 'max', providerUserId, name })` → сессия → редирект (`/onboarding` или `/`). Через 5 минут — «Ссылка устарела» и кнопка «Попробовать ещё раз».
- [ ] Ручная проверка с реальным ботом на телефоне (iPhone и Android). Скриншоты в отчёт.
- [ ] `pnpm verify` → коммит `feat(auth): sign in with max` → отчёт `docs/reports/01b-report.md`. **Стоп — ждать ревью.**
