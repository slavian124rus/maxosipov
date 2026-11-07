# Отчёт: этап 1

Все шаги плана `docs/plans/01-auth-access.md` выполнены, кроме деплоя на сервер
(нет SSH и продакшн-окружения) — см. «Вопросы и риски».

## Сделано — по задачам, с хэшами коммитов

| Задача | Что сделано | Коммит |
|---|---|---|
| 1. Телефон, сессии, текущий пользователь | `normalizePhone`/`formatPhone` (E.164, 12 тестов), таблицы `sessions`/`auth_accounts`, `users.pd_consent_at`, `createSession`/`validateSessionToken` (sha256 в БД, продление при <30 днях)/`destroySession`, `getCurrentUser`/`requireUser` | `2e0c0a7` |
| 2. СМС и одноразовые коды | `SmsProvider` + `smsru` (по докам SMS.ru) + `console`, `requestOtp`/`verifyOtp` (4 цифры, 5 мин, 3/номер/час, 20/IP/час, 5 попыток), таблица `otp_codes`, `SMS_PROVIDER` (значения `console` / `smsru`) + обязательный `SMS_API_KEY` для smsru | `14aaea2` |
| 3. Вход по телефону | `signInWithVerifiedPhone` (создание клиента, привязка способов входа, ошибки при повторной привязке), экраны `/login`, `/login/phone`, `/login/code` (маска, 4 ячейки, автоотправка, повтор через 60 с), `POST /api/auth/logout` | `3d64852` |
| 4. Яндекс ID и VK ID | PKCE (S256) + подписанный state (HMAC, 10 мин), `yandex.ts`/`vk.ts` (обмен кода, разбор профиля, 15 тестов), `pending_links` для «провайдер не дал телефон», роуты `start`/`callback`, `docs/ops/oauth-setup.md` | `0c41415` |
| 5. Модуль `access` | `subscriptions`/`subscription_events`/`trial_registry`, `addMonthsClamped` (31 января → конец февраля), `computeAccess`, `startTrialIfEligible`/`grant`/`freeze`/`unfreeze`/`disable`/`getAccessForUser`/`expireSubscriptions`, задача воркера `subscriptions.expire` раз в час, сид подписок | `74b5fde` |
| 6. Анкета и согласия | `clientProfileSchema` (Zod), `saveOnboarding` (ограничения пишутся только при согласии), 7 экранов анкеты с прогрессом, финал «Пробный месяц активирован до {дата}» + подсказка установки PWA, `content/legal/*.md` + 3 юр. страницы | `a57f382` |
| 7. Оболочка и охрана | `decideRoute` (8 тестов), `(client)/layout.tsx` с нижним меню (центральная красная «МаксИИм» 54×54), экраны Сегодня/Тренировки/МаксИИм/Упражнения/Прогресс/Профиль, `/paywall` с контактами из `gyms.settings.contacts`, `x-pathname` в middleware | `292171b` |
| 8. Подписки у тренера | `updateAccessSettings` (право `subscriptions.pricing`, 3 теста), `trainer/layout.tsx` (доступ по правам), `/trainer/subscriptions` (поиск, чипы, лист с «+1/+3/+6 мес», «До даты», заморозка, отключение с подтверждением, история), `/trainer/settings/access` | `0405fd7` |
| 9. Отчёт | этот файл | — |

## Как проверить — команды и шаги руками (URL, логины тестовых пользователей)

### Подготовка

```bash
docker compose -f docker/compose.dev.yml up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Сид создаёт: зал, 5 ролей, владельца `+79990000001`, Максима `+79990000002`,
клиентов `+79990000011…15` (пробные 25/5/1 день, оплачен на 2 месяца, истёк 3 дня назад).
Все тестовые клиенты уже прошли анкету.

**Код входа в dev:** `1111` для любых номеров вида `+7999000xxxx`, СМС не отправляется.

### Вход и доступ

| Что | Как | Ожидание |
|---|---|---|
| Экран входа | <http://app.localhost:3000/login> | «Тренируйся с Максимом», кнопки VK/Яндекс (скрыты без ключей), MAX с «скоро», ссылка «Войти по номеру телефона» |
| Вход по телефону | ссылка → номер `+79990000099` → код `1111` | попадаем на `/onboarding` |
| Анкета | 7 шагов, в конце галочка ПДн → «Начать» | «Пробный месяц активирован до 7 декабря» |
| Повторный вход | тем же номером | сразу на главную (анкета не спрашивается) |
| Профиль | аватар в шапке «Сегодня» → `/profile` | имя, телефон, «Пробный период до …», «Выйти» |
| Без подписки | вход `+79990000015` → `/exercises` | редирект на `/paywall`; `/progress` открывается |
| Paywall | `/paywall` | «Подписка закончилась. Продли у Максима — и продолжаем», кнопки MAX/Позвонить (появятся после заполнения контактов в сиде) |

### Кабинет тренера

| Что | Как | Ожидание |
|---|---|---|
| Вход Максимом | `+79990000002` → код `1111` | доступ в кабинет |
| Список подписок | `/trainer/subscriptions` | клиенты с цветными статусами, чипы «Все/Пробные/Заканчиваются/Истекли», поиск по имени и телефону |
| Продление | выбрать клиента → «+1 мес» | статус меняется на «Подписка», в истории появляется запись |
| Заморозка | «Заморозить» → «Разморозить» | после разморозки дата окончания сдвигается на срок заморозки |
| Настройки | `/trainer/settings/access` | «Пробный период, дней», «Цена подписки в месяц, ₽» |
| Закрыто клиенту | клиент открывает `/trainer/subscriptions` | 404 |

### Проверки БД

```bash
docker compose -f docker/compose.dev.yml exec -T db psql -U app -d maxosipov \
  -c "select status, count(*) from subscriptions group by status"
# 3 trial, 1 active, 1 expired (после e2e клиент 5 может быть disabled)

docker compose -f docker/compose.dev.yml exec -T db psql -U app -d maxosipov \
  -c "select phone, onboarding_completed_at is not null as onboarded from users where phone like '+799900000%'"
```

## Результаты: pnpm lint / pnpm test / pnpm test:e2e — вывод последних строк

```
$ pnpm verify
$ eslint . && tsc --noEmit      → ошибок нет
 Test Files  20 passed (20)
      Tests  126 passed (126)
```

```
$ pnpm test:e2e
Running 5 tests using 1 worker
  ok 1 [mobile] › e2e\login-phone.spec.ts:9:1 › вход по номеру телефона ведёт на анкету (1.7s)
  ok 2 [mobile] › e2e\paywall.spec.ts:4:1 › просроченный клиент: /exercises → /paywall, /progress доступен (1.3s)
  ok 3 [mobile] › e2e\smoke.spec.ts:3:1 › без сессии на app.localhost открывается экран входа (419ms)
  ok 4 [mobile] › e2e\smoke.spec.ts:8:1 › лендинг на localhost показывает имя тренера (297ms)
  ok 5 [mobile] › e2e\trainer-subscriptions.spec.ts:4:1 › Максим продлевает подписку клиенту, клиент получает доступ (9.3s)
  5 passed (17.7s)
```

```
$ pnpm build
 ✓ Compiled successfully
 /app, /app/coach, /app/exercises, /app/legal/*, /app/login, /app/login/code, /app/login/phone,
 /app/onboarding, /app/paywall, /app/profile, /app/progress,
 /app/trainer/settings/access, /app/trainer/subscriptions, /app/workouts
```

## Отклонения от плана — что и почему

1. **Имя очереди воркера: `subscriptions.expire`, а не `subscriptions:expire`.** pg-boss 12
   запрещает `:` в именах очередей (`Name can only contain alphanumeric characters,
   underscores, hyphens, periods, or forward slashes`). Воркер падал на старте — проверено запуском.
2. **В dev для номеров `+7999000xxxx` отключены лимиты OTP.** Код фиксированный, СМС не уходит;
   без этого e2e-прогоны упирались в «3 запроса на номер в час» при повторных запусках.
   В production ветка недостижима (`NODE_ENV === 'production'`). Unit-тесты лимитов используют
   обычный номер `+79991234567` и проверяют настоящее поведение.
3. **`otp_codes.created_at` пишется из JS, а не из БД.** Иначе окно «час» считалось по часам
   Postgres, а тесты двигают время через `vi.setSystemTime` — лимиты не воспроизводились.
4. **`react-hook-form` не установлен.** Формы сделаны на `useActionState` + контролируемых
   полях: для 7 шагов анкеты и двух экранов входа этого достаточно, а пакет остался бы
   неиспользованным. Появится, когда понадобятся сложные формы (этап 3/5) — тогда добавлю.
5. **`rbac/service.ts` и `access/service.ts` читают `users` из `@/shared/db/schema`, а не из
   `@/modules/auth`.** Иначе получался цикл `auth → access → rbac → auth`, и воркер тянул
   `next/headers` из `auth/index.ts`. Границы модулей не нарушены: `shared/db/schema.ts` —
   единственная точка, которой разрешён импорт схем модулей.
6. **VK ID: адрес авторизации `https://id.vk.ru/authorize`, а не `id.vk.com` из плана.**
   Так указано в актуальной документации VK ID; обмен токена и профиль — `id.vk.com/oauth2/auth`
   и `/oauth2/user_info` (как в плане). Расхождение записано в `docs/ops/oauth-setup.md`.
7. **`x-pathname` в заголовке запроса.** Layout не знает текущий путь, поэтому middleware
   прокидывает его в `x-pathname` до rewrite — на этом построена охрана `(client)/layout.tsx`.
8. **Юридические страницы рендерятся минимальным собственным рендерером** (заголовок `#` + абзацы),
   без markdown-библиотеки — тексты сейчас заглушки, лишняя зависимость не нужна.
9. **Анкета: финальный экран — состояние внутри того же маршрута** (`/onboarding`), а не отдельная
   страница: после сохранения action возвращает дату окончания пробного периода, клиент показывает
   «Пробный месяц активирован до …» и подсказку установки PWA (iPhone — SVG, Android — `beforeinstallprompt`).
10. **`trial_registry` получила `created_at`/`updated_at`** кроме `used_at` — правило проекта
    «у всех таблиц есть оба поля».
11. **Сид помечает тестовых клиентов как прошедших анкету** (`onboarding_completed_at`,
    `pd_consent_at`). Иначе охрана уводила их на `/onboarding`, и сценарий paywall не проверялся.
12. **e2e: `workers: 1`, `timeout: 60s`, общий `e2e/helpers.ts`.** Файлы меняют одни и те же данные
    сида (клиент 5), а dev-сервер компилирует страницы на лету. Хелпер ждёт гидратацию по работе
    маски телефона — до гидратации React сбрасывает введённое значение.
13. **Вход в e2e — случайный dev-номер** (`+7999000xxxx`), а не фиксированный `+79990000099`:
    иначе повторный прогон приводил существующего пользователя на главную вместо `/onboarding`.
14. **Тест кабинета тренера в конце отключает клиента 5**, чтобы набор тестов не зависел от порядка
    запуска (paywall-тест ожидает отсутствие доступа).
15. **`/paywall` вне группы `(client)`** — по плану; поэтому у него нет нижнего меню.
16. **Деплой на сервер не выполнялся** — нет SSH-доступа и продакшн-переменных (см. ниже).

## Что требуется от владельца

1. **Ключи и приложения:**
   - СМС: аккаунт СМС.ру → `SMS_PROVIDER=smsru`, `SMS_API_KEY`. Пока не заданы — в dev код
     печатается в лог (`console`), в production без ключа отправка невозможна.
   - VK ID: `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, redirect URI
     `https://app.maxosipov.ru/api/auth/vk/callback` и `http://app.localhost:3000/api/auth/vk/callback`.
   - Яндекс ID: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, право `login:default_phone`,
     redirect URI `https://app.maxosipov.ru/api/auth/yandex/callback`.
   - Инструкция по шагам: `docs/ops/oauth-setup.md`.
2. **Юридические тексты** — `content/legal/privacy.md`, `consent.md`, `health-consent.md`.
   Сейчас там заглушка «ТЕКСТ ПРЕДОСТАВИТ ВЛАДЕЛЕЦ». Юридический текст я не сочинял.
3. **Контакты Максима для экрана «нет доступа»** — `gyms.settings.contacts`
   (`phone`, `maxUrl`, `photoUrl`). В сиде `null`, поэтому на paywall сейчас видна только
   монограмма «МО» и ссылка «Посмотреть мой прогресс».
4. **Деплой и проверка реальной СМС** (`scripts/deploy.sh`, затем вход на свой номер) —
   у исполнителя нет SSH к FirstVPS и продакшн-`.env`.

## Вопросы и риски

1. **Деплой не выполнен.** Шаг «Задеплой на сервер…» в плане не отмечен: нет доступа.
   После вашего деплоя нужно проверить: `curl -s https://app.maxosipov.ru/api/health`,
   вход по номеру с реальной СМС, `/trainer/subscriptions` под Максимом.
2. **OAuth проверен только тестами.** Без ключей VK/Яндекс реальный вход не прогонялся:
   проверены PKCE, подпись state, разбор ответов провайдеров (моки `fetch`) и поведение
   роутов без ключей (редирект на `/login?error=oauth`).
3. **Адрес авторизации VK** — `id.vk.ru` по документации. Если VK ответит ошибкой на шаге
   авторизации, первым делом проверить константу `VK_AUTHORIZE` в `src/modules/auth/oauth/vk.ts`.
4. **Лимиты OTP в dev отключены для `+7999000xxxx`** (отклонение 2). Если нужно проверять
   лимиты руками — использовать номер не из этого диапазона и `SMS_PROVIDER=console`.
5. **`react-hook-form` из стека не используется** (отклонение 4) — решите, нужен ли он сейчас
   или дождёмся этапа 3, где форм будет много.
6. **`cleanupPendingLinks` написана, но нигде не вызывается.** Просроченные `pending_links`
   чистятся только при обращении (запись удаляется при использовании). Если нужен ночной
   сборщик мусора — это отдельная задача (план её не содержит).
7. **Состояние клиента 5 после e2e** — `disabled` (тест сам отключает его в конце). Перед
   ручной проверкой paywall: `pnpm db:seed` не перезаписывает существующую подписку —
   сбросить можно через `update subscriptions set status='expired' where user_id=(select id from users where phone='+79990000015')`.
8. **`middleware.ts` → `proxy.ts`** (вопрос с этапа 0) всё ещё открыт: Next 16 предупреждает
   об устаревшей конвенции. Этап 1 добавил в middleware `x-pathname` — при переименовании
   это нужно учесть.
9. **Нет теста на `/api/auth/logout`** и на `pending_links` (проверено руками и через e2e-выход).
10. **Даты в UI** — по `Asia/Krasnoyarsk` через `Intl`, без библиотек; для «сегодня/вчера»
    форматирование появится на этапе 3 вместе с дневником.

## Версии установленных пакетов (из package.json)

Новых пакетов на этапе 1 не добавлялось (см. отклонение 4). Актуальный состав:

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

Среда: Node.js 22.18.0, pnpm 12.18.0, PostgreSQL 17 (dev-контейнер, порт 5433).
Миграции этапа: `0002` (sessions, auth_accounts, pd_consent_at), `0003` (otp_codes),
`0004` (pending_links), `0005` (subscriptions, subscription_events, trial_registry),
`0006` (client_profiles). Всего в БД 12 таблиц.

---

**Стоп — жду ревью.** Этап 1b (MAX) и этап 2 не начинаю.
