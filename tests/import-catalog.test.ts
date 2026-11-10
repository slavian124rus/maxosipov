import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { sql } from 'drizzle-orm'
import { KOLIZEY_EXERCISES, KOLIZEY_MACHINES } from '../content/catalog/kolizey'
import { exercises, getExercise, listExercises, machines } from '@/modules/catalog'
import { media } from '@/modules/media'
import { db } from '@/shared/db'
import { gyms, users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from './db'
import { importCatalog, validateContent } from '../scripts/import-catalog'

let gymId: string

/** Ожидаемо публикуется при `--publish`: ни тренажёр, ни упражнение не помечены. */
const reviewFreeMachines = new Set(
  KOLIZEY_MACHINES.filter((machine) => !machine.needsReview).map((machine) => machine.slug),
)
const publishable = KOLIZEY_EXERCISES.filter(
  (exercise) => !exercise.needsReview && reviewFreeMachines.has(exercise.machine),
).map((exercise) => exercise.name)

async function count(table: typeof machines | typeof exercises | typeof media): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(table)
  return row?.value ?? 0
}

beforeAll(async () => {
  await prepareTestDb()
  // Медиа пишем во временный каталог: `mediaRoot()` читает `process.env.MEDIA_ROOT` на каждый вызов.
  process.env.MEDIA_ROOT = await mkdtemp(path.join(tmpdir(), 'catalog-import-'))
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  // `users.role_id` — внешний ключ на `roles`, поэтому роли сидим первыми.
  const roles = await seedDefaultRoles()
  const ownerRoleId = roles['Владелец']!.id

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

  gymId = gym!.id

  await db.insert(users).values({
    phone: '+79990000002',
    name: 'Максим',
    gymId,
    roleId: ownerRoleId,
  })
})

test('контент каталога проходит самопроверку', () => {
  expect(validateContent()).toEqual([])
})

test('validateContent ловит дубли и упражнения без тренажёра', () => {
  const problems = validateContent(
    [
      { slug: 'a', name: 'Один', zone: 'Ноги', weightStepKg: 5, photo: null },
      { slug: 'a', name: 'Один', zone: 'Ноги', weightStepKg: 5, photo: null },
    ],
    [
      {
        slug: 'e1',
        name: 'Без тренажёра',
        machine: 'net-takogo',
        primary: ['quads'],
        secondary: [],
        steps: ['один', 'два'],
        mistakes: ['одна'],
        tips: null,
        defaultRepMin: 10,
        defaultRepMax: 12,
        overlayProfile: 'none',
      },
    ],
  ).join('\n')

  expect(problems).toContain('дублируется slug тренажёра: a')
  expect(problems).toContain('дублируется имя тренажёра: Один')
  expect(problems).toContain('нет тренажёра с slug net-takogo')
  expect(problems).toContain('шагов должно быть 3–5, сейчас 2')
  expect(problems).toContain('ошибок должно быть 2–3, сейчас 1')
})

test('импорт создаёт тренажёры и упражнения зала', async () => {
  const summary = await importCatalog({})

  expect(summary.machinesCreated).toBe(KOLIZEY_MACHINES.length)
  expect(summary.exercisesCreated).toBe(KOLIZEY_EXERCISES.length)
  expect(await count(machines)).toBe(KOLIZEY_MACHINES.length)
  expect(await count(exercises)).toBe(KOLIZEY_EXERCISES.length)

  const [created] = await db.select().from(machines).limit(1)
  expect(created?.gymId).toBe(gymId)
})

test('повторный импорт не плодит дубли', async () => {
  const first = await importCatalog({})
  const machinesAfterFirst = await count(machines)
  const exercisesAfterFirst = await count(exercises)
  const mediaAfterFirst = await count(media)

  const second = await importCatalog({})

  expect(second.machinesCreated).toBe(0)
  expect(second.machinesUpdated).toBe(KOLIZEY_MACHINES.length)
  expect(second.exercisesCreated).toBe(0)
  expect(second.exercisesUpdated).toBe(KOLIZEY_EXERCISES.length)
  // Фото переиспользуется, а не копируется заново.
  expect(second.photosImported).toBe(0)
  expect(second.photosReused).toBe(first.photosImported)

  expect(await count(machines)).toBe(machinesAfterFirst)
  expect(await count(exercises)).toBe(exercisesAfterFirst)
  expect(await count(media)).toBe(mediaAfterFirst)
})

test('каждое фото тренажёра — одна строка machine_photo в статусе ready', async () => {
  await importCatalog({})

  const photos = await db.select().from(media)
  expect(photos.length).toBe(KOLIZEY_MACHINES.filter((machine) => machine.photo).length)

  for (const photo of photos) {
    expect(photo.kind).toBe('machine_photo')
    expect(photo.status).toBe('ready')
    expect(photo.processedPaths?.photo).toMatch(/\/photo\.webp$/)
    expect(photo.processedPaths?.thumb).toMatch(/\/thumb\.webp$/)
  }

  const rows = await db.select().from(machines)
  for (const row of rows) {
    expect(row.photoMediaId).not.toBeNull()
  }
})

test('по умолчанию всё создаётся в статусе draft', async () => {
  await importCatalog({})

  const statuses = await db.select({ status: exercises.status }).from(exercises)
  expect(new Set(statuses.map((row) => row.status))).toEqual(new Set(['draft']))
})

test('--publish публикует только записи без needsReview', async () => {
  const summary = await importCatalog({ publish: true })

  const published = await db
    .select({ name: exercises.name })
    .from(exercises)
    .where(sql`${exercises.status} = 'published'`)

  expect(published.map((row) => row.name).sort()).toEqual([...publishable].sort())
  expect(summary.exercisesPublished).toBe(publishable.length)
  expect(summary.needsReview.length).toBe(KOLIZEY_EXERCISES.length - publishable.length)
  // Все публикуемые тренажёры имеют фото, поэтому «не хватило фото» быть не должно.
  expect(summary.notPublishable).toEqual([])
})

test('повторный импорт с --publish не меняет число опубликованных', async () => {
  await importCatalog({ publish: true })
  const exercisesAfterFirst = await count(exercises)
  const publishedAfterFirst = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(sql`${exercises.status} = 'published'`)

  const second = await importCatalog({ publish: true })

  // Уже опубликованы — повторно статус не переключаем.
  expect(second.exercisesPublished).toBe(0)
  expect(await count(exercises)).toBe(exercisesAfterFirst)

  const publishedAfterSecond = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(sql`${exercises.status} = 'published'`)
  expect(publishedAfterSecond.length).toBe(publishedAfterFirst.length)
})

test('импорт не трогает упражнение, у которого уже есть видео', async () => {
  const [owner] = await db.select({ id: users.id }).from(users).limit(1)
  const [video] = await db
    .insert(media)
    .values({
      kind: 'exercise_video',
      ownerId: owner!.id,
      status: 'ready',
      sizeBytes: 10,
      mime: 'video/mp4',
      totalChunks: 1,
      processedPaths: { mp4: '2026/11/v/video.mp4', poster: '2026/11/v/poster.webp' },
    })
    .returning()

  const target = KOLIZEY_EXERCISES[0]!
  await db.insert(exercises).values({
    gymId,
    name: 'Моё название, не из каталога',
    slug: target.slug,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    videoMediaId: video!.id,
    steps: ['Мой шаг'],
    mistakes: [],
    defaultRepMin: 5,
    defaultRepMax: 6,
    status: 'published',
  })

  const summary = await importCatalog({ publish: true })

  const [row] = await db
    .select()
    .from(exercises)
    .where(sql`${exercises.slug} = ${target.slug}`)
    .limit(1)

  expect(row?.name).toBe('Моё название, не из каталога')
  expect(row?.videoMediaId).toBe(video!.id)
  expect(row?.status).toBe('published')
  expect(row?.steps).toEqual(['Мой шаг'])
  expect(summary.exercisesSkippedWithVideo).toBe(1)
  // Остальные упражнения в базе ещё не было — они создаются, а не обновляются.
  expect(summary.exercisesCreated).toBe(KOLIZEY_EXERCISES.length - 1)
  expect(summary.exercisesUpdated).toBe(0)
})

test('после импорта каталог отдаёт подписанные фото тренажёра', async () => {
  await importCatalog({ publish: true })

  const target = KOLIZEY_EXERCISES.find(
    (exercise) => !exercise.needsReview && reviewFreeMachines.has(exercise.machine),
  )!

  const [item] = (await listExercises({ status: 'published' })).filter(
    (row) => row.slug === target.slug,
  )
  expect(item?.hasVideo).toBe(false)
  expect(item?.posterUrl).toBeNull()
  expect(item?.thumbUrl).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f-]+\/thumb\.webp\?exp=\d+&sig=[0-9a-f]+$/)

  const detail = await getExercise(target.slug)
  expect(detail?.status).toBe('published')
  expect(detail?.videoMp4Url).toBeNull()
  expect(detail?.photoUrl).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f-]+\/photo\.webp\?exp=\d+&sig=[0-9a-f]+$/)
  expect(detail?.thumbUrl).toContain('thumb.webp')
  expect(detail?.steps).toEqual(target.steps)
})
