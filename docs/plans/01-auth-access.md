# Этап 1. Вход и доступ — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.

**Цель:** клиент входит по телефону (СМС), через VK ID или Яндекс ID, проходит анкету, автоматически получает пробный месяц; Максим выдаёт и продлевает подписки; без доступа клиент видит экран «Продлить у Максима».

**Архитектура:** собственные сессии (cookie `sid` + таблица `sessions`), собственный OTP, OAuth 2.0 + PKCE для VK ID и Яндекс ID на `fetch` (без библиотек авторизации — решение D16). Модуль `access` — чистые функции расчёта доступа + сервис с проверкой прав через `rbac`.

**Стек:** Next.js Route Handlers и Server Actions, Drizzle, Zod, react-hook-form, pg-boss (задача истечения подписок).

**Спека:** `ARCHITECTURE.md` §7 (пользователи и доступ), §8.1–§8.2, §12; `DESIGN.md` §8.7, §8.8, §9.

## Global Constraints

- Телефон хранится в E.164: `+7XXXXXXXXXX`. Один телефон = один пользователь.
- OTP: 4 цифры, TTL 5 минут, ≤ 3 запроса кода на номер в час, ≤ 5 попыток ввода на код, ≤ 20 запросов кода с одного IP в час. В dev для номеров `+7999000xxxx` код всегда `1111` и СМС не отправляется.
- Сессия: случайный токен 32 байта (base64url) в cookie `sid` (`httpOnly`, `secure` в production, `sameSite: 'lax'`, `path: '/'`, срок 90 дней, продлевается при использовании, если до конца < 30 дней). В БД — только `sha256` токена.
- Пробный период: `gym.settings.trialDays` (30) дней с момента регистрации; `trial_registry` хранит `sha256(phone + AUTH_SECRET)`.
- Доступ: `status ∈ {trial, active}` и `now < ends_at`. Роли с правом `subscriptions.grant` или владелец — доступ всегда.
- Все даты в UI — по `Asia/Krasnoyarsk`, формат «7 декабря».
- Тексты экранов — ровно из этого плана и `DESIGN.md` §8.7–§8.8.

## Review Focus

1. Телефон в любом виде: `8 (999) 123-45-67`, `+7 999 1234567`, `79991234567`, `9991234567` → один и тот же E.164; мусор → ошибка «Проверь номер» (тесты задачи 1).
2. Повторная регистрация после удаления/смены способа входа на тот же номер — пробный период второй раз не выдаётся (тест задачи 5).
3. Пользователь вошёл через Яндекс, потом через VK с тем же номером — это один аккаунт, а не два (тест задачи 4).
4. «+1 месяц» 31 января → 28/29 февраля; продление активной подписки считается от её конца, истёкшей — от сегодня (тесты задачи 5).
5. Заморозка и разморозка не «съедают» дни: после разморозки конец сдвигается ровно на длительность заморозки (тест задачи 5).

---

### Задача 1. Телефон, сессии, текущий пользователь

**Files:**
- Create: `src/modules/auth/phone.ts`, `src/modules/auth/phone.test.ts`, `src/modules/auth/session.ts`, `src/modules/auth/session.test.ts`, `src/modules/auth/current.ts`
- Modify: `src/modules/auth/schema.ts` (+ `sessions`, `auth_accounts`, поля `users.pd_consent_at`), `src/modules/auth/index.ts`

**Interfaces:**
- Consumes: `users`, `loadActor` из `@/modules/rbac`, `db`, `env`.
- Produces:
  - `normalizePhone(input: string): string | null`
  - `createSession(userId: string, userAgent: string | null): Promise<{ token: string; expiresAt: Date }>`
  - `validateSessionToken(token: string): Promise<{ userId: string; expiresAt: Date } | null>` (продлевает, если до конца < 30 дней)
  - `destroySession(token: string): Promise<void>`
  - `getCurrentUser(): Promise<CurrentUser | null>` и `requireUser(): Promise<CurrentUser>` (редирект на `/login`, если нет) — `current.ts`, читают cookie `sid` через `next/headers`.
  - `type CurrentUser = { user: User; actor: Actor }`
  - Таблица `sessions(id, user_id fk, token_hash unique, expires_at, user_agent, created_at)`; `auth_accounts(id, user_id fk, provider text, provider_user_id text, created_at, unique(provider, provider_user_id))`; `users.pd_consent_at timestamptz null`.

- [ ] **Шаг 1.** Падающие тесты `phone.test.ts`:
  ```ts
  test.each([
    ['8 (999) 123-45-67', '+79991234567'], ['+7 999 1234567', '+79991234567'],
    ['79991234567', '+79991234567'], ['9991234567', '+79991234567'], [' +7-999-123-45-67 ', '+79991234567'],
  ])('%s', (i, o) => expect(normalizePhone(i)).toBe(o))
  test.each(['', '123', '+1 202 555 0101', '8999123456', 'abc', '+7999123456789'])('rejects %s', (i) =>
    expect(normalizePhone(i)).toBeNull())
  ```
- [ ] **Шаг 2.** Реализуй `normalizePhone` (только российские номера: 10 цифр после кода страны, первая из них 9 или 3/4/8 для городских — разрешай любые 10 цифр). → PASS.
- [ ] **Шаг 3.** Миграция для новых таблиц/колонки (`pnpm db:generate && pnpm db:migrate`).
- [ ] **Шаг 4.** Падающие тесты `session.test.ts` (с `resetDb()`): создание → `validateSessionToken(token)` возвращает `userId`; в БД нет открытого токена (только хэш); просроченная сессия → `null`; сессия, у которой до конца 10 дней, после валидации продлена до 90 дней от «сейчас»; `destroySession` → далее `null`. Время подменяй через `vi.useFakeTimers()` / `vi.setSystemTime`.
- [ ] **Шаг 5.** Реализуй `session.ts` (`crypto.randomBytes(32).toString('base64url')`, `createHash('sha256')`). → PASS.
- [ ] **Шаг 6.** `current.ts`: `getCurrentUser` читает `cookies().get('sid')`, валидирует, загружает `User` и `loadActor(user.id)`. `requireUser` — `redirect('/login')` (путь внутри приложения; middleware добавит `/app`).
- [ ] **Шаг 7.** `pnpm verify`. Коммит: `feat(auth): phone normalization and sessions`.

### Задача 2. СМС и одноразовые коды

**Files:**
- Create: `src/modules/auth/sms/types.ts`, `src/modules/auth/sms/smsru.ts`, `src/modules/auth/sms/console.ts`, `src/modules/auth/sms/index.ts`, `src/modules/auth/otp.ts`, `src/modules/auth/otp.test.ts`
- Modify: `src/modules/auth/schema.ts` (+ `otp_codes`), `src/shared/env.ts` (`SMS_PROVIDER: 'smsru' | 'console'`, default `console`; `SMS_API_KEY` обязателен, если `smsru`)

**Interfaces:**
- Produces:
  - `interface SmsProvider { send(phoneE164: string, text: string): Promise<void> }`; `getSmsProvider(): SmsProvider`.
  - `requestOtp(phone: string, ip: string): Promise<{ ok: true } | { ok: false; reason: 'rate_phone' | 'rate_ip' }>`
  - `verifyOtp(phone: string, code: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }>`
  - Таблица `otp_codes(id, phone, code_hash, ip, attempts int default 0, expires_at, consumed_at null, created_at)`.
  - Текст СМС: `Код входа МаксИИм: {code}. Никому его не сообщай.`

- [ ] **Шаг 1.** Падающие тесты `otp.test.ts` (БД + фейковый провайдер через `vi.mock('./sms')`, фейковое время):
  - запрос → провайдер вызван 1 раз с текстом из Interfaces, в БД хэш, а не код;
  - верный код → `ok:true`, повторное использование того же кода → `invalid`;
  - неверный код 5 раз → шестая попытка (даже с верным кодом) → `too_many_attempts`;
  - через 5 минут 1 секунду → `expired`;
  - 4-й запрос на номер за час → `rate_phone`; через час — снова можно;
  - 21-й запрос с одного IP (разные номера) за час → `rate_ip`;
  - при `NODE_ENV !== 'production'` и номере `+7999000xxxx` код = `1111`, провайдер не вызывается.
- [ ] **Шаг 2.** Реализуй. Проверь API СМС.ру по официальной документации (`https://sms.ru/api/send`): отправка `GET https://sms.ru/sms/send?api_id=…&to=79991234567&msg=…&json=1`, успех — `status: "OK"` и у номера `status: "OK"`; иначе бросить `Error` с текстом ответа. Если документация отличается — следуй документации и опиши в отчёте. → PASS.
- [ ] **Шаг 3.** `pnpm verify`. Коммит: `feat(auth): otp codes and sms provider`.

### Задача 3. Вход по телефону: регистрация, привязка, экраны

**Files:**
- Create: `src/modules/auth/signin.ts`, `src/modules/auth/signin.test.ts`, `src/app/(app)/app/login/page.tsx`, `src/app/(app)/app/login/phone/page.tsx`, `src/app/(app)/app/login/code/page.tsx`, `src/app/(app)/app/login/actions.ts`, `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `normalizePhone`, `requestOtp`, `verifyOtp`, `createSession`, `startTrialIfEligible` (задача 5 — пока заглушка, которая ничего не делает; в задаче 5 заменить), `DEFAULT_ROLES`.
- Produces:
  - `signInWithVerifiedPhone(phone: string, link?: { provider: 'vk' | 'yandex' | 'max'; providerUserId: string; name?: string }): Promise<{ userId: string; isNew: boolean }>` — находит пользователя по телефону или создаёт (роль «Клиент», `gym_id` = зал, `trainer_id` = первый пользователь с ролью «Главный тренер», `name` из `link.name` или пусто); upsert `auth_accounts` для `phone` и `link`; для нового — `startTrialIfEligible`.
  - Server actions: `requestCodeAction(formData)`, `verifyCodeAction(formData)` — при успехе ставят cookie `sid` и редиректят на `/` (нового пользователя — на `/onboarding`).

- [ ] **Шаг 1.** Падающие тесты `signin.test.ts`: новый номер → `isNew:true`, роль «Клиент», `trainer_id` = Максим; тот же номер ещё раз → `isNew:false`, пользователей не прибавилось; вызов с `link: {provider:'yandex', providerUserId:'y1'}` для существующего номера → тот же `userId`, в `auth_accounts` появилась запись `yandex/y1`; повторная привязка того же `y1` к другому номеру → бросает `Error('Этот аккаунт Яндекса уже привязан к другому номеру')` (аналогично для `vk`, `max` — текст с названием провайдера: «VK ID», «Яндекса», «MAX»).
- [ ] **Шаг 2.** Реализуй → PASS.
- [ ] **Шаг 3.** Экран `/login` (DESIGN §8.7): заголовок «Тренируйся с Максимом» (`font-display`, 40px), подзаголовок «Видео упражнений, дневник и ИИ-помощник МаксИИм», кнопки по порядку: «Войти через VK ID», «Войти через Яндекс ID», «Войти через MAX» (на этом этапе неактивна с подписью «скоро» — включится на этапе 1b), ссылка «Войти по номеру телефона». Внизу мелко: «Продолжая, ты соглашаешься с политикой обработки персональных данных» (ссылка на `/legal/privacy`).
- [ ] **Шаг 4.** `/login/phone`: поле телефона с маской `+7 (___) ___-__-__`, кнопка «Получить код». Ошибки: невалидный номер — «Проверь номер», `rate_phone` — «Слишком много попыток. Попробуй через час», `rate_ip` — то же.
- [ ] **Шаг 5.** `/login/code?phone=…`: 4 отдельные ячейки, автофокус, `inputMode="numeric"`, `autocomplete="one-time-code"`, автоотправка при 4 цифрах; «Отправить код ещё раз» — через 60 с (таймер); ошибки: `invalid` — «Неверный код», `expired` — «Код устарел — запроси новый», `too_many_attempts` — «Слишком много попыток — запроси новый код».
- [ ] **Шаг 6.** `POST /api/auth/logout` — удаляет сессию, чистит cookie, редирект на `/login`.
- [ ] **Шаг 7.** e2e `e2e/login-phone.spec.ts`: `app.localhost:3000/login` → «Войти по номеру телефона» → `+79990000099` → код `1111` → попадаем на `/onboarding`.
- [ ] **Шаг 8.** `pnpm verify && pnpm test:e2e`. Коммит: `feat(auth): phone sign-in flow and screens`.

### Задача 4. Вход через Яндекс ID и VK ID

**Files:**
- Create: `src/modules/auth/oauth/pkce.ts`, `src/modules/auth/oauth/pkce.test.ts`, `src/modules/auth/oauth/yandex.ts`, `src/modules/auth/oauth/vk.ts`, `src/modules/auth/oauth/state.ts`, `src/modules/auth/oauth/state.test.ts`, `src/modules/auth/pending-link.ts`, `src/app/api/auth/[provider]/start/route.ts`, `src/app/api/auth/[provider]/callback/route.ts`, `docs/ops/oauth-setup.md`
- Modify: `src/shared/env.ts` (`VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET` — optional; если не заданы, соответствующая кнопка скрыта), `src/modules/auth/schema.ts` (+ `pending_links`), экраны `/login`, `/login/phone`, `/login/code`

**Interfaces:**
- Produces:
  - `createPkce(): { verifier: string; challenge: string }` (S256, base64url).
  - `sealState(data: { provider: string; verifier: string; state: string; createdAt: number }): string` и `openState(sealed: string): data | null` — HMAC-SHA256 на `AUTH_SECRET`, срок 10 минут; хранится в cookie `oauth` (`httpOnly`, 10 мин).
  - `type OAuthProfile = { providerUserId: string; phone: string | null; name: string | null }`
  - `yandex.authorizeUrl(state, challenge, redirectUri)`, `yandex.exchange(code, verifier, redirectUri): Promise<OAuthProfile>`; то же для `vk` (у VK `exchange` дополнительно принимает `deviceId` и `state`).
  - Таблица `pending_links(id, provider, provider_user_id, name, expires_at)` — для случая «провайдер не дал телефон»: callback создаёт запись (TTL 15 мин) и редиректит на `/login/phone?link=<id>`; после подтверждения телефона `signInWithVerifiedPhone(phone, link)`.
  - Redirect URI: `${APP_URL}/api/auth/{provider}/callback`.

- [ ] **Шаг 1.** Тесты `pkce.test.ts` (challenge = base64url(sha256(verifier)), длина verifier 43–128) и `state.test.ts` (open(seal(x)) = x; подделанная подпись → null; старше 10 минут → null). → FAIL → реализация → PASS.
- [ ] **Шаг 2.** **Прежде чем писать `yandex.ts` и `vk.ts`, открой официальную документацию** и выпиши в `docs/ops/oauth-setup.md` точные URL, параметры и поля ответа:
  - Яндекс ID: `https://yandex.ru/dev/id/doc/ru/` — авторизация `https://oauth.yandex.ru/authorize` (code + PKCE), токен `POST https://oauth.yandex.ru/token`, профиль `GET https://login.yandex.ru/info?format=json` с заголовком `Authorization: OAuth <token>`; телефон — `default_phone.number` при праве `login:default_phone`; имя — `real_name` или `display_name`; id — `id`.
  - VK ID: `https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description` — авторизация `https://id.vk.com/authorize` (PKCE, `scope=phone`), callback содержит `code`, `device_id`, `state`; токен `POST https://id.vk.com/oauth2/auth` (`grant_type=authorization_code`, `code_verifier`, `device_id`, `redirect_uri`, `client_id`, `state`); профиль `POST https://id.vk.com/oauth2/user_info` (`client_id`, `access_token`) → `user.user_id`, `user.phone`, `user.first_name`, `user.last_name`.
  - Если что-то в документации отличается от написанного здесь — **верь документации**, отметь расхождение в отчёте.
  - Там же — инструкция для владельца: как создать приложения в VK ID и Яндекс ID, какие redirect URI указать (продакшн и `http://app.localhost:3000/...` для разработки), какие права запросить.
- [ ] **Шаг 3.** Реализуй `yandex.ts`, `vk.ts`. Телефон из ответа прогоняй через `normalizePhone`. Unit-тесты на разбор ответа профиля (фикстуры JSON из документации, `fetch` замокан): с телефоном → `phone: '+7…'`; без телефона → `phone: null`.
- [ ] **Шаг 4.** Роуты: `start` — генерирует state и PKCE, ставит cookie `oauth`, редирект на `authorizeUrl`. `callback` — проверяет `state` из cookie, обменивает код, затем: телефон есть → `signInWithVerifiedPhone(phone, link)` → сессия → редирект (`/onboarding` для новых, иначе `/`); телефона нет → `pending_links` → `/login/phone?link=…` с подзаголовком «Подтверди номер — так мы защитим твой пробный месяц». Ошибка провайдера/отказ пользователя → `/login?error=oauth` с текстом «Не получилось войти. Попробуй ещё раз или войди по номеру».
- [ ] **Шаг 5.** Тест `signin.test.ts` дополнить: пользователь создан через `yandex` с номером X; затем вход через `vk` с тем же X → тот же `userId`, у него две записи в `auth_accounts`.
- [ ] **Шаг 6.** Ручная проверка (когда владелец создаст приложения и заполнит `.env`): вход через оба провайдера локально. Если ключей ещё нет — отметь в отчёте «проверено только тестами».
- [ ] **Шаг 7.** `pnpm verify`. Коммит: `feat(auth): yandex id and vk id sign-in with pkce`.

### Задача 5. Модуль `access`: пробный период и подписки

**Files:**
- Create: `src/modules/access/schema.ts`, `src/modules/access/dates.ts`, `src/modules/access/dates.test.ts`, `src/modules/access/compute.ts`, `src/modules/access/compute.test.ts`, `src/modules/access/service.ts`, `src/modules/access/service.test.ts`, `src/worker/jobs/expire-subscriptions.ts`
- Modify: `src/modules/access/index.ts`, `src/modules/auth/signin.ts` (убрать заглушку), `src/worker/jobs.ts`, `scripts/seed.ts`

**Interfaces:**
- Produces:
  - Таблицы: `subscriptions(id, user_id unique fk, status text ('trial'|'active'|'frozen'|'expired'|'disabled'), starts_at, ends_at, frozen_at null, status_before_freeze null, updated_at)` — **текущее состояние, одна строка на клиента**; `subscription_events(id, user_id, type ('trial_started'|'granted'|'frozen'|'unfrozen'|'disabled'|'expired'), months int null, until_date null, price_rub int null, note text null, actor_id null, created_at)` — история; `trial_registry(phone_hash pk, used_at)`.
  - `addMonthsClamped(date: Date, months: number, tz: string): Date` — календарные месяцы в часовом поясе зала, 31 января + 1 = последний день февраля.
  - `computeAccess(sub: SubscriptionRow | null, now: Date): { hasAccess: boolean; status: SubscriptionStatus | 'none'; endsAt: Date | null; daysLeft: number | null }` (`daysLeft` — целые дни вверх).
  - `startTrialIfEligible(userId: string, phone: string): Promise<boolean>`
  - `grant(actor: Actor, userId: string, input: { months?: 1 | 3 | 6 | 12; untilDate?: Date; priceRub?: number; note?: string }): Promise<SubscriptionRow>` — ровно одно из `months`/`untilDate`; база продления = `max(now, ends_at)` если статус `trial|active`, иначе `now`; статус → `active`.
  - `freeze(actor, userId)`, `unfreeze(actor, userId)`, `disable(actor, userId)`.
  - `getAccessForUser(userId: string): Promise<ReturnType<typeof computeAccess> & { bypass: boolean }>` — `bypass: true` для владельца и актора с `subscriptions.grant`.
  - `expireSubscriptions(now: Date): Promise<number>` — переводит `trial|active` с `ends_at <= now` в `expired`, пишет событие `expired`, возвращает количество.
  - Все сервисные функции, кроме `startTrialIfEligible`, `getAccessForUser`, `expireSubscriptions`, вызывают `assertCan(actor, 'subscriptions.grant', target)`.

- [ ] **Шаг 1.** Падающие тесты `dates.test.ts` (tz `Asia/Krasnoyarsk`): 2027-01-31 12:00 +1 → 2027-02-28 12:00; 2028-01-31 +1 → 2028-02-29; 2026-11-07 +3 → 2027-02-07; 2026-12-15 +12 → 2027-12-15. Реализуй без внешних библиотек (`Intl.DateTimeFormat` для разбора локальной даты). → PASS.
- [ ] **Шаг 2.** Падающие тесты `compute.test.ts`: `null` → `{hasAccess:false,status:'none'}`; `trial` с концом через 3 дня 2 часа → `hasAccess:true, daysLeft:4`; `active`, `ends_at` в прошлом → `hasAccess:false` (даже если воркер ещё не перевёл в `expired`); `frozen` → `hasAccess:false`; `disabled` → `false`. → реализация → PASS.
- [ ] **Шаг 3.** Падающие тесты `service.test.ts`:
  - `startTrialIfEligible` для нового номера → `true`, подписка `trial` на 30 дней, событие `trial_started`, запись в `trial_registry`; второй раз (тот же номер, даже другой `userId`) → `false`, подписка не создана;
  - `grant(+1)` при `trial`, оставалось 10 дней → `ends_at` = старый конец + 1 месяц, статус `active`;
  - `grant(+1)` при `expired` 20 дней назад → `ends_at` = сейчас + 1 месяц;
  - `freeze` 1 марта, `unfreeze` 11 марта → `ends_at` сдвинут ровно на 10 суток, статус вернулся к предыдущему;
  - `grant` актором-клиентом → `ForbiddenError`; актором «Тренер» (scope `own`) для чужого клиента → `ForbiddenError`;
  - `expireSubscriptions` переводит только просроченные, возвращает их число.
- [ ] **Шаг 4.** Реализуй → PASS. В `signin.ts` замени заглушку на настоящий `startTrialIfEligible`.
- [ ] **Шаг 5.** Задача воркера `subscriptions:expire` — раз в час (`'0 * * * *'`), вызывает `expireSubscriptions(new Date())`, пишет число в лог. Уведомления «осталось 3 дня» — на этапе 5 (не делать).
- [ ] **Шаг 6.** Сид: клиентам 1–3 — `trial` (концы через 25, 5, 1 день), клиенту 4 — `active` на 2 месяца, клиенту 5 — `expired` 3 дня назад.
- [ ] **Шаг 7.** `pnpm verify`. Коммит: `feat(access): trials, subscriptions, expiry job`.

### Задача 6. Анкета и согласия

**Files:**
- Create: `src/modules/auth/profile-schema.ts` (Zod), `src/modules/auth/profile.ts`, `src/modules/auth/profile.test.ts`, `src/app/(app)/app/onboarding/page.tsx`, `src/app/(app)/app/onboarding/steps/*.tsx`, `src/app/(app)/app/onboarding/actions.ts`, `src/app/(app)/app/legal/privacy/page.tsx`, `src/app/(app)/app/legal/consent/page.tsx`, `src/app/(app)/app/legal/health-consent/page.tsx`, `content/legal/*.md`
- Modify: `src/modules/auth/schema.ts` (+ `client_profiles` по ARCHITECTURE §7)

**Interfaces:**
- Produces:
  - `clientProfileSchema` (Zod): `sex: 'male'|'female'`, `birthYear: int 1940..(текущий год − 14)`, `heightCm: int 120..230`, `weightKg: number 35..250`, `goal: 'strength'|'mass'|'fat_loss'|'health'`, `experience: 'novice'|'intermediate'|'advanced'`, `sessionsPerWeek: int 1..7`, `limitations: string max 500 | null`, `healthConsent: boolean`, `pdConsent: literal(true)`.
  - `saveOnboarding(userId, input): Promise<void>` — пишет `client_profiles`, `users.pd_consent_at = now`, `health_consent_at = now` только если `healthConsent`; если `healthConsent=false` — `limitations` сохраняется как `null`; ставит `users.onboarding_completed_at`.

- [ ] **Шаг 1.** Тесты `profile.test.ts`: без `pdConsent` → ошибка валидации; `limitations` при `healthConsent:false` → сохраняется `null`; корректный ввод → профиль сохранён, `onboarding_completed_at` установлен. → реализация → PASS.
- [ ] **Шаг 2.** Экраны анкеты (DESIGN §8.7): по одному вопросу на экран, прогресс-полоса, крупные варианты (кнопки-карточки высотой ≥ 56px), «Назад»/«Дальше» снизу.
  1. «Какая у тебя цель?» — «Стать сильнее» / «Набрать массу» / «Похудеть» / «Здоровье и тонус»
  2. «Какой у тебя опыт?» — «Новичок» / «Занимаюсь до года» / «Больше года»
  3. «Сколько раз в неделю будешь ходить?» — 1…7 (чипы)
  4. «Немного о тебе» — пол (2 кнопки), год рождения (числовое поле)
  5. «Рост и вес» — два числовых поля «см» и «кг»
  6. «Есть ограничения или травмы?» — текстовое поле (необязательно) + чекбокс «Согласен на обработку данных о здоровье» (ссылка на `/legal/health-consent`); подсказка «МаксИИм учтёт это при подборе упражнений. Можно пропустить»
  7. Финал: чекбокс «Согласен на обработку персональных данных» (ссылка на `/legal/consent`) обязателен; кнопка «Начать».
- [ ] **Шаг 3.** После сохранения — экран «Пробный месяц активирован до {дата}» (дата из `computeAccess`), подсказка «Установи приложение на экран „Домой“ — так оно работает как обычное». На iPhone (`/iPhone|iPad/` в userAgent и не `standalone`) — картинка-инструкция «Поделиться → На экран „Домой“» (сделай простую SVG-иллюстрацию); на Android/Chrome — кнопка «Установить» через событие `beforeinstallprompt`. Кнопка «Перейти к тренировкам».
- [ ] **Шаг 4.** Юридические страницы рендерят `content/legal/privacy.md`, `consent.md`, `health-consent.md`. Сейчас положи в каждый файл заголовок и строку `ТЕКСТ ПРЕДОСТАВИТ ВЛАДЕЛЕЦ (ARCHITECTURE.md §16)` — **это внешняя зависимость, не сочиняй юридический текст**. Отметь в отчёте.
- [ ] **Шаг 5.** `pnpm verify`. Коммит: `feat(auth): onboarding questionnaire and consents`.

### Задача 7. Оболочка приложения, охрана маршрутов, экран «нет доступа»

**Files:**
- Delete: `src/app/(app)/app/page.tsx` (заглушка этапа 0 — её место занимает «Сегодня»); обнови `e2e/smoke.spec.ts`: на `app.localhost:3000` без сессии открывается экран входа «Тренируйся с Максимом».
- Create: `src/app/(app)/app/(client)/layout.tsx`, `src/app/(app)/app/(client)/page.tsx` (Сегодня — заглушка), `src/app/(app)/app/(client)/workouts/page.tsx`, `src/app/(app)/app/(client)/coach/page.tsx`, `src/app/(app)/app/(client)/exercises/page.tsx`, `src/app/(app)/app/(client)/progress/page.tsx`, `src/app/(app)/app/(client)/profile/page.tsx`, `src/app/(app)/app/paywall/page.tsx`, `src/components/app/bottom-nav.tsx`, `src/components/app/guard.ts`, `src/components/app/guard.test.ts`
- Modify: `src/modules/gym/index.ts` (контакты Максима: `getTrainerContacts(): Promise<{ phone: string | null; maxUrl: string | null; photoUrl: string | null }>` из `gyms.settings.contacts` — добавь поле в `GymSettings` и сид с `null`)

**Interfaces:**
- Produces: `decideRoute(state: { hasSession: boolean; onboardingDone: boolean; hasAccess: boolean; bypass: boolean; path: string }): { redirect: string } | { allow: true }` — чистая функция.

- [ ] **Шаг 1.** Тесты `guard.test.ts`: без сессии → `/login`; с сессией без анкеты → `/onboarding`; без доступа на `/exercises` → `/paywall`; без доступа на `/progress` и `/profile` → `allow` (история доступна для чтения); `bypass` → всегда `allow`; на `/paywall` с доступом → `/`. → реализация → PASS.
- [ ] **Шаг 2.** `(client)/layout.tsx` применяет `decideRoute`; нижнее меню из DESIGN §8.1: «Сегодня», «Тренировки», центральная выделенная «МаксИИм» (красная, 54×54, радиус 18, приподнята), «Упражнения», «Прогресс». Иконки lucide (`Home`, `Dumbbell`, `Activity`/`PersonStanding`, `ChartColumn`); активная вкладка — `text-text`, остальные — `text-text-muted`. Профиль — аватар в шапке страницы «Сегодня» (ссылка на `/profile`).
- [ ] **Шаг 3.** Профиль (временно): имя, телефон, статус доступа («Пробный период до 7 декабря» / «Подписка до …» / «Подписка закончилась»), кнопка «Выйти».
- [ ] **Шаг 4.** `/paywall` (DESIGN §8.8): фото Максима (из `getTrainerContacts().photoUrl`, если нет — монограмма «МО» 120px), текст «Подписка закончилась. Продли у Максима — и продолжаем», кнопки «Написать в MAX» (ссылка `maxUrl`, если задана) и «Позвонить» (`tel:`; номер также показан текстом). Ссылка «Посмотреть мой прогресс» → `/progress`.
- [ ] **Шаг 5.** e2e: вход клиентом 5 (`+79990000015`, просрочен) → на `/exercises` редирект на `/paywall`; на `/progress` — пускает.
- [ ] **Шаг 6.** `pnpm verify && pnpm test:e2e`. Коммит: `feat(app): client shell, route guard, paywall`.

### Задача 8. Подписки в кабинете тренера (минимум для этапа)

**Files:**
- Create: `src/app/(app)/app/trainer/layout.tsx`, `src/app/(app)/app/trainer/subscriptions/page.tsx`, `src/app/(app)/app/trainer/subscriptions/actions.ts`, `src/app/(app)/app/trainer/settings/access/page.tsx`, `src/modules/access/settings.ts`, `src/modules/access/settings.test.ts`

**Interfaces:**
- Consumes: `grant`, `freeze`, `unfreeze`, `disable`, `computeAccess`, `assertCan`.
- Produces: `updateAccessSettings(actor, { trialDays: int 0..90; subscriptionPriceRub: int 0..100000 | null }): Promise<void>` — требует `subscriptions.pricing`.

- [ ] **Шаг 1.** Тест `settings.test.ts`: тренер с `subscriptions.pricing` меняет `trialDays` на 14 → новый клиент получает пробный период 14 дней; актор без права → `ForbiddenError`; `trialDays: 120` → ошибка валидации.
- [ ] **Шаг 2.** `trainer/layout.tsx` — доступ, только если `can(actor, 'subscriptions.grant')` или `clients.view`, иначе 404.
- [ ] **Шаг 3.** `/trainer/subscriptions`: поиск по имени/телефону; фильтры-чипы «Все», «Пробные», «Заканчиваются (7 дней)», «Истекли»; строка клиента: имя, телефон, статус и «до 7 декабря» (цвет: `warning` если ≤ 7 дней, `danger` если истекла). По нажатию — лист снизу с кнопками «+1 мес», «+3 мес», «До даты…», «Заморозить»/«Разморозить», «Отключить» (подтверждение в диалоге), поле «Цена, ₽» (подставлена цена из настроек) и «Заметка»; под кнопками — история (`subscription_events`, последние 10).
- [ ] **Шаг 4.** `/trainer/settings/access`: «Пробный период, дней», «Цена подписки в месяц, ₽» — сохранить.
- [ ] **Шаг 5.** e2e: вход Максимом (`+79990000002`) → `/trainer/subscriptions` → клиенту 5 «+1 мес» → вход клиентом 5 → открывается `/exercises` (без paywall).
- [ ] **Шаг 6.** `pnpm verify && pnpm test:e2e`. Коммит: `feat(trainer): subscription management and access settings`.

### Задача 9. Отчёт этапа

- [ ] Задеплой на сервер (`scripts/deploy.sh`), проверь вход по телефону с реальным СМС на номер владельца (если ключ СМС-провайдера уже есть).
- [ ] `docs/reports/01-report.md` по шаблону. Отдельным списком — что требуется от владельца: ключи VK/Яндекс/СМС, тексты юридических документов. **Стоп — ждать ревью.**
