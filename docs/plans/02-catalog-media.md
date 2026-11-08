# Этап 2. Каталог, медиа, фигура мышц, мышцы на видео — план реализации

> **Для исполнителя:** работай строго по `docs/plans/README.md`. Задачи по порядку, чекбоксы `- [ ]` → `- [x]`.

**Цель:** Максим с телефона добавляет упражнение (видео → тренажёр → мышцы на фигуре → текст → публикация); видео автоматически обрабатывается (стабилизация, цвет, бесшовный цикл, ролик «мышцы на видео»); клиент видит каталог и карточку упражнения как в прототипе `prototypes/exercise-card/`.

**Архитектура:** модули `catalog` (мышцы, тренажёры, упражнения) и `media` (загрузка, файлы, подписанные ссылки, очередь обработки). Обработка видео — задача pg-boss в `worker`: Node вызывает ffmpeg и Python-скрипты из `media-tools/` (MediaPipe). Раздача файлов — Caddy с `forward_auth` на `web`.

**Стек:** Drizzle, pg-boss, ffmpeg (+ libvidstab), Python 3 + numpy + opencv-python-headless + scipy + mediapipe, React (клиентский компонент фигуры).

**Спека:** `ARCHITECTURE.md` §7 (каталог, media), §13; `DESIGN.md` §6, §6.5, §7, §8.2, §8.9. Эталоны: `prototypes/exercise-card/` (вид карточки, `figure.json`), `prototypes/muscle-overlay/` (рабочая проба подсветки).

## Global Constraints

- Охрана доступа — по ARCHITECTURE.md §8.4: каждая клиентская страница начинается с `requireClientPage('<путь>')`, каждая серверная функция/роут с платными данными вызывает `assertClientAccess`. Очереди pg-boss называются через точку (`media.process`), двоеточие запрещено.
- Коды мышц — ровно 27 из `DESIGN.md` §6.3; слои SVG — `id="m-<code>"`, симметричные — `m-<code>-l`, `m-<code>-r`.
- Видео на выходе: 720×1280 (9:16), H.264 `-preset slow -crf 25 -movflags +faststart`, без звука; WebM VP9 `-crf 36 -b:v 0`; постер `poster.webp` (кадр №3). Ролик 5–12 с, бесшовный.
- Цветокоррекция (единый стиль): `eq=contrast=1.08:saturation=0.86:gamma=0.97,curves=master='0/0.03 0.5/0.47 1/0.97',vignette=PI/5`.
- Хранилище: `MEDIA_ROOT/<yyyy>/<mm>/<mediaId>/` — `original.<ext>`, `video.mp4`, `video.webm`, `poster.webp`, `muscles.mp4`. Исходник удаляется через 30 дней после `ready`.
- Загрузка: куски по 5 МБ, видео ≤ 300 МБ, форматы `mp4/mov/m4v/webm`; фото ≤ 20 МБ, `jpg/png/webp/heic`.
- Ссылки на медиа: `/media/<path>?exp=<unix>&sig=<hex>`, HMAC-SHA256(`path + exp`, `MEDIA_URL_SIGNING_SECRET`), срок 6 часов для видео упражнений, 10 минут для фото прогресса.
- Публикация упражнения: видео `ready` + ≥ 1 основная мышца + ≥ 1 шаг «Как делать».
- Ошибка подсветки мышц не роняет обработку: ролик публикуется без `muscles.mp4`.

## Review Focus

1. Вертикальное видео с тегом поворота (iPhone `rotation`/displaymatrix) и горизонтальное — оба дают правильно ориентированный 9:16 (тест задачи 5 на двух образцах из `Видео для примера как заниматься/`).
2. Обрыв загрузки посередине → докачка с того же куска, без повторной загрузки всего файла (тест задачи 3).
3. Подпись ссылки подделана или истекла → 403; путь с `..` → 400 (тест задачи 3).
4. Человек частично вне кадра / MediaPipe не нашёл позу на части кадров → ролик с подсветкой не создаётся, упражнение всё равно `ready` (тест задачи 6).
5. Упражнение без видео или без мышц нельзя опубликовать — понятная ошибка в форме (тест задачи 4).

---

### Задача 1. Справочник мышц

**Files:** Create `src/modules/catalog/schema.ts` (таблица `muscles`), `src/modules/catalog/muscles.ts`, `src/modules/catalog/muscles.test.ts`; Modify `scripts/seed.ts`, `src/modules/catalog/index.ts`.

**Interfaces — Produces:** `MUSCLES` — `as const` массив `{ code, nameRu, view }` (27 шт.); `type MuscleCode`; `muscleName(code): string`; таблица `muscles(code pk, name_ru, view, svg_layer_id)`.

Названия (ровно так):
- спереди: `neck` Шея · `traps-upper` Верх трапеций · `delts-front` Передние дельты · `delts-side` Средние дельты · `chest` Грудные · `biceps` Бицепс · `brachialis` Плечевая мышца · `forearms-flexors` Сгибатели предплечья · `serratus` Передняя зубчатая · `abs` Пресс · `obliques` Косые мышцы живота · `hip-flexors` Сгибатели бедра · `adductors` Приводящие бедра · `quads` Квадрицепсы · `tibialis` Передняя большеберцовая;
- сзади: `traps-middle` Средняя часть трапеций · `delts-rear` Задние дельты · `rhomboids` Ромбовидные · `lats` Широчайшие · `teres` Большая круглая · `triceps` Трицепс · `forearms-extensors` Разгибатели предплечья · `lower-back` Разгибатели спины · `glutes` Ягодичные · `glutes-medius` Средняя ягодичная · `hamstrings` Бицепс бедра · `calves` Икры.

- [x] Тест: 27 кодов, все уникальны, 15 `front` + 12 `back`, `svg_layer_id = 'm-' + code`. → реализация → сид (upsert) → коммит `feat(catalog): muscles reference`.

### Задача 2. Компонент фигуры мышц

**Files:** Create `public/figure/front.svg`, `public/figure/back.svg`, `scripts/build-temp-figure.ts`, `scripts/check-figure.ts`, `src/components/muscle-figure/muscle-figure.tsx`, `src/components/muscle-figure/state.ts`, `src/components/muscle-figure/state.test.ts`.

**Interfaces — Produces:**
- `<MuscleFigure view="front"|"back" primary={MuscleCode[]} secondary={MuscleCode[]} onMuscleTap?={(code) => void} pulse?={boolean} size="sm"|"md"|"lg" />`
- `defaultView(primary: MuscleCode[]): 'front' | 'back'` — сторона, где больше основных мышц (при равенстве `front`).
- `cycleMuscle(state: { primary: MuscleCode[]; secondary: MuscleCode[] }, code): state` — нет → основная → помогающая → нет.

- [x] **Шаг 1.** Временная фигура: `scripts/build-temp-figure.ts` строит `front.svg`/`back.svg` из `prototypes/exercise-card/figure.json` (силуэт `sil` + пары контуров). Соответствие ключей прототипа кодам: front — `traps-upper`→`traps-upper`, `delts`→`delts-front`, `chest`→`chest`, `biceps`→`biceps`, `forearms`→`forearms-flexors`, `abs`→`abs`, `obliques`→`obliques`, `quads`→`quads`, `adductors`→`adductors`, `calves`→`tibialis`; back — `traps`→`traps-middle`, `delts-rear`→`delts-rear`, `lats`→`lats`, `triceps`→`triceps`, `forearms`→`forearms-extensors`, `lower-back`→`lower-back`, `glutes`→`glutes`, `hamstrings`→`hamstrings`, `calves`→`calves`. Первый контур пары — `-l`, второй — `-r`. Голова — эллипс `cx=100 cy=30 rx=15 ry=19`, шея — `rect x=93 y=44 w=14 h=14 rx=4`, `viewBox="22 0 156 400"`. **Новые контуры мышц не рисовать** — недостающие коды просто отсутствуют (финальную фигуру по фото Максима делает дизайнер: DESIGN §6.2).
- [x] **Шаг 2.** `scripts/check-figure.ts` — печатает, каких из 27 кодов нет в SVG. Запусти, вывод приложи в отчёт.
- [x] **Шаг 3.** Тесты `state.test.ts` для `defaultView` и `cycleMuscle` (включая: мышца из `secondary` → убирается; `primary` и `secondary` не пересекаются). → реализация → PASS.
- [x] **Шаг 4.** Компонент: загружает SVG (инлайном через `fetch` один раз + кэш в модуле), красит слои: idle `#3A3A40` обводка `#131316` 1.1, силуэт `#26262B`, основные `#FF3B30` + фильтр свечения + пульс 1.6 с (opacity 1↔0.78; выключить при `prefers-reduced-motion` и `pulse={false}`), помогающие `#FF8A80` `fill-opacity .7`. Отсутствующая в SVG мышца — тихо пропускается. Переключение сторон — свайп по фигуре и сегмент «Спереди / Сзади» (как в прототипе). `role="img"` + `aria-label` «Основные: …; помогают: …».
- [x] **Шаг 5.** Витрина на `/dev/ui` с примерами (тяга верхнего блока: `lats` / `traps-middle, delts-rear, biceps, forearms-extensors`). Скриншот в отчёт. Коммит `feat(ui): muscle figure component`.

### Задача 3. Медиа: загрузка, хранение, подписанные ссылки

**Files:** Create `src/modules/media/schema.ts`, `src/modules/media/paths.ts`, `src/modules/media/paths.test.ts`, `src/modules/media/sign.ts`, `src/modules/media/sign.test.ts`, `src/modules/media/upload.ts`, `src/modules/media/upload.test.ts`, `src/app/api/media/route.ts` (POST создать), `src/app/api/media/[id]/chunk/route.ts` (PUT), `src/app/api/media/[id]/complete/route.ts` (POST), `src/app/api/media/[id]/route.ts` (GET статус), `src/app/api/media/auth/route.ts` (для Caddy); Modify `docker/Caddyfile`, `src/shared/env.ts` (`MEDIA_ROOT`, `MEDIA_URL_SIGNING_SECRET` — обязательны).

**Interfaces — Produces:**
- Таблица `media` (ARCHITECTURE §7) + колонки `size_bytes`, `received_chunks int[]`, `total_chunks int`, `mime`, `processing_options jsonb` (`{ cropX: number 0..1 default 0.5; loopStart?: number; loopEnd?: number }`).
- `mediaDir(media: { id; createdAt }): string` (относительный путь `yyyy/mm/id`); `safeJoin(root, rel): string` — бросает на `..` и абсолютные пути.
- `signMediaPath(relPath, ttlSec, now?): string` (готовый URL `/media/...?...`), `verifyMediaRequest(relPath, exp, sig, now?): boolean`.
- `createUpload(actor, { kind, fileName, sizeBytes, mime }): Promise<{ id; chunkSize: 5242880; totalChunks }>`; `putChunk(id, index, body: ReadableStream | Buffer)`; `completeUpload(id): Promise<void>` (проверяет, что все куски есть, склеивает в `original.<ext>`, ставит `status='uploaded'`, кладёт задачу `media.process` в очередь); `getMediaStatus(id)`.
- Права: `exercise_video` — `catalog.edit`; `progress_photo` — сам клиент или `clients.measurements` (используется на этапе 3).

- [x] **Шаг 1.** Тесты `paths.test.ts`, `sign.test.ts` (валидная подпись → true; изменён путь/exp → false; истекло → false; `safeJoin('/data/media','../etc/passwd')` бросает). → реализация → PASS.
- [x] **Шаг 2.** Тесты `upload.test.ts` (временная папка как `MEDIA_ROOT`): 3 куска по порядку → `complete` склеивает, размер совпадает; кусок 2 повторно — идемпотентно; `complete` без куска 1 → ошибка `Не все части загружены`; файл 301 МБ → ошибка `Видео больше 300 МБ`; `mime` `image/gif` → ошибка формата. → реализация → PASS.
- [x] **Шаг 3.** `/api/media/auth`: читает заголовки `X-Forwarded-Uri` от Caddy, разбирает путь/`exp`/`sig`, `verifyMediaRequest` → 200 или 403; путь с `..` → 400.
- [x] **Шаг 4.** Caddyfile — в блок `app.maxosipov.ru`:
  ```
  handle_path /media/* {
    forward_auth web:3000 {
      uri /api/media/auth
      copy_headers X-Forwarded-Uri
    }
    root * /srv/media
    header Cache-Control "private, max-age=21600"
    file_server
  }
  ```
  Сверь синтаксис `forward_auth` с документацией Caddy 2. В dev (без Caddy) — роут `src/app/media/[...path]/route.ts`, отдающий файл после той же проверки (только при `NODE_ENV !== 'production'`), с поддержкой `Range` для видео.
- [x] **Шаг 5.** Клиентский загрузчик `src/components/upload/use-chunked-upload.ts`: режет файл на куски по 5 МБ, отправляет последовательно с 3 повторами на кусок, при обрыве спрашивает статус (`GET /api/media/[id]` → `received_chunks`) и продолжает с недостающих; прогресс 0–100.
- [x] **Шаг 6.** `pnpm verify` → коммит `feat(media): chunked upload, storage, signed urls`.

### Задача 4. Тренажёры и упражнения

**Files:** Create `src/modules/catalog/schema.ts` (+ `machines`, `exercises` по ARCHITECTURE §7, включая `overlay_profile`), `src/modules/catalog/slug.ts`, `src/modules/catalog/slug.test.ts`, `src/modules/catalog/service.ts`, `src/modules/catalog/service.test.ts`, `src/modules/catalog/validation.ts`.

**Interfaces — Produces:**
- `slugify(nameRu: string): string` — транслитерация ГОСТ-подобная (а→a … ж→zh, х→kh, ц→ts, ч→ch, ш→sh, щ→shch, ы→y, э→e, ю→yu, я→ya, ь/ъ → ''), нижний регистр, `-` вместо пробелов и прочего, без повторных `-`.
- `type ExerciseInput = { name; machineId: string | null; primaryMuscles: MuscleCode[]; secondaryMuscles: MuscleCode[]; videoMediaId: string | null; steps: string[]; mistakes: string[]; tips: string | null; defaultRepMin: int 1..50; defaultRepMax: int ≥ repMin ≤ 50; overlayProfile: 'none' | 'pull_vertical' | 'pull_horizontal' }`
- `createMachine(actor, { name, zone, weightStepKg, photoMediaId? })`, `updateMachine`, `listMachines()`.
- `createExercise(actor, input)`, `updateExercise(actor, id, input)`, `publishExercise(actor, id)`, `unpublishExercise(actor, id)`, `archiveExercise(actor, id)` (ставит `archived_at`; из каталога пропадает, в истории остаётся).
- `listExercises(filter: { muscle?: MuscleCode; machineId?: string; query?: string; status?: 'published' | 'draft' | 'all' }): Promise<ExerciseListItem[]>`; `getExercise(idOrSlug): Promise<ExerciseDetail | null>` (с подписанными URL видео/постера/`muscles.mp4`).
- Права: изменения — `catalog.edit`, публикация — `catalog.publish`.

- [x] **Шаг 1.** Тесты `slug.test.ts`: «Тяга верхнего блока к груди» → `tyaga-verkhnego-bloka-k-grudi`; «Жим ногами 45°» → `zhim-nogami-45`; дубликат слага в сервисе → `-2`.
- [x] **Шаг 2.** Тесты `service.test.ts`: публикация без видео → ошибка `Добавь видео`; без основной мышцы → `Отметь хотя бы одну основную мышцу`; без шагов → `Добавь хотя бы один шаг «Как делать»`; видео в статусе `processing` → `Видео ещё обрабатывается`; мышца одновременно в primary и secondary → ошибка валидации; клиент не может создать упражнение (`ForbiddenError`); `listExercises({muscle:'lats'})` находит упражнение, где `lats` основная **или** помогающая (основные — первыми); черновики не видны в `status:'published'`; поиск по `query` без учёта регистра и «ё/е».
- [x] **Шаг 3.** Реализация → PASS → коммит `feat(catalog): machines and exercises`.

### Задача 5. Обработка видео (worker)

**Files:** Create `media-tools/requirements.txt`, `media-tools/find_loop.py`, `media-tools/probe.py`, `src/worker/jobs/process-media.ts`, `src/modules/media/pipeline.ts`, `src/modules/media/pipeline.test.ts`, `tests/fixtures/video/` (2 коротких ролика: возьми из `prototypes/exercise-card/assets/` и сделай из исходников `Видео для примера…` по 6 секунд: `ffmpeg -t 6`); Modify `docker/Dockerfile` (python3, venv `/opt/mt`, `pip install -r media-tools/requirements.txt`, ffmpeg с libvidstab — проверь `ffmpeg -filters | grep vidstab`; если в alpine нет — смени базовый образ runner на `node:22-bookworm-slim` и `apt-get install ffmpeg`), `src/worker/jobs.ts`.

**Interfaces — Produces:**
- `buildPipelineCommands(input: { src: string; outDir: string; width: number; height: number; rotation: number; cropX: number; loop: { start: number; end: number } }): string[][]` — чистая функция, возвращает массивы аргументов ffmpeg по порядку (тестируемо без запуска ffmpeg).
- `find_loop.py <video> → JSON {"start": float, "end": float, "mse": float}`; `probe.py <video> → JSON {"width","height","rotation","duration","fps"}` (rotation из `side_data_list`/`tags.rotate`).
- Задача `media.process` (`{ mediaId }`): статус `processing` → шаги → `ready` с `processed_paths` или `failed` с `error` (человеческий текст для Максима: «Не получилось обработать видео: …»).

Порядок шагов (значения из пробы, не менять без согласования):
1. `probe` → если нужно, поворот (`transpose`) по `rotation`.
2. Стабилизация: `vidstabdetect=shakiness=6:accuracy=15:result=<trf>` → `vidstabtransform=input=<trf>:smoothing=40:zoom=4:optzoom=0,unsharp=5:5:0.6` → промежуточный `stab.mp4` (`-crf 16 -preset veryfast -an`).
3. Петля: если в `processing_options` нет `loopStart/loopEnd` — `find_loop.py stab.mp4`: кадры 64×64 в градациях серого; пропустить первые 2,0 с; среди пар (s, e) с `5 ≤ e−s ≤ 12` с выбрать минимальную MSE.
4. Сборка ролика: `trim [s+0.4, e]` + кроссфейд 0,4 с хвоста `[e, e+0.4]` в голову `[s, s+0.4]` (`xfade=transition=fade:duration=0.4:offset=0`, затем `concat`) — ровно как в пробе (`prototypes/muscle-overlay/README.md` и история ARCHITECTURE §13); если `e+0.4` > длительности — `e` уменьшить на 0,4.
5. Кадр 9:16: если исходник вертикальный — `scale=720:1280`; если горизонтальный — `crop=cw:ih:x:0`, где `cw = floorEven(ih*9/16)`, `x = floorEven(clamp(cropX*iw − cw/2, 0, iw − cw))`, затем `scale=720:1280` (`floorEven(n)` — наибольшее чётное ≤ n).
6. Цвет: фильтр из Global Constraints, `format=yuv420p`.
7. Выходы: `video.mp4`, `video.webm`, `poster.webp` (`select=eq(n\,3)`).

- [x] **Шаг 1.** Тесты `pipeline.test.ts` на `buildPipelineCommands`: вертикальное видео — нет `crop`, есть `scale=720:1280`; горизонтальное 1280×720 при `cropX=0.5` → `crop=404:720:438:0`; `cropX=0` → `crop=404:720:0:0`; `cropX=1` → `crop=404:720:876:0`; rotation 90 → в цепочке есть `transpose=1`. → реализация → PASS.
- [x] **Шаг 2.** Интеграционный тест (помечен `@slow`, запускается `pnpm test:media`): прогон обоих роликов-фикстур → длительность выхода 5–12 с, размер 720×1280, число кадров mp4 = webm (±1), постер существует.
- [x] **Шаг 3.** Задача в worker, ограничение параллелизма 1 (одно видео за раз), таймаут 15 минут. Очистка исходников: ежедневная задача `media.cleanup` удаляет `original.*` у `ready` старше 30 дней.
- [x] **Шаг 4.** `pnpm verify` → коммит `feat(media): video processing pipeline`.

### Задача 6. Мышцы на видео (worker)

**Files:** Create `media-tools/pose.py`, `media-tools/overlay.py`, `media-tools/profiles.py`, `media-tools/test_profiles.py`, `media-tools/models/` (модель скачивается при сборке образа), `src/worker/jobs/muscle-overlay.ts`; Modify `docker/Dockerfile` (скачать `pose_landmarker_heavy.task` по URL из `prototypes/muscle-overlay/README.md` в `/opt/mt/models/pose_heavy.task`), `src/worker/jobs/process-media.ts` (после шага 7 — если у связанного упражнения `overlay_profile ≠ 'none'`, поставить задачу `media.overlay`; при смене профиля в упражнении — тоже).

**Interfaces — Produces:**
- `pose.py <video.mp4> <out.npz>` — порт `prototypes/muscle-overlay/pose.py` (параметры из пробы) + запись доли кадров с найденной позой.
- `overlay.py <video.mp4> <pose.npz> <profile> <out.mp4>` — порт `render.py`, параметризованный профилем; кодирует через ffmpeg pipe (`-preset slow -crf 24`). Выход: то же число кадров, что у `video.mp4`.
- `profiles.py`: `PROFILES = { 'pull_vertical': {...}, 'pull_horizontal': {...} }` — для каждого: функция основной области, функция помогающей области, «сустав усилия» и направление (сгибание локтя = усилие для обоих тяг).
- Задача `media.overlay` (`{ mediaId, profile }`): успех → `processed_paths.muscles_mp4`; если поза найдена < 90% кадров → не создавать ролик, записать в лог причину, статус медиа остаётся `ready`.

Правила переноса из пробы (обязательно):
1. Видимую руку выбирать по средней `visibility` точек локтя (13 vs 14), а не по номеру; плечо/запястье — той же стороны.
2. «Спина» = нормаль к оси плечи→таз, направленная **от** носа (точка 0).
3. Сглаживание точек: `gaussian_filter1d(σ=1.6, mode='wrap')`; угол локтя: `σ=2`.
4. Интенсивность `I = 0.22 + 0.78·smoothstep(f)`, `f` = нормированное сгибание локтя.
5. Область широчайших (оба профиля): полосы по оси t∈(0.10; 0.88), граница от спины `u > UM − wf·(UM−Um)`, `wf = 0.78 − 0.36·tn`, минус капсула плеча (радиус 0.17 длины плеча); текстура волокон `0.9 + 0.1·sin(proj/2.6)`. `pull_horizontal` дополнительно: основная — `traps-middle` (верхняя треть той же полосы ближе к спине, t∈(0.05; 0.35)), помогающая — `delts-rear`.
6. Помогающая для обоих — бицепс: капсула плеча, `tt∈(0.18; 0.9)`, передняя сторона.
7. Композиция: фон × `(0.62 + 0.38·mask)`; основное ядро — альфа `core·(0.30+0.55·I)`, цвет BGR `(48,59,255)`; помогающее — `sec·(0.30+0.45·I)`, BGR `(128,138,255)`; ореол — `halo·(0.25+0.55·I)·0.55`, ограничен расширенной маской силуэта.

- [x] **Шаг 1.** `test_profiles.py` (pytest): на синтетических точках (стоящий человек, нос справа) область широчайших лежит слева от оси; при видимом левом локте используется левая рука; при позе < 90% кадров `overlay.py` завершается кодом 3 и не пишет файл.
- [x] **Шаг 2.** Порт кода → тесты зелёные (`pnpm test:py` = `/opt/mt/bin/pytest media-tools`).
- [ ] **Шаг 3.** Прогон на фикстуре тяги верхнего блока (профиль `pull_vertical`) и горизонтальной тяги (`pull_horizontal`): сохрани по 6 кадров-раскадровке (`ffmpeg ... tile=6x1`) в `docs/reports/assets/02-overlay-*.jpg`. Ролик тяги верхнего блока должен визуально совпадать с `prototypes/exercise-card/assets/lat-pulldown-muscles.mp4`.
- [x] **Шаг 4.** `pnpm verify` → коммит `feat(media): muscle overlay on video`.

### Задача 7. Каталог и карточка упражнения (клиент)

**Files:** Create `src/app/(app)/app/(client)/exercises/page.tsx` (переписать), `src/app/(app)/app/(client)/exercises/[slug]/page.tsx`, `src/components/exercise/exercise-video.tsx`, `src/components/exercise/exercise-card.tsx`, `src/components/exercise/exercise-list-item.tsx`.

**Interfaces — Consumes:** `listExercises`, `getExercise`, `<MuscleFigure>`, `muscleName`.

- [ ] **Шаг 1.** Каталог (DESIGN §8.1 «Упражнения»): сверху `<MuscleFigure size="md">` с переключателем сторон — касание мышцы выбирает фильтр (выбранная — основная подсветка, повторное касание снимает), чип «Все мышцы»; поиск; горизонтальные чипы тренажёров. Список: превью-постер 62×62 (радиус 14), название, тренажёр, «Основные: …». Пустой результат: «Таких упражнений пока нет — Максим добавляет новые каждую неделю».
- [ ] **Шаг 2.** Карточка (DESIGN §8.2, вид — как `prototypes/exercise-card/index.html`, левый телефон): видео 9:16 с затемнением, назад, «Показывает Максим», полоса прогресса цикла, переключатель **«Мышцы»** (если есть `muscles_mp4`; два синхронизированных `<video>`, смена прозрачности 450 мс, рассинхрон > 0,06 с исправлять; выбор хранить в `localStorage` ключ `muscles-on`, по умолчанию вкл.), тап — пауза; чипы (группа мышц, тренажёр, зона); название `font-display` 34px; блок «Какие мышцы работают» (фигура + списки «Основные» / «Помогают», тап по названию — мышца мигает); «Как делать» (нумерация красным `font-display`); «Частые ошибки»; нижняя панель: «Спросить МаксИИма» (ведёт на `/coach?exercise=<slug>`; до этапа 4 — на заглушку) и «В тренировку» (до этапа 3 — неактивна).
- [ ] **Шаг 3.** Видео: `<video muted playsInline loop autoPlay preload="metadata" poster>` c `<source>` webm и mp4; без сети — постер и текст «Видео загрузится, когда появится связь».
- [ ] **Шаг 4.** e2e: клиент открывает каталог → тап по «Широчайшие» → видит «Тяга верхнего блока к груди» → карточка → переключатель «Мышцы» выключается/включается.
- [ ] **Шаг 5.** `pnpm verify && pnpm test:e2e` → коммит `feat(catalog): client catalog and exercise card`.

### Задача 8. Кабинет тренера: тренажёры и «добавить упражнение за минуту»

**Files:** Create `src/app/(app)/app/trainer/exercises/page.tsx`, `src/app/(app)/app/trainer/exercises/new/page.tsx`, `src/app/(app)/app/trainer/exercises/[id]/page.tsx`, `src/app/(app)/app/trainer/exercises/actions.ts`, `src/app/(app)/app/trainer/machines/page.tsx`, `src/components/trainer/exercise-form.tsx`, `src/components/trainer/video-crop.tsx`.

- [ ] **Шаг 1.** Список упражнений тренера: вкладки «Опубликованы» / «Черновики»; у каждого статус видео («Обрабатывается…», «Готово», «Ошибка: …»), значок «Мышцы на видео» если есть `muscles_mp4`.
- [ ] **Шаг 2.** Мастер «Добавить упражнение» (DESIGN §8.9), шаги на отдельных экранах:
  1. «Видео» — кнопка «Снять или выбрать видео» (`<input type="file" accept="video/*" capture="environment">`), загрузка с прогрессом; для горизонтального видео — превью кадра и ползунок «Где ты в кадре» (`cropX`); подсказка со стандартом съёмки DESIGN §7 (свернутая, «Как снимать»).
  2. «Тренажёр» — выбор из списка или «Новый тренажёр» (название, зона, шаг веса: 1 / 2,5 / 5 кг).
  3. «Мышцы» — `<MuscleFigure>` с `onMuscleTap` = `cycleMuscle`; подсказка «Одно касание — основная, второе — помогает, третье — убрать»; ниже списки выбранного; выбор «Подсветка на видео»: «Нет» / «Тяга сверху» / «Тяга горизонтальная».
  4. «Описание» — название, диапазон повторений (два степпера), «Как делать» (список шагов, добавить/удалить/перетащить), «Частые ошибки», «Совет». (Кнопка «Черновик от МаксИИма» появится на этапе 4.)
  5. «Проверка» — предпросмотр карточки как у клиента + «Опубликовать» / «Сохранить черновик». Ошибки публикации — тексты из задачи 4.
- [ ] **Шаг 3.** Редактирование упражнения — те же экраны; замена видео запускает обработку заново, пока новое видео не готово — клиенты видят старое.
- [ ] **Шаг 4.** `/trainer/machines`: список, добавить/изменить (название, зона, шаг веса, фото).
- [ ] **Шаг 5.** Сид: тренажёры «Блочный тренажёр (верхняя тяга)», «Горизонтальная тяга», «Жим ногами»; упражнения «Тяга верхнего блока к груди» и «Тяга горизонтального блока» (опубликованы, видео — из `prototypes/exercise-card/assets/`, копируются в `MEDIA_ROOT` с `status='ready'`; подсветка для первого — `lat-pulldown-muscles.mp4`), ещё 3 черновика без видео: «Жим ногами», «Разгибание ног», «Подъём штанги на бицепс».
- [ ] **Шаг 6.** e2e (мобильный вьюпорт): Максим проходит мастер с фикстурным видео до «Сохранить черновик»; после обработки (в тесте — дождаться статуса до 3 минут) публикует; клиент видит упражнение в каталоге.
- [ ] **Шаг 7.** `pnpm verify && pnpm test:e2e` → коммит `feat(trainer): exercise wizard and machines`.

### Задача 9. Отчёт этапа

- [ ] Деплой, загрузка с реального телефона Максима одного нового ролика, снятого по стандарту. Время обработки одного ролика на сервере — в отчёт.
- [ ] `docs/reports/02-report.md`; приложить вывод `scripts/check-figure.ts` и раскадровки подсветки. **Стоп — ждать ревью.**
