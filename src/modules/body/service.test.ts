import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { addDays, subscriptions } from '@/modules/access'
import { gyms } from '@/modules/gym'
import { media, mediaDir, mediaRoot, safeJoin } from '@/modules/media'
import { ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { bodyMeasurements } from './schema'
import {
  addMeasurement,
  addProgressPhoto,
  deleteMeasurement,
  deleteProgressPhoto,
  listMeasurements,
  listProgressPhotos,
} from './service'
import { dayKey } from '@/shared/dates'

let gymId: string
let client: Actor
let trainer: Actor
let trainerNoRights: Actor
let clientId: string
let otherClientId: string
let today: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()

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
  today = dayKey(new Date(), 'Asia/Krasnoyarsk')

  const [trainerRow] = await db
    .insert(users)
    .values({ phone: '+79990000002', name: 'Максим', gymId, roleId: roles['Главный тренер']!.id })
    .returning()

  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Клиент',
      gymId,
      roleId: roles['Клиент']!.id,
      trainerId: trainerRow!.id,
    })
    .returning()
  const [otherRow] = await db
    .insert(users)
    .values({ phone: '+79990000012', name: 'Другой', gymId, roleId: roles['Клиент']!.id })
    .returning()

  clientId = clientRow!.id
  otherClientId = otherRow!.id

  client = { id: clientId, roleId: roles['Клиент']!.id, gymId, isOwner: false, permissions: [] }
  trainer = {
    id: trainerRow!.id,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [{ code: 'clients.measurements', scope: 'own' }],
  }
  trainerNoRights = {
    id: trainerRow!.id,
    roleId: roles['Главный тренер']!.id,
    gymId,
    isOwner: false,
    permissions: [],
  }

  // Активная подписка клиента: без неё запись замеров запрещена.
  await db.insert(subscriptions).values({
    userId: clientId,
    status: 'active',
    startsAt: addDays(new Date(), -5),
    endsAt: addDays(new Date(), 25),
  })
})

test('пустой замер → «Заполни хотя бы одно поле»', async () => {
  await expect(addMeasurement(client, clientId, { date: today })).rejects.toThrow(
    'Заполни хотя бы одно поле',
  )
})

test('вес 20 кг → ошибка границ', async () => {
  await expect(addMeasurement(client, clientId, { date: today, weightKg: 20 })).rejects.toThrow(
    /Вес должен быть от 30 до 300/,
  )
})

test('вторая запись на ту же дату объединяется с первой', async () => {
  await addMeasurement(client, clientId, { date: today, weightKg: 80 })
  const merged = await addMeasurement(client, clientId, { date: today, waistCm: 90 })

  expect(merged.weightKg).toBe(80)
  expect(merged.waistCm).toBe(90)

  const rows = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, clientId))
  expect(rows).toHaveLength(1)
})

test('клиент без подписки пишет → отказ, читает → ок', async () => {
  await addMeasurement(client, clientId, { date: today, weightKg: 80 })
  await db.delete(subscriptions).where(eq(subscriptions.userId, clientId))

  await expect(addMeasurement(client, clientId, { date: today, weightKg: 79 })).rejects.toThrow()

  const rows = await listMeasurements(client, clientId)
  expect(rows).toHaveLength(1)
})

test('клиент пишет чужому clientId → ForbiddenError', async () => {
  await expect(
    addMeasurement(client, otherClientId, { date: today, weightKg: 80 }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('тренер с clients.measurements (own) пишет своему клиенту, entered_by = тренер', async () => {
  const row = await addMeasurement(trainer, clientId, { date: today, weightKg: 81.5 })

  expect(row.enteredBy).toBe(trainer.id)
  expect(row.weightKg).toBe(81.5)
})

test('тренер без права → ForbiddenError', async () => {
  await expect(
    addMeasurement(trainerNoRights, clientId, { date: today, weightKg: 80 }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('listMeasurements чужого клиента без clients.view → ForbiddenError', async () => {
  await expect(listMeasurements(trainerNoRights, clientId)).rejects.toBeInstanceOf(ForbiddenError)
})

test('дата в будущем → ошибка', async () => {
  const tomorrow = dayKey(addDays(new Date(), 1), 'Asia/Krasnoyarsk')
  await expect(addMeasurement(client, clientId, { date: tomorrow, weightKg: 80 })).rejects.toThrow(
    'Дата не может быть в будущем',
  )
})

test('удаление замера убирает запись', async () => {
  const row = await addMeasurement(client, clientId, { date: today, weightKg: 80 })
  await deleteMeasurement(client, clientId, row.id)

  expect(await listMeasurements(client, clientId)).toHaveLength(0)
})

async function makePhoto(ownerId: string, kind: 'progress_photo' | 'exercise_video' = 'progress_photo') {
  const [row] = await db
    .insert(media)
    .values({
      kind,
      ownerId,
      status: 'ready',
      sizeBytes: 1000,
      mime: 'image/jpeg',
      totalChunks: 1,
      processedPaths: { photo: '2026/11/photo/photo.webp', thumb: '2026/11/photo/thumb.webp' },
    })
    .returning()
  return row!
}

test('фото прогресса: своё медиа добавляется, ссылки подписаны на 10 минут', async () => {
  const file = await makePhoto(clientId)
  const photo = await addProgressPhoto(client, clientId, {
    date: today,
    pose: 'front',
    mediaId: file.id,
  })

  const list = await listProgressPhotos(client, clientId)
  expect(list).toHaveLength(1)
  expect(list[0]?.id).toBe(photo.id)
  expect(list[0]?.status).toBe('ready')

  const url = list[0]?.photoUrl ?? ''
  const exp = Number(new URL(url, 'https://app.maxosipov.ru').searchParams.get('exp'))
  expect(Math.abs(exp - (Math.floor(Date.now() / 1000) + 600))).toBeLessThanOrEqual(5)
})

test('фото прогресса: чужое или не то медиа → ошибка', async () => {
  const foreign = await makePhoto(otherClientId)
  await expect(
    addProgressPhoto(client, clientId, { date: today, pose: 'front', mediaId: foreign.id }),
  ).rejects.toThrow('Файл загружен другим пользователем')

  const video = await makePhoto(clientId, 'exercise_video')
  await expect(
    addProgressPhoto(client, clientId, { date: today, pose: 'front', mediaId: video.id }),
  ).rejects.toThrow('Это не фото прогресса')
})

test('фото прогресса: клиент видит только свои, чужой clientId → ForbiddenError', async () => {
  const file = await makePhoto(clientId)
  await addProgressPhoto(client, clientId, { date: today, pose: 'front', mediaId: file.id })

  expect(await listProgressPhotos(client, clientId)).toHaveLength(1)
  await expect(listProgressPhotos(client, otherClientId)).rejects.toBeInstanceOf(ForbiddenError)
})

test('фото прогресса: тренер без clients.view_photos не получает ссылок', async () => {
  const file = await makePhoto(clientId)
  await addProgressPhoto(client, clientId, { date: today, pose: 'front', mediaId: file.id })

  await expect(listProgressPhotos(trainerNoRights, clientId)).rejects.toBeInstanceOf(ForbiddenError)
})

test('фото прогресса: тренер с правом (own) видит фото своего клиента', async () => {
  const file = await makePhoto(clientId)
  await addProgressPhoto(client, clientId, { date: today, pose: 'front', mediaId: file.id })

  const viewer: Actor = {
    ...trainer,
    permissions: [{ code: 'clients.view_photos', scope: 'own' }],
  }

  const list = await listProgressPhotos(viewer, clientId)
  expect(list).toHaveLength(1)
  expect(list[0]?.thumbUrl).toContain('thumb.webp')
})

test('удаление фото убирает запись, медиа и файлы', async () => {
  const file = await makePhoto(clientId)
  const photo = await addProgressPhoto(client, clientId, {
    date: today,
    pose: 'front',
    mediaId: file.id,
  })

  const dir = safeJoin(mediaRoot(), mediaDir(file))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'photo.webp'), 'x')

  await deleteProgressPhoto(client, clientId, photo.id)

  expect(await listProgressPhotos(client, clientId)).toHaveLength(0)
  const [mediaRow] = await db.select().from(media).where(eq(media.id, file.id))
  expect(mediaRow).toBeUndefined()
  expect(existsSync(dir)).toBe(false)
})