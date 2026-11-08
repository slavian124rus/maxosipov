# Этап 3. Тренировки, дневник, офлайн, прогрессия, прогресс тела — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.

**Цель:** полный цикл тренировки без ИИ: у клиента есть программа (из шаблона Максима), он начинает тренировку в свободном или пошаговом режиме, записывает подходы даже без сети, отмечает ощущение и получает рекомендацию веса; видит историю, графики, замеры и фото «до/после».

**Архитектура:** модуль `training` (программы, патчи программ, сессии, подходы, история изменений), модуль `progression` (чистая функция), модуль `body` (замеры, фото). Активная тренировка живёт в IndexedDB (Dexie) и синхронизируется идемпотентно по `client_uuid`.

**Стек:** Drizzle, Zod, Dexie, TanStack Query, Serwist (runtime cache видео), Motion; графики — собственный SVG-компонент без библиотек.

**Спека:** `ARCHITECTURE.md` §7 (тренировки, тело), §9.3 (`ProgramPatch`), §10, §11; `DESIGN.md` §8.1, §8.3–§8.5, §9.2. Эталон экрана тренировки — правый телефон в `prototypes/exercise-card/index.html`.

## Global Constraints

- Охрана доступа — по ARCHITECTURE.md §8.4: каждая клиентская страница начинается с `requireClientPage('<путь>')`, каждая серверная функция/роут с платными данными вызывает `assertClientAccess`. Очереди pg-boss называются через точку (`media.process`), двоеточие запрещено.
- Ощущение — на уровне упражнения в тренировке: кнопки «Легко · Отлично · Тяжело» (`easy | good | hard`), значение пишется во все подходы этого упражнения в этой сессии (`set_logs.feeling`).
- Схема подходов в UI: «3 подхода · 10–12 раз» (кратко), «3 подхода по 10–12 повторений» (полно). Вес: «32,5 кг».
- Шаг веса упражнения = `machines.weight_step_kg`, для свободных весов — 2,5 кг.
- Режим по умолчанию — `free`; переключается в профиле.
- Таймер отдыха (пошаговый режим): `program_exercises.rest_sec`, по умолчанию 90 с; вибрация `navigator.vibrate([200,100,200])` в конце (если доступна).
- Синхронизация: подход сохраняется локально мгновенно; отправка — сразу, при ошибке — очередь с повтором каждые 15 с и при событии `online`.
- Во время активной тренировки — опрос изменений программы раз в 30 с; при изменении — плашка «Максим обновил программу».

## Review Focus

1. Один и тот же подход отправлен дважды (повтор после обрыва) → в БД одна запись (тест задачи 3).
2. Клиент закрыл приложение посреди тренировки без сети → при следующем открытии тренировка продолжается с записанными подходами (e2e задачи 5).
3. Вес с шагом 2,5: 32,5 → 35; снижение 10% от 32,5 кг при шаге 2,5 → 27,5 (`min(floorStep(29.25)=27.5, 30)`) (тест задачи 2).
4. В одной тренировке разные веса подходов (разминочный + рабочие) → рекомендация считается по рабочим (максимальный вес) (тест задачи 2).
5. Программа изменена тренером, пока клиент тренируется → уже записанные подходы не теряются, новые упражнения появляются (тест задачи 3).

---

### Задача 1. Схема данных тренировок и сервис программ

**Files:** Create `src/modules/training/schema.ts` (`programs`, `program_days`, `program_exercises`, `workout_sessions`, `set_logs`, `program_changes`, `ai_proposals` — по ARCHITECTURE §7), `src/modules/training/patch.ts`, `src/modules/training/patch.test.ts`, `src/modules/training/programs.ts`, `src/modules/training/programs.test.ts`; Modify `src/modules/training/index.ts`, `scripts/seed.ts`.

**Interfaces — Produces:**
- `type ProgramTree = { id; ownerId: string | null; authorKind: 'trainer' | 'client' | 'client_ai'; name; status; days: { id; order; name; exercises: { id; order; exerciseId; sets; repMin; repMax; restSec; targetWeightKg: number | null; note: string | null }[] }[] }`
- `programPatchSchema` (Zod, discriminated union по `op`): `add_exercise {dayId, exerciseId, sets, repMin, repMax, restSec?, afterId?}`, `remove_exercise {programExerciseId}`, `replace_exercise {programExerciseId, exerciseId}`, `set_sets_reps {programExerciseId, sets?, repMin?, repMax?, restSec?}`, `set_target_weight {programExerciseId, weightKg|null}`, `reorder {dayId, orderedIds: string[]}`, `add_day {name, afterDayId?}`, `rename_day {dayId, name}`; `type ProgramPatch = { ops: ProgramPatchOp[] }` (1–20 операций).
- `applyPatch(tree: ProgramTree, patch: ProgramPatch, publishedExerciseIds: Set<string>): ProgramTree` — чистая; бросает `PatchError` с человеческим текстом при: несуществующем id, упражнении не из каталога/не опубликованном («Такого упражнения нет в каталоге зала»), `repMin > repMax`, `sets ∉ 1..10`, `reorder` с неполным набором id.
- `diffPrograms(before, after): ProgramDiffLine[]` — `{ kind: 'added'|'removed'|'changed'|'moved'; dayName; text }` для экрана «Что изменится» и истории (тексты: «Добавлено: Жим ногами, 3 подхода · 10–12 раз», «Убрано: …», «Жим ногами: 3 подхода · 10 раз → 4 подхода · 8 раз»).
- `getProgramTree(programId)`, `getActiveProgram(userId)`, `copyTemplateToClient(actor, templateId, clientId): Promise<ProgramTree>` (старая активная → `archived`), `applyProgramPatchAs(actor, programId, patch, actorKind: 'trainer' | 'client' | 'ai_proposal_accepted'): Promise<ProgramTree>` (транзакция: проверка прав — владелец программы или `clients.edit_programs` с областью; применение; запись `program_changes` с `diff`), `createTemplate(actor, name)`, `listTemplates()`, `archiveProgram(actor, id)`.

- [x] **Шаг 1.** Тесты `patch.test.ts` на каждую операцию и на каждую ошибку из Interfaces; `diffPrograms` — тексты ровно как в Interfaces.
- [x] **Шаг 2.** Тесты `programs.test.ts`: клиент применяет патч к своей программе → ок, `program_changes.actor_kind='client'`; клиент к чужой → `ForbiddenError`; тренер с `clients.edit_programs` (own) к программе своего клиента → ок; `copyTemplateToClient` архивирует прежнюю активную; при параллельном применении двух патчей (две транзакции) ни один не теряется (используй `SELECT … FOR UPDATE` на `programs`).
- [x] **Шаг 3.** Реализация → PASS. Сид: шаблон «Старт: 3 дня» (День A — спина и бицепс: тяга верхнего блока 3·10–12, тяга горизонтального блока 3·10–12, подъём штанги на бицепс 3·10–12; День B — ноги: жим ногами 4·10–12, разгибание ног 3·12–15; День C — повтор A), выдан клиентам 1–4. Неопубликованные в сиде упражнения сделай опубликованными с постером-заглушкой (видео — повтор одного из готовых роликов; пометь в сиде комментарием `dev only`).
- [x] **Шаг 4.** `pnpm verify` → коммит `feat(training): programs, patches, change history`.

### Задача 2. Алгоритм прогрессии

**Files:** Create `src/modules/progression/types.ts`, `src/modules/progression/recommend.ts`, `src/modules/progression/recommend.test.ts`, `src/modules/progression/text.ts`, `src/modules/progression/text.test.ts`; Modify `src/modules/progression/index.ts`.

**Interfaces — Produces:**
- `type SessionResult = { date: Date; sets: { weightKg: number; reps: number; feeling: 'easy' | 'good' | 'hard' | null }[] }` (история — **новые первыми**).
- `type ProgressionInput = { target: { sets: number; repMin: number; repMax: number }; stepKg: number; history: SessionResult[] }`
- `type Recommendation = { action: 'increase' | 'keep' | 'decrease' | 'none'; weightKg: number | null; reasonCode: 'increase_streak' | 'increase_easy' | 'keep' | 'decrease' | 'none' }`
- `recommend(input: ProgressionInput, rules: ProgressionRules): Recommendation` (`ProgressionRules` — из `@/modules/gym`).
- `recommendationText(r: Recommendation): string` — тексты DESIGN §9.2 с подставленным весом (формат «35 кг», «32,5 кг»).

Алгоритм (ровно так):
1. Пустая история → `none`, `weightKg: null`.
2. Для каждой сессии: `w` = максимальный вес среди подходов; «рабочие подходы» = подходы с весом `w`; ощущение сессии = `hard`, если хоть один `hard`, иначе ощущение последнего подхода.
3. Текущий вес `W` = `w` последней сессии.
4. **Повышение сразу** (`increase_easy`): `rules.fastTrackOnEasy` и в последней сессии рабочих подходов ≥ `target.sets`, все `reps ≥ repMax`, все ощущения `easy` → `W + step`.
5. **Повышение по серии** (`increase_streak`): последние `rules.sessionsToIncrease` сессий все с `w = W`, в каждой рабочих подходов ≥ `target.sets`, все `reps ≥ repMax`, ощущение сессии ≠ `hard` → `W + step`.
6. **Снижение** (`decrease`): последние `rules.failSessionsToDrop` сессий все с `w = W`, в каждой больше половины рабочих подходов `reps < repMin` → `max(0, min(floorStep(W·(1 − dropPercent/100)), W − step))`, где `floorStep(x) = floor(x/step + 1e-9)·step`, результат округлить до 0,01.
7. Иначе `keep`, `weightKg = W`.

- [x] **Шаг 1.** Тесты `recommend.test.ts` (правила по умолчанию `{2, true, 2, 10}`, цель 3·10–12, шаг 5, если не указано):
  - пусто → `none`;
  - одна сессия 50 кг [12,12,12] `good` → `keep 50`;
  - две сессии 50 [12,12,12] `good`,`good` → `increase 55 increase_streak`;
  - одна сессия 50 [12,12,12] все `easy` → `increase 55 increase_easy`;
  - то же при `fastTrackOnEasy:false` → `keep 50`;
  - старшая сессия 45 [12,12,12], новая 50 [12,12,12] `good` → `keep 50`;
  - две сессии 50 [12,12,12], в одной `hard` → `keep 50`;
  - одна сессия [12,12] `easy` (2 подхода из 3) → `keep 50`;
  - две сессии 50 [8,9,12] → `decrease 45`;
  - две сессии 100 [6,7,8] → `decrease 90`;
  - шаг 2,5: две сессии 32,5 [8,8,8] → `decrease 27.5`; две сессии 32,5 [12,12,12] `good` → `increase 35`;
  - одна провальная сессия → `keep`;
  - разминка 20 кг [15] + рабочие 50 [12,12,12] `good` ×2 сессии → `increase 55`;
  - `W=2.5`, шаг 5, две провальные → `decrease 0`.
- [x] **Шаг 2.** Тесты `text.test.ts`: каждый `reasonCode` → ровно текст DESIGN §9.2 (с весом из рекомендации; для `keep` — «Оставляем 32,5 кг — добиваем 12 повторений во всех подходах», где 12 = `repMax` — добавь `repMax` в аргументы: `recommendationText(r, { repMax })`).
- [x] **Шаг 3.** Реализация → PASS → коммит `feat(progression): deterministic weight recommendation`.

### Задача 3. Сессии, подходы и синхронизация (сервер)

**Files:** Create `src/modules/training/sessions.ts`, `src/modules/training/sessions.test.ts`, `src/app/api/training/sync/route.ts`, `src/app/api/training/program-version/route.ts`.

**Interfaces — Produces:**
- `startSession(userId, { programDayId: string | null, mode: 'free' | 'guided', clientUuid: string, startedAt: Date }): Promise<{ sessionId }>` — идемпотентно по `clientUuid` (колонка `workout_sessions.client_uuid unique`).
- `syncSets(userId, items: { clientUuid; sessionClientUuid; exerciseId; setIndex; weightKg; reps; feeling?; startedAt?; finishedAt?; loggedOffline: boolean }[]): Promise<{ accepted: string[] }>` — upsert по `client_uuid`; чужая сессия → `ForbiddenError`.
- `setExerciseFeeling(userId, sessionClientUuid, exerciseId, feeling)`.
- `finishSession(userId, sessionClientUuid, { finishedAt, comment? })` — ставит задачу `session.summary` (обработчик появится на этапе 4; сейчас задача регистрируется пустой).
- Таблица `next_weights(user_id, exercise_id, weight_kg, updated_at, pk(user_id, exercise_id))`; `setNextWeight(userId, exerciseId, weightKg)`; предзаполнение степпера «Вес»: `next_weights` → вес последней сессии → пусто.
- `getHistoryForExercise(userId, exerciseId, limit = 6): Promise<SessionResult[]>`; `getRecommendations(userId, programDayId): Promise<Record<exerciseId, Recommendation & { text: string }>>`.
- `GET /api/training/program-version?programId` → `{ version: string }` (хэш `updated_at` + число изменений) — для опроса изменений.

- [ ] **Шаг 1.** Тесты: повторная отправка тех же `clientUuid` → одна запись; подходы из разных устройств в одну сессию — сохраняются оба; `setExerciseFeeling` ставит ощущение всем подходам упражнения в сессии; `getRecommendations` возвращает `increase 55` после двух подходящих сессий из сида-фикстуры; изменение программы тренером после `startSession` не меняет уже записанные `set_logs`.
- [ ] **Шаг 2.** Реализация, роуты с `requireUser` и проверкой доступа (`getAccessForUser`) → PASS → коммит `feat(training): sessions and idempotent set sync`.

### Задача 4. Офлайн-хранилище и очередь (клиент)

**Files:** Create `src/lib/offline/db.ts` (Dexie), `src/lib/offline/queue.ts`, `src/lib/offline/queue.test.ts`, `src/lib/offline/use-active-session.ts`; Modify `src/app/sw.ts`.

**Interfaces — Produces:**
- Dexie БД `maxosipov` v1, таблицы: `activeSession` (одна запись: `clientUuid, programDayId, mode, startedAt, programSnapshot`), `sets` (`clientUuid` pk, поля как в `syncSets` + `synced: 0|1`), `feelings`.
- `enqueueSet(set)`, `flushQueue(fetchFn = fetch): Promise<{ sent: number; failed: number }>` — отправляет несинхронизированные пачками по 50, помечает принятые.
- `useActiveSession()` — React-хук: старт/запись подхода/ощущение/завершение, всё сначала в Dexie.
- SW: runtime-кэш `CacheFirst` для `/media/*.mp4|webm|webp` с ключом **без query-параметров** (плагин `cacheKeyWillBeUsed` убирает `exp`, `sig`), лимит 60 записей, 30 дней; при открытии программы клиент вызывает `caches`-предзагрузку видео и постеров упражнений программы (через `postMessage` в SW или прямой `fetch` — опиши выбор).

- [ ] **Шаг 1.** Тесты `queue.test.ts` (`fake-indexeddb`, dev-зависимость): 3 подхода, сеть падает → `failed:3`, все остаются `synced:0`; сеть вернулась → `sent:3`; сервер принял только 2 → третий остаётся в очереди.
- [ ] **Шаг 2.** Реализация → PASS. Повтор отправки каждые 15 с и на `window.online`.
- [ ] **Шаг 3.** `pnpm verify` → коммит `feat(offline): dexie session store and sync queue`.

### Задача 5. Экраны тренировки

**Files:** Create `src/app/(app)/app/(client)/workout/page.tsx`, `src/components/workout/free-mode.tsx`, `src/components/workout/guided-mode.tsx`, `src/components/workout/exercise-logger.tsx`, `src/components/workout/feeling-picker.tsx`, `src/components/workout/recommendation-card.tsx`, `src/components/workout/rest-timer.tsx`, `src/components/workout/finish-summary.tsx`; Modify `src/app/(app)/app/(client)/page.tsx` (Сегодня), `src/app/(app)/app/(client)/workouts/page.tsx`, `src/app/(app)/app/(client)/profile/page.tsx` (переключатель режима), карточка упражнения (кнопка «В тренировку» добавляет упражнение в текущую/свободную тренировку).

- [ ] **Шаг 1.** «Сегодня» (DESIGN §8.1): приветствие «Привет, {имя}», карточка «Сегодня: День A — спина и бицепс» (следующий день программы по кругу после последнего завершённого), кнопка «Начать тренировку»; серия недели (7 точек Пн–Вс, заполненные — дни с завершённой тренировкой); статус подписки, только если осталось ≤ 7 дней («Пробный период: осталось 5 дней»). Нет программы — «Максим скоро подберёт тебе программу» + кнопка «Выбрать шаблон» (список шаблонов → `copyTemplateToClient` от имени клиента — разреши клиенту копировать шаблон себе).
- [ ] **Шаг 2.** Свободный режим — как правый телефон прототипа: шапка «Тренировка · День A», название дня, таймер тренировки, кнопка-микрофон (на этапе 3 скрыта — появится на этапе 4), прогресс «1 из 5 упражнений»; карточки упражнений (превью-видео 62×62 зацикленное без звука, название, «3 подхода · 10–12 раз», подсказка веса); активная карточка раскрывается: видео 5:4 с мини-фигурой справа вверху, подсказка (`recommendationText`), чипы записанных подходов «1: 50 кг · 12 раз», степперы «Вес» (шаг = шаг тренажёра) и «Повторения», кнопка «Записать подход N» (подставлены прошлые значения); после подхода № `sets` — «Как прошло упражнение?» с тремя кнопками и карточкой «В следующий раз: 55 кг ↑» с кнопками «Принять» и «Оставить как есть» — обе записывают вес на следующий раз через `setNextWeight` (рекомендованный или текущий `W`); программу они не меняют; выполненные карточки уходят вниз с галочкой. Внизу «Завершить тренировку».
- [ ] **Шаг 3.** Пошаговый режим (DESIGN §8.4): одно упражнение на экран, видео сверху, «Старт подхода» → «Готово» → ввод веса/повторений → таймер отдыха (кольцо, крупные цифры `font-display` 56px, «+30 с», «Пропустить»), свайп — следующее упражнение.
- [ ] **Шаг 4.** Завершение (DESIGN §8.5): время, число упражнений, объём (сумма вес×повторения, показывать «4 320 кг»), рекорды (максимальный вес по упражнению больше прежнего — золотом). Место под итог МаксИИма (появится на этапе 4).
- [ ] **Шаг 5.** Плашка «Максим обновил программу» при смене версии; по тапу — перечитать программу, записанные подходы сохраняются.
- [ ] **Шаг 6.** e2e: (а) клиент 1 проходит День A в свободном режиме, после трёх подходов выбирает «Легко», видит «В следующий раз: …»; завершает; (б) то же с `context.setOffline(true)` после старта: подходы записываются, перезагрузка страницы офлайн → тренировка на месте; `setOffline(false)` → через ≤ 20 с подходы на сервере (проверка через API).
- [ ] **Шаг 7.** `pnpm verify && pnpm test:e2e` → коммит `feat(workout): free and guided workout screens`.

### Задача 6. История, прогресс, замеры, фото

**Files:** Create `src/modules/body/schema.ts`, `src/modules/body/service.ts`, `src/modules/body/service.test.ts`, `src/components/charts/line-chart.tsx`, `src/app/(app)/app/(client)/progress/page.tsx` (переписать), `src/app/(app)/app/(client)/progress/measurements/page.tsx`, `src/app/(app)/app/(client)/progress/photos/page.tsx`, `src/app/(app)/app/(client)/workouts/[sessionId]/page.tsx`, `src/worker/jobs/process-photo.ts`.

**Interfaces — Produces:**
- `addMeasurement(actor, clientId, { date, weightKg?, chestCm?, waistCm?, hipsCm?, bicepsCm?, thighCm? })` (хотя бы одно поле; сам клиент или `clients.measurements`); `listMeasurements(actor, clientId)`.
- `addProgressPhoto(actor, clientId, { date, pose: 'front'|'side'|'back', mediaId })`; `listProgressPhotos(actor, clientId)` — ссылки подписаны на 10 минут; доступ: сам клиент или `clients.view_photos`.
- Задача `media.photo`: `sharp` → `photo.webp` (длинная сторона 1600) и `thumb.webp` (400), EXIF удаляется.
- `<LineChart points={{x: Date, y: number}[]} unit="кг" />` — SVG, ось дат по-русски («7 нояб»), последнее значение подписано.

- [ ] **Шаг 1.** Тесты `service.test.ts`: пустой замер → ошибка «Заполни хотя бы одно поле»; тренер без `clients.view_photos` не получает фото (`ForbiddenError`); клиент видит только свои.
- [ ] **Шаг 2.** «Прогресс»: выбор упражнения → график рабочего веса по датам; объём за неделю (столбцы последних 8 недель); блоки «Замеры» и «Фото». История тренировок в «Тренировки» → карточка сессии (упражнения, подходы, ощущения).
- [ ] **Шаг 3.** Фото: загрузка через `use-chunked-upload` (`kind: 'progress_photo'`), выбор позы; сравнение «до/после» — две даты рядом, выбор дат чипами.
- [ ] **Шаг 4.** e2e: клиент добавляет замер веса → видит точку на графике; без подписки страница «Прогресс» доступна только для чтения (кнопки добавления скрыты).
- [ ] **Шаг 5.** `pnpm verify && pnpm test:e2e` → коммит `feat(body): measurements, progress photos, charts`.

### Задача 7. Отчёт этапа

- [ ] Деплой. Пройти тренировку на реальном телефоне в зале (в т. ч. в зоне плохой связи). Наблюдения — в отчёт.
- [ ] `docs/reports/03-report.md`. **Стоп — ждать ревью.**
