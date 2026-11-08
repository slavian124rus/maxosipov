import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { db } from '@/shared/db'
import { gyms } from '@/modules/gym'
import { media } from '@/modules/media'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { closeDb, prepareTestDb, resetDb } from '../../../tests/db'
import { createExercise, getExercise, listExercises, publishExercise } from './service'
import type { ExerciseInput } from './validation'

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
