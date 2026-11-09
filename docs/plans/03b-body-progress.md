# Этап 3b. Прогресс тела, графики, история тренировок + хвосты ревью этапа 3 — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.
> Перед началом прочитай `docs/reports/03-review.md` целиком (раздел «Исправления выполнены» и «Что осталось») — этот этап закрывает «что осталось» и делает задачу 6 из `03-training.md`.

**Цель:** клиент видит, как растут его рабочие веса и объём, вносит замеры, загружает фото прогресса и сравнивает «до/после»; открывает любую прошлую тренировку. Перед этим закрываются хвосты ревью этапа 3, обязательные до выпуска в продакшен (индексы, точность веса, гонки).

**Архитектура:** модуль `body` (замеры, фото прогресса), расширение `training` (агрегаты для графиков), задача `media.photo` (sharp) в `worker`, компонент `LineChart` (собственный SVG, без библиотек графиков).

**Стек:** Drizzle, Zod, sharp (уже в `package.json`), pg-boss, Next.js App Router, `useChunkedUpload` (уже есть).

**Спека:** `ARCHITECTURE.md` §7 (`body_measurements`, `progress_photos`, `media`), §8.4 (охрана доступа), §13; `DESIGN.md` §8.1 («Прогресс»), §8.8 (нет доступа: история, графики и замеры видны), §9.2 (форматы текста). Что уже есть: `docs/reports/03-report.md`, `03-review.md`.

## Global Constraints

- Охрана доступа — по ARCHITECTURE.md §8.4: каждая клиентская страница начинается с `requireClientPage('<путь>')`; серверная функция, которая пишет данные клиента, начинается с `assertCan`/проверки владельца (server action — публичная точка входа). Очереди pg-boss — через точку (`media.photo`).
- **Нет подписки** (`getAccessForUser(userId)` не даёт доступа): «Прогресс», история, графики, замеры и фото **видны**, но кнопки «Добавить замер», «Добавить фото», «Удалить» скрыты, а серверные функции записи отвечают отказом (проверка на сервере обязательна, скрытия кнопок мало).
- Фото прогресса — персональные данные: видят только сам клиент и пользователи с правом `clients.view_photos`; ссылки подписаны на 10 минут (`PHOTO_URL_TTL_SEC`), страницы с фото — `robots: noindex`, оригинал после обработки **удаляется**, из готовых файлов вырезаны EXIF/GPS.
- Вес: «32,5 кг» (запятая, неразрывный пробел) — только через `formatWeight` из `@/modules/progression`. Даты: «7 ноября», «сегодня», «вчера»; на оси графика — «7 нояб». Время и границы дней/недель — по `getGym().timezone` (сейчас `Asia/Krasnoyarsk`), **не** зашитой строкой.
- Схема подходов — «3 подхода · 10–12 раз», символ «×» не используем (`DESIGN.md` §9.2). Интерфейс на «ты».
- Клиентские компоненты не импортируют `@/modules/<модуль>` целиком, если в нём есть БД (иначе драйвер попадёт в клиентский бандл — это уже ломало сборку). Общее выноси в `src/shared/`.
- Только тёмная тема, токены `DESIGN.md`; зоны касания ≥ 48 px; проверка на 375×812.
- Не добавлять зависимости. Если нужна — остановиться и спросить в отчёте.

## Review Focus

1. Клиент **без подписки** видит график, замеры, фото; кнопок добавления нет, а прямой вызов `addMeasurement`/создания загрузки фото отвечает отказом (тесты задач 2 и 3).
2. Тренер **без** `clients.view_photos` не получает ни одной ссылки на фото клиента; клиент не видит чужие (тест задачи 2).
3. Фото после обработки не содержит EXIF (в т. ч. GPS), оригинал удалён, а длинная сторона `photo.webp` ≤ 1600 и `thumb.webp` ≤ 400 (тест задачи 3).
4. Один пользователь не может забить диск: квота на загрузки фото прогресса (задача 3).
5. Вес 62,3 кг после записи и чтения остаётся 62,3 (а не 62,29999…) (тест задачи 0).
6. Не больше одной активной программы на клиента даже при параллельных запросах (тест задачи 0).
7. История упражнения и рекомендации не читают всю историю клиента (тест задачи 0: запрос с `limit` отдаёт ровно N последних тренировок).

---

### Задача 0. Хвосты ревью этапа 3 (F13–F16, F18–F20, F22)

**Files:** Create `drizzle/0016_*.sql` (сгенерировать `pnpm db:generate`, затем **вручную** дописать SQL из шага 1); Modify `src/modules/training/schema.ts`, `src/modules/training/programs.ts`, `src/modules/training/sessions.ts`, `src/modules/training/sessions.test.ts`, `src/modules/training/programs.test.ts`, `src/components/workout/exercise-logger.tsx`, `src/components/workout/free-mode.tsx`, `src/components/workout/guided-mode.tsx`, `src/components/workout/workout-client.tsx`, `src/app/(app)/app/(client)/workout/page.tsx`; Create `src/components/workout/program-update-banner.tsx`, `src/lib/use-program-version.ts`, `e2e/workout-program-update.spec.ts`.

- [x] **Шаг 1. Миграция БД (F15, F16, F14).** Тест сначала (`sessions.test.ts`): записать подход 62,3 кг → прочитать → `62.3` ровно; `getHistoryForExercise(user, ex, 2)` при 5 тренировках возвращает 2 самые новые (и делает один SQL-запрос по `set_logs` с ограничением по сессиям, а не режет в JS).
  1. Типы: `set_logs.weight_kg`, `next_weights.weight_kg`, `program_exercises.target_weight_kg` из `real` в `doublePrecision` (в Drizzle `doublePrecision`, тип в TS остаётся `number`). В SQL миграции привести значения через numeric, чтобы убрать хвосты float4: `ALTER TABLE … ALTER COLUMN weight_kg TYPE double precision USING round(weight_kg::numeric, 2)::double precision;`.
  2. Индексы: `set_logs (session_id)`, `set_logs (exercise_id)`, `workout_sessions (user_id, started_at DESC)`, `workout_sessions (user_id) WHERE finished_at IS NOT NULL`.
  3. Одна активная программа на клиента: **перед** созданием индекса архивировать дубли (оставить самую свежую по `updated_at`): `UPDATE programs SET status='archived' WHERE id IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY owner_id ORDER BY updated_at DESC) rn FROM programs WHERE owner_id IS NOT NULL AND status='active') t WHERE rn > 1);` затем `CREATE UNIQUE INDEX programs_one_active_per_owner ON programs (owner_id) WHERE status = 'active' AND owner_id IS NOT NULL;` (в `schema.ts` объяви его через `uniqueIndex(...).on(...).where(sql…)`).
  4. `copyTemplateToClient`: при нарушении этого индекса (параллельный вызов) повторить транзакцию один раз; тест — два параллельных вызова оставляют ровно одну `active`.
- [x] **Шаг 2. История ограничена в SQL (F15).** `getHistoryForExercise(userId, exerciseId, limit, options)`: сначала подзапрос — последние `limit` сессий пользователя, где есть этот `exerciseId` (по `started_at DESC`), затем подходы только этих сессий. `getRecommendations` — один раз получает дерево дня и историю по всем упражнениям одним запросом на упражнение с этим ограничением (N запросов допустимо, но каждый ограничен).
- [x] **Шаг 3. Транзакционность патча (F13).** `getProgramTree`, `publishedExerciseIds`, `exerciseNames` принимают необязательный `executor` (`db` или `tx`); `applyProgramPatchAs` передаёт `tx`. Поведение и тесты не меняются.
- [x] **Шаг 4. Часовой пояс и выборка недели (F18).** `getWeekWorkoutDays(userId, now, timezone)`: часовой пояс приходит параметром (страница берёт `getGym().timezone`), в SQL берём только сессии с `finished_at >= now - 14 дней`. Тест на границу полуночи для `Asia/Krasnoyarsk` и для `UTC` (разные дни).
- [x] **Шаг 5. Вид тренировки (F19, F20).** Пошаговый режим: видео `aspect-[4/5]` и `max-h-[45vh]`, чтобы «Старт подхода» был виден без прокрутки на 375×812. Вес в чипах подходов и в степпере — через `formatWeight` («32,5 кг»), а не «32.5 кг» (внутреннее значение остаётся числом).
- [x] **Шаг 6. Плашка «Максим обновил программу» (F22).** Хук `useProgramVersion(programId)` опрашивает `GET /api/training/program-version?programId=` раз в 30 с (только пока вкладка видима и есть сеть) и запоминает первую версию; при смене показывается `ProgramUpdateBanner` с текстом «Максим обновил программу» и кнопкой «Обновить». По нажатию — `router.refresh()`: записанные подходы не теряются (они в IndexedDB и `loggedRef`), новые упражнения появляются. `WorkoutClient` получает `programId` из страницы. Если дня текущей тренировки в программе больше нет — показать «Этого дня больше нет в программе. Можно закончить тренировку» и кнопку «Завершить».
- [x] **Шаг 7. e2e `workout-program-update.spec.ts`:** клиент открывает `/workout`, тест через `queryDb` делает `UPDATE programs SET updated_at = now() + interval '1 second' WHERE owner_id = …`, в течение 40 с появляется плашка; после «Обновить» записанный до этого подход на месте.
- [x] **Шаг 8.** `pnpm verify` → коммит `fix(training): indexes, precise weights, program update banner`.

### Задача 1. Схема и сервис замеров

**Files:** Create `src/modules/body/schema.ts`, `src/modules/body/service.ts`, `src/modules/body/service.test.ts`; Modify `src/modules/body/index.ts`, `src/shared/db/schema.ts` (подключить схему), `drizzle/0017_*.sql` (`pnpm db:generate`), `scripts/seed.ts`.

**Interfaces — Produces:**
- Таблица `body_measurements`: `id`, `user_id`, `date` (тип `date`, день по часовому поясу зала), `weight_kg`, `chest_cm`, `waist_cm`, `hips_cm`, `biceps_cm`, `thigh_cm` (все `doublePrecision`, nullable), `entered_by` (uuid, кто внёс), `created_at`, `updated_at`; `UNIQUE (user_id, date)`; индекс `(user_id, date DESC)`.
- `type MeasurementInput = { date: string /* YYYY-MM-DD */; weightKg?: number; chestCm?: number; waistCm?: number; hipsCm?: number; bicepsCm?: number; thighCm?: number }` + Zod-схема `measurementInputSchema` с границами: `weightKg` 30–300, `chestCm`/`waistCm`/`hipsCm` 30–250, `bicepsCm`/`thighCm` 10–120, не больше 1 знака после запятой для веса и см; дата — не в будущем (по часовому поясу зала) и не старше 5 лет.
- `addMeasurement(actor, clientId, input): Promise<MeasurementRow>` — права: `actor.id === clientId` (и у клиента есть доступ — `getAccessForUser`) **или** `clients.measurements` с областью на этого клиента. Хотя бы одно числовое поле, иначе `Error('Заполни хотя бы одно поле')`. Повтор на ту же дату **объединяет** поля (пришедшие значения перезаписывают, непришедшие остаются) — `INSERT … ON CONFLICT (user_id, date) DO UPDATE`.
- `listMeasurements(actor, clientId, { limit = 200 })` — сам клиент (доступ **не** требуется — история видна всегда) или `clients.view` на этого клиента; новые первыми.
- `deleteMeasurement(actor, clientId, id)` — те же права, что у `addMeasurement`.
- Тексты ошибок — человеческие, на «ты»: «Заполни хотя бы одно поле», «Вес должен быть от 30 до 300 кг», «Дата не может быть в будущем».

- [x] **Шаг 1.** Тесты `service.test.ts` сначала: пустой замер → «Заполни хотя бы одно поле»; вес 20 → ошибка границ; вторая запись на ту же дату объединяется (было `weightKg: 80`, пришло `waistCm: 90` → в записи оба); клиент без подписки пишет → отказ, читает → ок; клиент пишет чужому `clientId` → `ForbiddenError`; тренер с `clients.measurements` (область own) пишет своему клиенту → ок, `entered_by` = тренер; тренер без права → `ForbiddenError`; `listMeasurements` чужого клиента без `clients.view` → `ForbiddenError`.
- [x] **Шаг 2.** Реализация → зелёные. Сид: клиенту `+79990000011` добавить 6 замеров веса за 10 недель (80,4 → 78,1) и 3 замера талии — чтобы график не пустой.
- [x] **Шаг 3.** `pnpm verify` → коммит `feat(body): measurements`.

### Задача 2. Фото прогресса: хранение и права

**Files:** Modify `src/modules/body/schema.ts`, `src/modules/body/service.ts`, `src/modules/body/service.test.ts`, `src/modules/media/schema.ts` (`ProcessedPaths`: добавить `photo?`, `thumb?`), `src/modules/media/upload.ts`, `src/modules/media/upload.test.ts`, `src/shared/queues.ts`, `src/modules/media/access.ts`.

**Interfaces — Produces:**
- Таблица `progress_photos`: `id`, `user_id`, `date` (date), `pose` (`'front' | 'side' | 'back'`), `media_id` (uuid, unique), `created_at`; индекс `(user_id, date DESC)`.
- `addProgressPhoto(actor, clientId, { date, pose, mediaId })` — права как у `addMeasurement` (только сам клиент **с доступом**; тренер от имени клиента в этом этапе не добавляет → для `actor.id !== clientId` всегда `ForbiddenError`). Проверки: медиа существует, `kind = 'progress_photo'`, `owner_id = clientId`, ещё не привязано к другой записи; статус может быть любым (обработка идёт в фоне).
- `listProgressPhotos(actor, clientId): Promise<{ id; date; pose; status: 'processing' | 'ready' | 'failed'; photoUrl: string | null; thumbUrl: string | null }[]>` — доступ: сам клиент (доступ-подписка **не** нужна — история видна) или `clients.view_photos` на этого клиента; иначе `ForbiddenError`. Ссылки — `signMediaPath(path, PHOTO_URL_TTL_SEC)`; для `status !== 'ready'` ссылки `null`.
- `deleteProgressPhoto(actor, clientId, id)` — сам клиент с доступом: удаляет запись, строку `media` и каталог файлов (`rm -r` через `safeJoin(mediaRoot(), mediaDir(row))`); тест, что файлов не осталось.
- Очередь `PHOTO_QUEUE = 'media.photo'` в `src/shared/queues.ts` + `QUEUE_TUNING` (`expireInSeconds: 600`, `retryLimit: 1`).
- В `createUpload` (`upload.ts`): разрешить `kind: 'progress_photo'` (только он; `photo` и `exercise_video` — как раньше). Для `progress_photo`: вместо `assertCan('catalog.edit')` — `actor` обязан иметь доступ (`assertClientAccess(actor.id)` или эквивалент из `@/modules/access`), форматы `jpg/png/webp` (HEIC — **не** принимаем: sharp из npm без HEVC-декодера не прочитает HEIC с iPhone; в форме загрузки `accept="image/jpeg,image/png,image/webp"` — Safari сам конвертирует снимок в JPEG), размер ≤ 20 МБ, `processingOptions: null`. **Квоты:** не более 30 загрузок `progress_photo` за 24 часа и не более 300 всего на пользователя (считать строки `media` с `kind='progress_photo'` и `owner_id`); при превышении — «Слишком много фото за сутки. Попробуй завтра» / «Достигнут лимит фото. Удали старые».
- В `completeUpload`: для `progress_photo` ставить в очередь `media.photo` (а не `media.process`).
- `assertCanAccessMedia` (`access.ts`): владелец или `catalog.edit` — как сейчас; для `progress_photo` дополнительно **не** открывать тренеру без `clients.view_photos` (проверка прав на просмотр делается в `listProgressPhotos`, там и выдаются ссылки).

- [x] **Шаг 1.** Тесты (`service.test.ts`, `upload.test.ts`): клиент создаёт загрузку `progress_photo` → ок; без подписки → отказ; HEIC → «Формат фото не поддерживается: нужен jpg, png или webp»; 31-я загрузка за сутки → отказ с текстом квоты; чужое/не `progress_photo` медиа в `addProgressPhoto` → ошибка; `listProgressPhotos`: клиент видит только свои (чужой `clientId` → `ForbiddenError`), тренер без `clients.view_photos` → `ForbiddenError`, с правом (область own, свой клиент) → ок, чужой клиент → `ForbiddenError`; ссылки имеют `exp` ≈ now+600 с; `deleteProgressPhoto` удаляет и файлы.
- [x] **Шаг 2.** Реализация → зелёные → коммит `feat(body): progress photos storage and access`.

### Задача 3. Обработка фото (`media.photo`)

**Files:** Create `src/modules/media/photo.ts`, `src/modules/media/photo.test.ts`, `src/worker/jobs/process-photo.ts`, `tests/fixtures/photo/exif-gps.jpg` (сгенерировать скриптом, см. шаг 1); Modify `src/worker/jobs.ts`, `src/modules/media/index.ts`.

**Interfaces — Produces:**
- `processPhoto(row: Media): Promise<ProcessedPaths>` — `sharp(original).rotate()` (применяет EXIF-ориентацию), затем **без** `withMetadata` (EXIF/GPS не переносятся): `photo.webp` — `resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })`, качество 80; `thumb.webp` — то же 400, качество 72. Пути пишутся в `ProcessedPaths.photo` и `.thumb` (относительно `MEDIA_ROOT`, внутри `mediaDir(row)`). Оригинал **удаляется** сразу после успешной записи обоих файлов.
- `processPhotoJob({ mediaId })` в `process-photo.ts`: аналог `processMediaJob`: `processing` → `ready` либо `failed` с текстом «Не получилось обработать фото: …»; повторная доставка готового — no-op. Регистрация в `registerJobs`.
- Фото больше 24 мегапикселей → `failed` «Фото слишком большое. Сделай снимок в обычном разрешении» (задай `limitInputPixels` в sharp).

- [x] **Шаг 1.** Тест `photo.test.ts`: сгенерировать sharp-ом JPEG 3000×2000 с EXIF (`withExif({ IFD0: { Orientation: '6', Copyright: 'x' } })` — проверь точное имя метода в установленной версии `node_modules/sharp`, не придумывай API) и с GPS-блоком, если версия позволяет; после `processPhoto`: `photo.webp` ≤ 1600 по длинной стороне, `thumb.webp` ≤ 400, у обоих `metadata().exif` отсутствует, ориентация применена (для Orientation=6 ширина и высота поменялись местами), оригинал удалён. Тест на «битый файл» → `failed`, исключение пробрасывается.
- [x] **Шаг 2.** Реализация → зелёные.
- [x] **Шаг 3.** Проверь руками на реальном снимке с телефона (положи любой JPEG с геометкой в `/tmp`, прогони `processPhoto`, `exiftool`/`identify` не должны показать GPS). Результат — в отчёт.
- [x] **Шаг 4.** `pnpm verify` → коммит `feat(media): progress photo processing`.

### Задача 4. Агрегаты для графиков и компонент `LineChart`

**Files:** Create `src/components/charts/line-chart.tsx`, `src/components/charts/line-chart.test.tsx`, `src/components/charts/bar-chart.tsx`, `src/shared/dates.ts`, `src/shared/dates.test.ts`; Modify `src/modules/training/sessions.ts`, `src/modules/training/sessions.test.ts`, `src/modules/training/index.ts`.

**Interfaces — Produces:**
- `src/shared/dates.ts` (без зависимостей от БД, безопасно для клиента): `formatShortDate(date, tz)` → «7 нояб», `formatLongDate(date, tz, now)` → «сегодня» / «вчера» / «7 ноября» (с годом, если не текущий), `dayKey(date, tz)` → `YYYY-MM-DD`, `mondayKey(date, tz)`.
- `getExerciseProgress(userId, exerciseId, { limit = 40 }): Promise<{ date: Date; workingWeightKg: number }[]>` — по завершённым тренировкам: рабочий вес = максимальный вес сессии (как в `recommend()`); по возрастанию даты.
- `getTrainedExercises(userId): Promise<{ exerciseId: string; name: string; sessions: number }[]>` — упражнения, по которым есть хотя бы одна завершённая тренировка; сортировка по числу тренировок убыв.
- `getWeeklyVolume(userId, weeks = 8, timezone): Promise<{ weekStart: string /* понедельник YYYY-MM-DD */; volumeKg: number }[]>` — сумма `weight_kg * reps` завершённых тренировок за каждую из последних `weeks` недель (недели без тренировок — `0`, чтобы столбцы шли подряд), по часовому поясу зала.
- `<LineChart points={{ x: Date; y: number }[]} unit="кг" timezone? ariaLabel />` — SVG на всю ширину (viewBox, `preserveAspectRatio`), высота 180 px; сетка из 3 горизонтальных линий; подпись первой и последней даты («7 нояб»); у последней точки — значение («78,1 кг», запятая, неразрывный пробел); ось Y — «красивые» границы от `min` до `max` с запасом 10 %; при одной точке — крупная точка и подпись; при пустом наборе — не рисуется (родитель показывает пустое состояние). Цвета — токены темы (акцент, `text-muted`).
- `<BarChart bars={{ label: string; value: number }[]} unit="кг" ariaLabel />` — столбцы для объёма за неделю; подпись максимального и последнего значения; «4 320 кг» с неразрывным пробелом как разделителем тысяч.

- [ ] **Шаг 1.** Тесты: `dates.test.ts` (полночь по Красноярску vs UTC, «сегодня/вчера», смена года); `sessions.test.ts` — `getExerciseProgress` берёт максимум, игнорирует незавершённые тренировки и разминочные подходы; `getWeeklyVolume` возвращает 8 элементов подряд с нулями; `line-chart.test.tsx` (vitest + `react-dom/server`, как принято в проекте): одна точка, две точки, плоский график (min = max не делит на ноль), значение подписано «78,1 кг».
- [ ] **Шаг 2.** Реализация → зелёные → коммит `feat(progress): chart components and aggregates`.

### Задача 5. Экран «Прогресс», замеры, история тренировки

**Files:** Modify `src/app/(app)/app/(client)/progress/page.tsx` (переписать); Create `src/app/(app)/app/(client)/progress/measurements/page.tsx`, `src/app/(app)/app/(client)/progress/measurements/actions.ts`, `src/components/progress/exercise-progress.tsx`, `src/components/progress/measurement-form.tsx`, `src/app/(app)/app/(client)/workouts/[sessionId]/page.tsx`; Modify `src/app/(app)/app/(client)/workouts/page.tsx` (ссылки уже есть — страница должна заработать).

- [ ] **Шаг 1. «Прогресс».** `requireClientPage('/progress')` (страница доступна и без подписки). Блоки сверху вниз: (а) «Рабочий вес» — селектор упражнения (чипы по `getTrainedExercises`, первое выбрано) и `LineChart` из `getExerciseProgress`; пустое состояние «Пока нет тренировок. Запиши первую — и здесь появится график»; (б) «Объём за неделю» — `BarChart` из `getWeeklyVolume(…, 8, gym.timezone)`; (в) «Замеры» — график веса тела (`LineChart` из `listMeasurements`), последняя запись текстом («78,1 кг · 12 ноября»), ссылка «Все замеры» → `/progress/measurements`; кнопка «Добавить замер» только при наличии доступа; (г) «Фото» — до 6 превью (`thumbUrl`), ссылка «Фото и сравнение» → `/progress/photos`. Выбор упражнения — параметр `?exercise=<id>` (серверный рендер, без клиентского состояния).
- [ ] **Шаг 2. Замеры.** `/progress/measurements`: список записей (новые первыми; дата «7 ноября», значения «Вес 78,1 кг · Талия 82 см»), форма «Добавить замер» (дата по умолчанию — сегодня по часовому поясу зала; поля вес, грудь, талия, бёдра, бицепс, бедро; `inputMode="decimal"`, запятая и точка принимаются); server action `addMeasurementAction` — **первым действием** `requireClientPage` + `addMeasurement(actor, user.id, input)`, ошибки показываются текстом под формой; удаление записи с подтверждением («Удалить замер от 7 ноября?»). Без подписки форма и кнопки удаления скрыты, список виден.
- [ ] **Шаг 3. Карточка тренировки.** `/workouts/[sessionId]`: `requireClientPage('/workouts')`, `getSessionDetail(user.id, sessionId)` (чужая или несуществующая → `notFound()`), шапка «7 ноября · 54 мин · 4 320 кг» (длительность из `startedAt`/`finishedAt`, объём — `getSessionSummary`), по упражнениям: название и подходы «1: 50 кг · 12 раз», ощущение значком + словом («Легко / Отлично / Тяжело»). Кнопка «Назад» к списку.
- [ ] **Шаг 4.** Проверка руками на 375×812 (скриншоты в `docs/reports/assets/03b-*.png`): «Прогресс» с данными и пустой, «Замеры», «Карточка тренировки».
- [ ] **Шаг 5.** `pnpm verify` → коммит `feat(progress): progress screen, measurements, session history`.

### Задача 6. Фото прогресса: экраны и сравнение «до/после»

**Files:** Create `src/app/(app)/app/(client)/progress/photos/page.tsx`, `src/app/(app)/app/(client)/progress/photos/actions.ts`, `src/components/progress/photo-uploader.tsx`, `src/components/progress/photo-compare.tsx`, `src/components/progress/photo-grid.tsx`.

- [ ] **Шаг 1. Загрузка.** `PhotoUploader` (клиентский): выбор позы (чипы «Спереди · Сбоку · Сзади»), дата (по умолчанию сегодня), кнопка «Сделать фото или выбрать» → `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">` не использовать `capture` (пусть пользователь выберет камеру или галерею сам); загрузка через `useChunkedUpload` (`kind: 'progress_photo'`), прогресс-полоса; после завершения — server action `addProgressPhotoAction({ date, pose, mediaId })`. Ошибки (квота, формат, размер) показываются текстом от сервера. Подсказка над кнопкой: «Снимай при одинаковом свете и в одной позе — так сравнение честнее». Без подписки загрузчик скрыт.
- [ ] **Шаг 2. Сетка и статусы.** `PhotoGrid`: превью 3 в ряд, подпись «7 ноября · Спереди»; фото в обработке — плейсхолдер «Обрабатывается…» (страница обновляется опросом `router.refresh()` раз в 5 с, пока есть `processing`, максимум 2 минуты); `failed` — «Не получилось обработать. Загрузи ещё раз» и кнопка «Удалить»; по нажатию на превью — полноэкранный просмотр `photoUrl`. Удаление — с подтверждением.
- [ ] **Шаг 3. «До/после».** `PhotoCompare`: выбор позы (чипы), две колонки (левая — «До», правая — «После»), под каждой чипы дат этой позы (горизонтальный скролл); по умолчанию «До» — самая ранняя, «После» — самая поздняя; если фото одной позы меньше двух — «Нужно минимум два снимка в одной позе». Ссылки на фото берутся один раз при рендере страницы (срок 10 минут): если страница открыта дольше — при ошибке загрузки картинки показать «Ссылка устарела. Обнови страницу».
- [ ] **Шаг 4.** Страница: `requireClientPage('/progress')`, `export const metadata = { robots: { index: false, follow: false } }`, заголовок ответа `Cache-Control: private, no-store` для страницы с фото (если в проекте нет общего способа — через `headers` в `next.config.ts` для пути `/progress/photos`).
- [ ] **Шаг 5.** Скриншоты 375×812 в `docs/reports/assets/03b-photos-*.png` (сетка, сравнение, «Обрабатывается»). → коммит `feat(progress): progress photos and before/after`.

### Задача 7. e2e и отчёт этапа

**Files:** Create `e2e/progress.spec.ts`; Modify `tests/fixtures/photo/` (добавить `sample.jpg` ≈ 800×1000, сгенерированный sharp-ом).

- [ ] **Шаг 1. e2e.** (а) клиент `+79990000011` открывает «Прогресс» → видит график веса из сида и блок «Рабочий вес»; добавляет замер веса → точка/последнее значение обновились; (б) клиент загружает `sample.jpg` (поза «Спереди») → в течение 30 с превью готово (воркер запущен в e2e — если в `playwright.config.ts` его нет, добавь запуск `pnpm worker` как второй `webServer`; иначе пометь тест `skip` с причиной и опиши в отчёте); (в) клиент с истёкшей подпиской (тот, что использует `paywall.spec.ts`) открывает «Прогресс» и «Замеры»: данные видны, кнопки «Добавить замер»/«Добавить фото» **отсутствуют**; прямой POST server action добавления замера отказывает (проверь через `page.request` на роут/форму либо юнит-тестом, если e2e это не позволяет — и скажи об этом в отчёте); (г) карточка прошлой тренировки открывается из «Тренировок» (создать завершённую тренировку через API `start/sync/finish` в самом тесте).
- [ ] **Шаг 2. Полный прогон на свежей базе.** `pnpm verify`, `pnpm build`, `pnpm test:e2e` (dev) **и** `pnpm build && E2E_PROD=1 pnpm test:e2e` (production; нужен для офлайн-теста Service Worker). Перед каждым прогоном e2e — пересоздать БД (`drop/create`, `db:migrate`, `db:seed`) и убедиться, что в `/etc/hosts` есть `127.0.0.1 app.localhost`.
- [ ] **Шаг 3.** `docs/reports/03b-report.md` по шаблону из `docs/plans/README.md`. В «Отклонения» перечисли всё, что сделал иначе (в т. ч. HEIC). В «Вопросы и риски» — всё, что не проверил (например, реальные снимки с iPhone). **Стоп — ждать ревью.**

---

## Что НЕ входит в этап 3b (не делать)

- Загрузка фото тренером от имени клиента и просмотр фото клиента в кабинете тренера (этап 5; сервис `listProgressPhotos` уже учитывает `clients.view_photos`).
- Свайп между упражнениями в пошаговом режиме (F21) — отложено осознанно.
- Правка/удаление отдельных подходов в активной тренировке.
- ИИ-итоги тренировки и разбор фото (этап 4).
- Сравнение больше двух дат, наложение силуэта, коллажи для соцсетей.
