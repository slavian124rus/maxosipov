import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { enqueueJob } from '@/shared/queue'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { media } from '@/modules/media'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { createExercise, createMachine, getExercise, listExercises, publishExercise, updateExercise } from './service'
import type { ExerciseInput } from './validation'

vi.mock('@/shared/queue', () => ({ enqueueJob: vi.fn(async () => {}) }))

let actor: Actor
let client: Actor
let readyVideoId: string
let processingVideoId: string

const baseInput: ExerciseInput = {
  name: 'Тяга верхнего блока к груди',
  machineId: null,
  primaryMuscles: ['lats'],
  secondaryMuscles: ['biceps'],
  videoMediaId: null,
  steps: ['Сядь и зафиксируй колени', 'Тяни рукоять к груди'],
  mistakes: ['Рывки корпусом'],
  tips: null,
  defaultRepMin: 10,
  defaultRepMax: 12,
  overlayProfile: 'pull_vertical',
}

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()

  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск, ул. Говорова',
      brand: {
        name: 'Максим Осипов',
        shortName: 'МаксИИм',
        colors: { accent: '#E5322D' },
        logoUrl: null,
      },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: {
          sessionsToIncrease: 2,
          fastTrackOnEasy: true,
          failSessionsToDrop: 2,
          dropPercent: 10,
        },
        aiMemo: '',
      },
    })
    .returning()

  const gymId = gym!.id
  const ownerId = '00000000-0000-4000-8000-000000000010'

  actor = {
    id: ownerId,
    roleId: '00000000-0000-4000-8000-000000000001',
    gymId,
    isOwner: true,
    permissions: [],
  }
  client = {
    id: '00000000-0000-4000-8000-000000000011',
    roleId: '00000000-0000-4000-8000-000000000002',
    gymId,
    isOwner: false,
    permissions: [],
  }

  const [ready] = await db
    .insert(media)
    .values({
      kind: 'exercise_video',
      ownerId,
      status: 'ready',
      sizeBytes: 1000,
      mime: 'video/mp4',
      totalChunks: 1,
      originalPath: '2026/11/ready/original.mp4',
      processedPaths: {
        mp4: '2026/11/ready/video.mp4',
        webm: '2026/11/ready/video.webm',
        poster: '2026/11/ready/poster.webp',
      },
    })
    .returning()

  const [processing] = await db
    .insert(media)
    .values({
      kind: 'exercise_video',
      ownerId,
      status: 'processing',
      sizeBytes: 1000,
      mime: 'video/mp4',
      totalChunks: 1,
    })
    .returning()

  readyVideoId = ready!.id
  processingVideoId = processing!.id
})

/**
 * Тренажёр с фото (`machine_photo`). `photo = null` — тренажёр без фото.
 * Пути по умолчанию такие же, как после `processPhoto`: `photo.webp` + `thumb.webp`.
 */
async function createMachineWithPhoto(
  name: string,
  photo: {
    kind?: 'machine_photo' | 'progress_photo'
    status?: 'ready' | 'processing'
    paths?: { photo?: string; thumb?: string } | null
  } | null,
): Promise<string> {
  let photoMediaId: string | null = null

  if (photo) {
    const [row] = await db
      .insert(media)
      .values({
        kind: photo.kind ?? 'machine_photo',
        ownerId: actor.id,
        status: photo.status ?? 'ready',
        sizeBytes: 1000,
        mime: 'image/webp',
        totalChunks: 1,
        processedPaths:
          photo.paths === null
            ? null
            : (photo.paths ?? {
                photo: '2026/11/machine/photo.webp',
                thumb: '2026/11/machine/thumb.webp',
              }),
      })
      .returning()

    photoMediaId = row!.id
  }

  const machine = await createMachine(actor, { name, zone: 'Ноги', weightStepKg: 5, photoMediaId })
  return machine.id
}

test('публикация без видео и без фото тренажёра → «Добавь видео или фото тренажёра»', async () => {
  const exercise = await createExercise(actor, baseInput)
  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )
})

test('без видео публикуется по готовому фото тренажёра', async () => {
  const machineId = await createMachineWithPhoto('Жим ногами 45°', {})
  const exercise = await createExercise(actor, { ...baseInput, machineId })

  expect((await publishExercise(actor, exercise.id)).status).toBe('published')
})

test('фото тренажёра ещё обрабатывается → не публикуем', async () => {
  const machineId = await createMachineWithPhoto('Гакк-машина', { status: 'processing' })
  const exercise = await createExercise(actor, { ...baseInput, machineId })

  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )
})

test('у тренажёра нет готовых файлов фото → не публикуем', async () => {
  const machineId = await createMachineWithPhoto('Бабочка', { paths: null })
  const exercise = await createExercise(actor, { ...baseInput, machineId })

  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )
})
test('фото прогресса клиента не заменяет фото тренажёра', async () => {
  // Иначе личный снимок клиента уехал бы в общий каталог по подписанной ссылке.
  const machineId = await createMachineWithPhoto('Скамья для пресса', { kind: 'progress_photo' })
  const exercise = await createExercise(actor, { ...baseInput, machineId })

  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )

  const detail = await getExercise(exercise.id, { includeDrafts: true })
  expect(detail?.photoUrl).toBeNull()
  expect(detail?.thumbUrl).toBeNull()
})

test('фото чужого тренажёра не помогает опубликовать упражнение', async () => {
  await createMachineWithPhoto('Тяга верхнего блока', {})
  const exercise = await createExercise(actor, baseInput) // machineId: null

  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )
})

test('мышцы и шаги обязательны и для упражнения с фото тренажёра', async () => {
  const machineId = await createMachineWithPhoto('Жим ногами сидя', {})

  const noMuscles = await createExercise(actor, {
    ...baseInput,
    name: 'Без мышц',
    machineId,
    primaryMuscles: [],
  })
  await expect(publishExercise(actor, noMuscles.id)).rejects.toThrow(
    'Отметь хотя бы одну основную мышцу',
  )

  const noSteps = await createExercise(actor, { ...baseInput, name: 'Без шагов', machineId, steps: [] })
  await expect(publishExercise(actor, noSteps.id)).rejects.toThrow(
    'Добавь хотя бы один шаг «Как делать»',
  )
})

test('getExercise отдаёт подписанные photoUrl и thumbUrl, когда видео нет', async () => {
  const machineId = await createMachineWithPhoto('Сгибание ног лёжа', {})
  const exercise = await createExercise(actor, { ...baseInput, machineId })
  await publishExercise(actor, exercise.id)

  const detail = await getExercise(exercise.slug)
  expect(detail?.videoMp4Url).toBeNull()
  expect(detail?.hasVideo).toBe(false)
  expect(detail?.photoUrl).toMatch(
    /^\/media\/2026\/11\/machine\/photo\.webp\?exp=\d+&sig=[0-9a-f]+$/,
  )
  expect(detail?.thumbUrl).toMatch(
    /^\/media\/2026\/11\/machine\/thumb\.webp\?exp=\d+&sig=[0-9a-f]+$/,
  )
})
test('в списке упражнение без видео несёт фото тренажёра', async () => {
  const machineId = await createMachineWithPhoto('Парта для бицепса', {})
  const exercise = await createExercise(actor, { ...baseInput, machineId })
  await publishExercise(actor, exercise.id)

  const [item] = await listExercises({ status: 'published' })
  expect(item?.id).toBe(exercise.id)
  expect(item?.hasVideo).toBe(false)
  expect(item?.posterUrl).toBeNull()
  expect(item?.photoUrl).toContain('machine/photo.webp')
  expect(item?.thumbUrl).toContain('machine/thumb.webp')
})

test('у упражнения с видео постер остаётся постером видео', async () => {
  const machineId = await createMachineWithPhoto('Рычажная тяга', {})
  const exercise = await createExercise(actor, { ...baseInput, machineId, videoMediaId: readyVideoId })
  await publishExercise(actor, exercise.id)

  const [item] = await listExercises({ status: 'published' })
  expect(item?.hasVideo).toBe(true)
  expect(item?.posterUrl).toContain('ready/poster.webp')

  const detail = await getExercise(exercise.slug)
  expect(detail?.posterUrl).toContain('ready/poster.webp')
  // Фото тренажёра всё равно отдаём: оно нужно, если видео заменят или ролик не загрузится.
  expect(detail?.photoUrl).toContain('machine/photo.webp')
})

test('фото тренажёра в списке берётся только у своего тренажёра', async () => {
  const withPhoto = await createMachineWithPhoto('Жим ногами 45°', {})
  const withoutPhoto = await createMachineWithPhoto('Гакк-машина', null)

  const first = await createExercise(actor, { ...baseInput, name: 'Жим ногами', machineId: withPhoto })
  const second = await createExercise(actor, {
    ...baseInput,
    name: 'Гакк-приседания',
    machineId: withoutPhoto,
  })
  await publishExercise(actor, first.id)
  await expect(publishExercise(actor, second.id)).rejects.toThrow(
    'Добавь видео или фото тренажёра',
  )

  const [item] = await listExercises({ status: 'published' })
  expect(item?.name).toBe('Жим ногами')
  expect(item?.thumbUrl).toContain('machine/thumb.webp')
})

test('опубликованное без видео уходит в черновики, если тренажёр заменить на тренажёр без фото', async () => {
  const machineId = await createMachineWithPhoto('Брусья с упором на локтях', {})
  const bare = await createMachineWithPhoto('Силовая рама', null)

  const exercise = await createExercise(actor, { ...baseInput, machineId })
  await publishExercise(actor, exercise.id)
  expect((await getExercise(exercise.slug))?.status).toBe('published')

  const updated = await updateExercise(actor, exercise.id, { ...baseInput, machineId: bare })
  expect(updated.status).toBe('draft')
  expect(await getExercise(exercise.slug)).toBeNull()
})

test('видео важнее фото: с готовым видео публикуется и тренажёр без фото', async () => {
  const machineId = await createMachineWithPhoto('Тренажёр для голени', null)
  const exercise = await createExercise(actor, { ...baseInput, machineId, videoMediaId: readyVideoId })

  expect((await publishExercise(actor, exercise.id)).status).toBe('published')
})





test('публикация без основной мышцы → понятная ошибка', async () => {
  const exercise = await createExercise(actor, {
    ...baseInput,
    primaryMuscles: [],
    videoMediaId: readyVideoId,
  })
  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Отметь хотя бы одну основную мышцу',
  )
})

test('публикация без шагов → понятная ошибка', async () => {
  const exercise = await createExercise(actor, {
    ...baseInput,
    steps: [],
    videoMediaId: readyVideoId,
  })
  await expect(publishExercise(actor, exercise.id)).rejects.toThrow(
    'Добавь хотя бы один шаг «Как делать»',
  )
})

test('видео в обработке → «Видео ещё обрабатывается»', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: processingVideoId })
  await expect(publishExercise(actor, exercise.id)).rejects.toThrow('Видео ещё обрабатывается')
})

test('публикация с готовым видео проходит', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })
  const published = await publishExercise(actor, exercise.id)
  expect(published.status).toBe('published')
})

test('мышца одновременно основная и помогающая → ошибка валидации', async () => {
  await expect(
    createExercise(actor, { ...baseInput, primaryMuscles: ['lats'], secondaryMuscles: ['lats'] }),
  ).rejects.toThrow(/одновременно/)
})

test('клиент не может создать упражнение', async () => {
  await expect(createExercise(client, baseInput)).rejects.toBeInstanceOf(ForbiddenError)
})

test('дубликат названия получает суффикс слага', async () => {
  const first = await createExercise(actor, baseInput)
  const second = await createExercise(actor, baseInput)
  expect(first.slug).toBe('tyaga-verkhnego-bloka-k-grudi')
  expect(second.slug).toBe('tyaga-verkhnego-bloka-k-grudi-2')
})

test('фильтр по мышце находит основные и помогающие, основные — первыми', async () => {
  const primary = await createExercise(actor, {
    ...baseInput,
    name: 'Подтягивания',
    primaryMuscles: ['lats'],
    secondaryMuscles: [],
    videoMediaId: readyVideoId,
  })
  const secondary = await createExercise(actor, {
    ...baseInput,
    name: 'Тяга штанги в наклоне',
    primaryMuscles: ['traps-middle'],
    secondaryMuscles: ['lats'],
    videoMediaId: readyVideoId,
  })

  await publishExercise(actor, primary.id)
  await publishExercise(actor, secondary.id)

  const list = await listExercises({ muscle: 'lats' })
  expect(list.map((item) => item.name)).toEqual(['Подтягивания', 'Тяга штанги в наклоне'])
})

test('черновики не видны в опубликованном каталоге', async () => {
  const draft = await createExercise(actor, { ...baseInput, name: 'Черновик' })
  const published = await createExercise(actor, {
    ...baseInput,
    name: 'Опубликованное',
    videoMediaId: readyVideoId,
  })
  await publishExercise(actor, published.id)

  const list = await listExercises({ status: 'published' })
  expect(list.map((item) => item.name)).toEqual(['Опубликованное'])
  expect(list.map((item) => item.id)).not.toContain(draft.id)
})

test('поиск без учёта регистра и «ё/е»', async () => {
  const exercise = await createExercise(actor, {
    ...baseInput,
    name: 'Подъём штанги на бицепс',
    videoMediaId: readyVideoId,
  })
  await publishExercise(actor, exercise.id)

  expect((await listExercises({ query: 'ПОДЪЕМ' })).map((item) => item.name)).toEqual([
    'Подъём штанги на бицепс',
  ])
  expect((await listExercises({ query: 'подъём' })).length).toBe(1)
  expect((await listExercises({ query: 'присед' })).length).toBe(0)
})

test('getExercise отдаёт подписанные ссылки и скрывает черновики', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })

  expect(await getExercise(exercise.slug)).toBeNull()

  await publishExercise(actor, exercise.id)

  const detail = await getExercise(exercise.slug)
  expect(detail?.videoMp4Url).toMatch(/^\/media\/2026\/11\/ready\/video\.mp4\?exp=\d+&sig=[0-9a-f]+$/)
  expect(detail?.posterUrl).toContain('poster.webp')
  expect(detail?.hasMuscles).toBe(false)
})

test('упражнение с готовым видео и профилем ставит подсветку в очередь', async () => {
  vi.mocked(enqueueJob).mockClear()

  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })

  expect(enqueueJob).toHaveBeenCalledWith('media.muscles', {
    mediaId: readyVideoId,
    profile: 'pull_vertical',
  })

  // профиль не менялся и подсветка уже есть — повторно не ставим
  await db
    .update(media)
    .set({
      processedPaths: {
        mp4: '2026/11/ready/video.mp4',
        musclesMp4: '2026/11/ready/muscles.mp4',
        musclesProfile: 'pull_vertical',
      },
    })
    .where(eq(media.id, readyVideoId))
  vi.mocked(enqueueJob).mockClear()
  await updateExercise(actor, exercise.id, { ...baseInput, videoMediaId: readyVideoId })
  expect(enqueueJob).not.toHaveBeenCalled()

  // смена профиля — пересчитываем
  await updateExercise(actor, exercise.id, {
    ...baseInput,
    videoMediaId: readyVideoId,
    overlayProfile: 'pull_horizontal',
  })
  expect(enqueueJob).toHaveBeenCalledWith('media.muscles', {
    mediaId: readyVideoId,
    profile: 'pull_horizontal',
  })
})

test('без профиля или с необработанным видео подсветку не ставим', async () => {
  vi.mocked(enqueueJob).mockClear()

  await createExercise(actor, { ...baseInput, name: 'Без профиля', videoMediaId: readyVideoId, overlayProfile: 'none' })
  await createExercise(actor, { ...baseInput, name: 'Ещё в обработке', videoMediaId: processingVideoId })

  expect(enqueueJob).not.toHaveBeenCalled()
})

test('при профиле «none» клиент не видит старую подсветку', async () => {
  await db
    .update(media)
    .set({
      processedPaths: {
        mp4: '2026/11/ready/video.mp4',
        musclesMp4: '2026/11/ready/muscles.mp4',
        musclesProfile: 'pull_vertical',
      },
    })
    .where(eq(media.id, readyVideoId))

  const exercise = await createExercise(actor, {
    ...baseInput,
    videoMediaId: readyVideoId,
    overlayProfile: 'none',
  })
  await publishExercise(actor, exercise.id)

  const detail = await getExercise(exercise.id)
  expect(detail?.hasMuscles).toBe(false)
  expect(detail?.musclesMp4Url).toBeNull()
})

test('к упражнению нельзя привязать фото вместо видео', async () => {
  const [photo] = await db
    .insert(media)
    .values({
      kind: 'progress_photo',
      ownerId: actor.id,
      status: 'ready',
      sizeBytes: 1000,
      mime: 'image/jpeg',
      totalChunks: 1,
    })
    .returning()

  await expect(createExercise(actor, { ...baseInput, videoMediaId: photo!.id })).rejects.toThrow(
    'Видео не найдено',
  )

  const exercise = await createExercise(actor, baseInput)
  await expect(
    updateExercise(actor, exercise.id, { ...baseInput, videoMediaId: photo!.id }),
  ).rejects.toThrow('Видео не найдено')
})

test('опубликованное упражнение после правки без шагов возвращается в черновики', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })
  await publishExercise(actor, exercise.id)

  const updated = await updateExercise(actor, exercise.id, {
    ...baseInput,
    videoMediaId: readyVideoId,
    steps: [],
  })
  expect(updated.status).toBe('draft')

  const detail = await getExercise(exercise.id)
  expect(detail).toBeNull() // клиентам не показывается
})

test('смена видео опубликованного на ещё не обработанное возвращает в черновики', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })
  await publishExercise(actor, exercise.id)

  const updated = await updateExercise(actor, exercise.id, {
    ...baseInput,
    videoMediaId: processingVideoId,
  })
  expect(updated.status).toBe('draft')
})

test('безобидная правка опубликованного статус не меняет', async () => {
  const exercise = await createExercise(actor, { ...baseInput, videoMediaId: readyVideoId })
  await publishExercise(actor, exercise.id)

  const updated = await updateExercise(actor, exercise.id, {
    ...baseInput,
    videoMediaId: readyVideoId,
    tips: 'Спина прямая',
  })
  expect(updated.status).toBe('published')
})

test('черновик правится без проверок публикации', async () => {
  const exercise = await createExercise(actor, baseInput)
  const updated = await updateExercise(actor, exercise.id, { ...baseInput, steps: [] })
  expect(updated.status).toBe('draft')
})
