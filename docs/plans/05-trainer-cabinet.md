# Этап 5. Кабинет тренера, роли в интерфейсе, уведомления — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.

**Цель:** Максим с телефона ведёт всех клиентов: лента «Сегодня», карточка клиента, удобный редактор программ, шаблоны, заметки, откат изменений МаксИИма, настройки; владелец управляет ролями; клиенты и тренер получают push-уведомления.

**Архитектура:** модуль `trainer` агрегирует данные других модулей через их публичные API; модуль `notifications` — Web Push + таблица уведомлений; редактор программ работает только через `applyProgramPatchAs`.

**Стек:** Next.js, Drizzle, `web-push`, `@dnd-kit/core` + `@dnd-kit/sortable` (перетаскивание), pg-boss.

**Спека:** `ARCHITECTURE.md` §8.3, §9.9, §14; `DESIGN.md` §8.9.

## Global Constraints

- Охрана доступа — по ARCHITECTURE.md §8.4: каждая клиентская страница начинается с `requireClientPage('<путь>')`, каждая серверная функция/роут с платными данными вызывает `assertClientAccess`. Очереди pg-boss называются через точку (`media.process`), двоеточие запрещено.
- Нижнее меню тренера: «Сегодня» · «Клиенты» · «Программы» · «Упражнения» · «Ещё». Тренер переключается в режим клиента (своя тренировка) пунктом «Мои тренировки» в «Ещё».
- Все экраны — сначала 375 px, касание ≥ 48 px, главное действие внизу.
- Каждый экран и действие проверяет права через `rbac` (область `own`/`all`). Пункты меню, на которые нет прав, не показываются.
- Push на iPhone работает только в установленном PWA (iOS 16.4+): запрашивать разрешение только по кнопке, никогда при входе.
- Время отправки плановых уведомлений: клиентам — 10:00, сводка тренеру — 09:00 по `Asia/Krasnoyarsk`.
- Тексты уведомлений — ровно из задачи 1.

## Review Focus

1. Тренер с областью `own` открывает по прямой ссылке карточку чужого клиента → 404, а не данные (тест задачи 3).
2. Откат изменения МаксИИма, после которого Максим уже правил программу → понятная ошибка, программа не ломается (тест задачи 4).
3. Подписка на push устарела (410 от push-сервиса) → запись удаляется, остальные устройства получают уведомление (тест задачи 1).
4. Одно и то же плановое уведомление не уходит дважды, если задача запустилась повторно (тест задачи 1).
5. Владелец пытается отнять у себя роль, будучи последним владельцем → ошибка из этапа 0 показана в интерфейсе (e2e задачи 7).

---

### Задача 1. Уведомления и Web Push

**Files:** Create `src/modules/notifications/schema.ts` (+ `push_subscriptions`; `notifications` уже есть — добавь `dedupe_key unique null`, `pushed_at`), `src/modules/notifications/templates.ts`, `src/modules/notifications/templates.test.ts`, `src/modules/notifications/push.ts`, `src/modules/notifications/notify.ts`, `src/modules/notifications/notify.test.ts`, `src/app/api/push/subscribe/route.ts`, `src/components/app/push-opt-in.tsx`, `src/worker/jobs/reminders.ts`, `scripts/gen-vapid.ts`; Modify `src/app/sw.ts` (обработчики `push` и `notificationclick`), `src/shared/env.ts` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:...`).

**Interfaces — Produces:**
- `type NotificationKind = 'sub_ends_3d' | 'sub_ended' | 'program_updated' | 'client_pain' | 'ai_change_accepted' | 'new_client' | 'new_lead' | 'trainer_daily'`.
- `renderNotification(kind, data): { title: string; body: string; url: string; push: boolean }`:
  - `sub_ends_3d` → «Подписка заканчивается» / «Осталось 3 дня. Продли у Максима, чтобы не прерываться» / `/profile` / push
  - `sub_ended` → «Подписка закончилась» / «Продли у Максима — и продолжаем» / `/paywall` / push
  - `program_updated` → «Максим обновил программу» / «Загляни перед тренировкой» / `/workouts` / push
  - `client_pain` → «{имя}: жалоба на боль» / первые 80 символов сообщения / `/trainer/clients/{id}?tab=coach` / push
  - `ai_change_accepted` → «{имя} принял изменение МаксИИма» / первая строка диффа / `/trainer/clients/{id}?tab=program` / **без push**
  - `new_client` → «Новый клиент» / «{имя}, пробный период до {дата}» / `/trainer/clients/{id}` / push
  - `new_lead` → «Заявка с сайта» / «{имя}, {телефон}» / `/trainer/leads` / push
  - `trainer_daily` → «Сводка на сегодня» / «Заканчивается доступ: {n}. Жалоб: {m}» / `/trainer` / push (не отправлять, если оба числа 0)
- `notify(userId, kind, data, dedupeKey?: string): Promise<void>` — пишет строку (при совпадении `dedupe_key` — ничего не делает), если `push` — отправляет на все подписки пользователя; ответы 404/410 — удалить подписку.
- `subscribePush(userId, subscription: PushSubscriptionJSON, userAgent)`.

- [ ] **Шаг 1.** Тесты `templates.test.ts` (каждый вид — ровно тексты выше) и `notify.test.ts` (мок `web-push`): повтор с тем же `dedupeKey` → одна строка, одна отправка; ответ 410 у одной из двух подписок → она удалена, вторая получила.
- [ ] **Шаг 2.** Реализация. `scripts/gen-vapid.ts` печатает пару ключей. SW: `push` → `showNotification(title, { body, icon: '/icons/icon-192.png', badge, data: { url } })`; клик → открыть/сфокусировать окно приложения на `url`.
- [ ] **Шаг 3.** `<PushOptIn>`: карточка «Включи уведомления — напомним о подписке и покажем, когда Максим обновит программу» с кнопкой «Включить»; показывается на «Сегодня» после первой завершённой тренировки и в профиле. На iPhone вне установленного PWA — вместо кнопки подсказка «Сначала установи приложение на экран „Домой“».
- [ ] **Шаг 4.** Задачи воркера: `reminders.clients` ежедневно 10:00 KRAT — `sub_ends_3d` (dedupe `sub3d:<userId>:<ends_at date>`) и `sub_ended` (dedupe `subend:<userId>:<ends_at date>`); `reminders.trainer` 09:00 — `trainer_daily`. Подключи вызовы: `program_updated` — в `applyProgramPatchAs`, если `actorKind='trainer'`; `client_pain` — уже вызывается из этапа 4; `ai_change_accepted` — в `acceptProposal` для программ тренера; `new_client` — в `signInWithVerifiedPhone` для новых.
- [ ] **Шаг 5.** `pnpm verify` → коммит `feat(notifications): web push, templates, reminders`.

### Задача 2. Лента «Сегодня» тренера

**Files:** Create `src/modules/trainer/feed.ts`, `src/modules/trainer/feed.test.ts`, `src/app/(app)/app/trainer/page.tsx`, `src/components/trainer/feed-section.tsx`, `src/components/trainer/bottom-nav.tsx`; Modify `src/app/(app)/app/trainer/layout.tsx`, `src/modules/coach-ai/schema.ts` (+ `ai_messages.resolved_at`, `resolved_by`).

**Interfaces — Produces:** `getTrainerFeed(actor, now): Promise<{ painFlags: FlagItem[]; trainingNow: ClientRef[]; acceptedAiChanges: ProposalItem[]; expiringSoon: SubItem[]; newClients: ClientRef[] }>` — с учётом области прав; `resolveFlag(actor, messageId)`; `markProposalSeen(actor, proposalId)`.

Правила секций: жалобы — `flagged` и не `resolved`, новые сверху; «Тренируются сейчас» — сессия начата < 3 ч назад и не завершена; «Приняли изменения МаксИИма» — `accepted`, программа тренера, `trainer_seen_at` пуст; «Заканчивается доступ» — `trial|active`, конец ≤ 7 дней; «Новые клиенты» — регистрация ≤ 7 дней.

- [ ] Тесты: тренер `own` не видит чужих; разрешённая жалоба исчезает; сессия 4-часовой давности не в «Тренируются сейчас». Экран: секции по порядку, жалобы — красной рамкой сверху с кнопками «Открыть» и «Разобрался»; пустая лента — «Всё спокойно. Клиенты тренируются по плану». → коммит `feat(trainer): today feed`.

### Задача 3. Клиенты и карточка клиента

**Files:** Create `src/modules/trainer/clients.ts`, `src/modules/trainer/clients.test.ts`, `src/modules/trainer/notes.ts`, `src/modules/trainer/notes.test.ts` (таблица `trainer_notes` — ARCHITECTURE §7), `src/app/(app)/app/trainer/clients/page.tsx`, `src/app/(app)/app/trainer/clients/[id]/page.tsx`, `src/components/trainer/client-tabs/*.tsx`.

**Interfaces — Produces:** `NotFoundError` в `src/shared/errors.ts` (`status = 404`; route handlers и страницы превращают его в `notFound()`); `listClients(actor, { query?, filter?: 'all'|'trial'|'expiring'|'expired'|'active' })`; `getClientCard(actor, clientId)` — бросает `NotFoundError` (→ 404) при отсутствии прав; `addNote(actor, clientId, { text, visibleToClient })`, `listNotes(actor, clientId)`; клиенту — `listVisibleNotes(clientId)` (показать в его профиле блоком «Заметки Максима»).

- [ ] **Шаг 1.** Тесты: `own`-тренер, чужой клиент → `NotFoundError`; заметка `visibleToClient:false` не попадает в `listVisibleNotes`.
- [ ] **Шаг 2.** Список: поиск, чипы-фильтры, строка — аватар-инициалы, имя, «последняя тренировка: вчера», статус доступа цветом.
- [ ] **Шаг 3.** Карточка — вкладки: «Профиль» (анкета, ограничения при согласии, подписка с кнопками из этапа 1), «Программа» (редактор, задача 4), «История» (сессии), «Прогресс» (графики, замеры — добавление тренером при `clients.measurements`, фото при `clients.view_photos`), «Заметки», «МаксИИм» (жалобы с контекстом ±3 сообщения, предложения и их статусы; полная переписка **не** показывается).
- [ ] **Шаг 4.** e2e: Максим открывает клиента 1, добавляет заметку «Следи за спиной на тяге», отмечает «показать клиенту» → клиент видит её в профиле. → коммит `feat(trainer): clients and client card`.

### Задача 4. Редактор программ, шаблоны, откат изменений ИИ

**Files:** Create `src/components/trainer/program-editor/*.tsx`, `src/app/(app)/app/trainer/programs/page.tsx`, `src/app/(app)/app/trainer/programs/[id]/page.tsx`, `src/modules/training/revert.ts`, `src/modules/training/revert.test.ts`; Modify `src/modules/training/programs.ts` (`program_changes` хранит `before` и `after` — полные снимки `ProgramTree`), `src/modules/training/index.ts`.

**Interfaces — Produces:**
- `revertChange(actor, changeId): Promise<ProgramTree>` — разрешено, только если это последнее изменение программы; иначе ошибка «После этого программу уже меняли — поправь вручную»; восстанавливает `before` новым изменением с `actor_kind='trainer'`; у связанного `ai_proposals` статус `reverted`.
- `assignTemplate(actor, templateId, clientIds: string[]): Promise<void>` — `copyTemplateToClient` для каждого, в одной транзакции.
- `saveAsTemplate(actor, programId, name)`.

- [ ] **Шаг 1.** Тесты `revert.test.ts`: откат последнего изменения ИИ → программа равна `before`, предложение `reverted`; откат не последнего → ошибка с текстом выше.
- [ ] **Шаг 2.** Редактор (DESIGN §8.9): дни вкладками (+ «Добавить день»), карточки упражнений с ручкой перетаскивания (dnd-kit, сенсоры touch + pointer, задержка 150 мс), тап по «3 подхода · 10–12 раз» → лист с тремя степперами (подходы 1–10, повторения от/до 1–50) и «Отдых» (30–300 с шагом 15); меню карточки: «Заменить упражнение» (каталог, отфильтрованный по основным мышцам текущего, сверху — с тем же тренажёром), «Целевой вес», «Заметка», «Удалить». Каждое действие — сразу патч (`applyProgramPatchAs(..., 'trainer')`), без кнопки «Сохранить»; ошибка — тост с текстом `PatchError`. Внизу: «Сохранить как шаблон».
- [ ] **Шаг 3.** «Программы»: шаблоны (создать, редактировать тем же редактором), «Назначить клиентам» — мультивыбор клиентов → `assignTemplate`.
- [ ] **Шаг 4.** В карточке клиента вкладка «Программа» показывает историю изменений (`diffPrograms`), у изменений МаксИИма — кнопка «Откатить».
- [ ] **Шаг 5.** e2e: Максим перетаскивает упражнение на первое место, меняет схему на 4·8–10 → клиент видит плашку «Максим обновил программу» и новую схему. → коммит `feat(trainer): program editor, templates, revert`.

### Задача 5. Настройки: МаксИИм, прогрессия, расходы, бренд, контакты

**Files:** Create `src/app/(app)/app/trainer/settings/page.tsx` (меню «Ещё»), `src/app/(app)/app/trainer/settings/ai/page.tsx`, `src/app/(app)/app/trainer/settings/progression/page.tsx`, `src/app/(app)/app/trainer/settings/brand/page.tsx`, `src/app/(app)/app/trainer/settings/contacts/page.tsx`, `src/modules/gym/settings.ts`, `src/modules/gym/settings.test.ts`.

**Interfaces — Produces:** `updateAiSettings(actor, { aiMemo: string ≤ 2000; aiDailyLimit: int 0..200; aiPrices })` (право `settings.ai`); `updateProgressionRules(actor, rules)` (право `settings.progression`; `sessionsToIncrease 1..5`, `failSessionsToDrop 1..5`, `dropPercent 5..30`); `updateBrand(actor, { name, shortName, accent: hex, logoMediaId? })` (право `settings.brand`); `updateContacts(actor, { phone, photoMediaId })` (право `settings.brand`); `getAiSpend(actor, month): Promise<{ byModel: { model; tokensIn; tokensOut; costRub }[]; totalRub }>`.

- [ ] Тесты валидации и прав. Экран «Памятка МаксИИма»: большое поле с примером-плейсхолдером «Например: я за технику, а не за вес; новичкам в первый месяц не повышай больше чем на один шаг», счётчик символов. Экран «Правила прогрессии» — объяснение каждого правила одной фразой. Экран расходов — сумма за месяц и по моделям. → коммит `feat(trainer): settings screens`.

### Задача 6. Роли и права (владелец)

**Files:** Create `src/app/(app)/app/trainer/settings/roles/page.tsx`, `src/app/(app)/app/trainer/settings/roles/[id]/page.tsx`, `src/app/(app)/app/trainer/settings/people/page.tsx`, `src/app/(app)/app/trainer/settings/audit/page.tsx`, `src/modules/rbac/labels.ts`.

**Interfaces — Produces:** `PERMISSION_LABELS: Record<Permission, { group: 'Клиенты' | 'Подписки' | 'Контент' | 'Настройки' | 'Система'; label: string }>` — подписи на русском для каждого из 16 кодов (например `clients.view_photos` → «Видеть фото „до/после“»), используй их во всём интерфейсе.

- [ ] Экраны: список ролей (системная «Владелец» с замком, без кнопок изменения); редактор роли — группы прав с переключателями и выбором области «Свои клиенты / Все» для `clients.*`; «Люди» — поиск пользователя, смена роли, назначение тренера клиенту (`trainer_id`); «Журнал» — `role_audit` по датам («Владелец выдал роль „Тренер“ пользователю +7 999 …, 12 ноября 14:05»). Доступ: `roles.manage` / `users.assign_roles`.
- [ ] e2e: владелец создаёт роль «Администратор ресепшена» с `subscriptions.grant` → назначает пользователю → тот видит «Подписки», не видит «Программы»; попытка снять роль у себя как последнего владельца → ошибка «Нельзя снять последнего владельца».
- [ ] Коммит `feat(rbac): roles and people management ui`.

### Задача 7. Статистика (минимум)

**Files:** Create `src/modules/trainer/stats.ts`, `src/modules/trainer/stats.test.ts`, `src/app/(app)/app/trainer/settings/stats/page.tsx`.

**Interfaces — Produces:** `getStats(actor, now): Promise<{ activeClients: number; trials: number; trialToPaidRate: number | null; workoutsLast7d: number; aiMessagesLast7d: number }>` (право `analytics.view`); `trialToPaidRate` = доля клиентов, у которых после `trial_started` был `granted`, среди тех, чей пробный период закончился за последние 90 дней.

- [ ] Тесты на расчёт доли (0 закончившихся → `null`). Экран — 5 карточек-метрик. → коммит `feat(trainer): basic stats`.

### Задача 8. Отчёт этапа

- [ ] Деплой; Максим проходит на своём телефоне: открыть ленту, поправить программу клиенту, выдать подписку, получить push о жалобе (смоделировать с тестового клиента).
- [ ] `docs/reports/05-report.md`. **Стоп — ждать ревью.**
