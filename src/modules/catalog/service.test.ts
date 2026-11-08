import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { enqueueJob } from '@/shared/queue'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { media } from '@/modules/media'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { createExercise, getExercise, listExercises, publishExercise, updateExercise } from './service'
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

test('публикация без видео → «Добавь видео»', async () => {
  const exercise = await createExercise(actor, baseInput)
  await expect(publishExercise(actor, exercise.id)).rejects.toThrow('Добавь видео')
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
