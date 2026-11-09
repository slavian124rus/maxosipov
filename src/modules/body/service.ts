import { rm } from 'node:fs/promises'
import { and, desc, eq } from 'drizzle-orm'
import { assertClientAccess } from '@/modules/access'
import { getGym } from '@/modules/gym'
import { mediaDir, mediaRoot, PHOTO_URL_TTL_SEC, safeJoin, signMediaPath } from '@/modules/media'
import { assertCan, ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { dayKey } from '@/shared/dates'
import { media as mediaTable, users } from '@/shared/db/schema'
import { bodyMeasurements, progressPhotos, type BodyMeasurement, type ProgressPhoto } from './schema'
import { measurementInputSchema, type MeasurementInput } from './validation'

/** Клиент пишет только при доступе; тренер — с правом `clients.measurements` на этого клиента. */
async function assertCanWrite(actor: Actor, clientId: string): Promise<void> {
  if (actor.id === clientId) {
    await assertClientAccess(clientId)
    return
  }

  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
  if (!client) throw new Error('Клиент не найден')

  assertCan(actor, 'clients.measurements', {
    clientId,
    clientTrainerId: client.trainerId,
  })
}

/** Чтение: сам клиент (доступ не нужен — история видна всегда) или `clients.view`. */
async function assertCanRead(actor: Actor, clientId: string): Promise<void> {
  if (actor.id === clientId) return

  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
  if (!client) throw new Error('Клиент не найден')

  assertCan(actor, 'clients.view', { clientId, clientTrainerId: client.trainerId })
}

function assertDateRange(dateText: string, timeZone: string): void {
  const today = dayKey(new Date(), timeZone)

  if (dateText > today) throw new Error('Дата не может быть в будущем')

  const oldest = dayKey(new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), timeZone)
  if (dateText < oldest) throw new Error('Дата слишком старая — вноси за последние 5 лет')
}

/**
 * Добавляет замер. Повтор на ту же дату объединяет поля:
 * пришедшие значения перезаписывают, непришедшие остаются.
 */
export async function addMeasurement(
  actor: Actor,
  clientId: string,
  input: MeasurementInput,
): Promise<BodyMeasurement> {
  await assertCanWrite(actor, clientId)

  const data = measurementInputSchema.parse(input)
  const gym = await getGym()
  assertDateRange(data.date, gym.timezone)

  const values = {
    weightKg: data.weightKg ?? null,
    chestCm: data.chestCm ?? null,
    waistCm: data.waistCm ?? null,
    hipsCm: data.hipsCm ?? null,
    bicepsCm: data.bicepsCm ?? null,
    thighCm: data.thighCm ?? null,
  }

  const [existing] = await db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, clientId), eq(bodyMeasurements.date, data.date)))
    .limit(1)

  // Объединение: пришедшие значения перезаписывают, непришедшие остаются.
  const merged = {
    weightKg: values.weightKg ?? existing?.weightKg ?? null,
    chestCm: values.chestCm ?? existing?.chestCm ?? null,
    waistCm: values.waistCm ?? existing?.waistCm ?? null,
    hipsCm: values.hipsCm ?? existing?.hipsCm ?? null,
    bicepsCm: values.bicepsCm ?? existing?.bicepsCm ?? null,
    thighCm: values.thighCm ?? existing?.thighCm ?? null,
  }

  const [row] = await db
    .insert(bodyMeasurements)
    .values({ userId: clientId, date: data.date, enteredBy: actor.id, ...merged })
    .onConflictDoUpdate({
      target: [bodyMeasurements.userId, bodyMeasurements.date],
      set: { ...merged, enteredBy: actor.id, updatedAt: new Date() },
    })
    .returning()

  if (!row) throw new Error('Замер не сохранён')
  return row
}

/** Замеры клиента: новые первыми. */
export async function listMeasurements(
  actor: Actor,
  clientId: string,
  options: { limit?: number } = {},
): Promise<BodyMeasurement[]> {
  await assertCanRead(actor, clientId)

  return db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, clientId))
    .orderBy(desc(bodyMeasurements.date))
    .limit(options.limit ?? 200)
}

/** Добавляет фото прогресса: только сам клиент с доступом. */
export async function addProgressPhoto(
  actor: Actor,
  clientId: string,
  input: { date: string; pose: 'front' | 'side' | 'back'; mediaId: string },
): Promise<ProgressPhoto> {
  if (actor.id !== clientId) throw new ForbiddenError('Фото прогресса добавляет сам клиент')
  await assertClientAccess(clientId)

  const [file] = await db.select().from(mediaTable).where(eq(mediaTable.id, input.mediaId)).limit(1)

  if (!file) throw new Error('Файл не найден')
  if (file.kind !== 'progress_photo') throw new Error('Это не фото прогресса')
  if (file.ownerId !== clientId) throw new Error('Файл загружен другим пользователем')

  const [attached] = await db
    .select({ id: progressPhotos.id })
    .from(progressPhotos)
    .where(eq(progressPhotos.mediaId, input.mediaId))
    .limit(1)

  if (attached) throw new Error('Это фото уже добавлено')

  // Файл должен быть догружен: иначе в списке повиснет «Обрабатывается…» без шанса на завершение.
  if (file.status === 'uploaded' && !file.originalPath) throw new Error('Фото ещё загружается')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) {
    throw new Error('Дата в формате ГГГГ-ММ-ДД')
  }
  assertDateRange(input.date, (await getGym()).timezone)
  if (!['front', 'side', 'back'].includes(input.pose)) throw new Error('Выбери позу')

  const [row] = await db
    .insert(progressPhotos)
    .values({ userId: clientId, date: input.date, pose: input.pose, mediaId: input.mediaId })
    .returning()

  if (!row) throw new Error('Фото не добавлено')
  return row
}

export type ProgressPhotoView = {
  id: string
  date: string
  pose: 'front' | 'side' | 'back'
  status: 'processing' | 'ready' | 'failed'
  photoUrl: string | null
  thumbUrl: string | null
}

/** Фото клиента со ссылками на 10 минут: сам клиент или право `clients.view_photos`. */
export async function listProgressPhotos(
  actor: Actor,
  clientId: string,
): Promise<ProgressPhotoView[]> {
  if (actor.id !== clientId) {
    const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
    if (!client) throw new Error('Клиент не найден')

    assertCan(actor, 'clients.view_photos', {
      clientId,
      clientTrainerId: client.trainerId,
    })
  }

  const rows = await db
    .select({ photo: progressPhotos, file: mediaTable })
    .from(progressPhotos)
    .leftJoin(mediaTable, eq(mediaTable.id, progressPhotos.mediaId))
    .where(eq(progressPhotos.userId, clientId))
    .orderBy(desc(progressPhotos.date))

  return rows.map(({ photo, file }) => {
    // `uploaded` (в очереди) и `processing` для клиента — одно и то же: «обрабатывается».
    const status: ProgressPhotoView['status'] =
      file?.status === 'ready' || file?.status === 'failed' ? file.status : 'processing'
    const paths = file?.processedPaths

    return {
      id: photo.id,
      date: photo.date,
      pose: photo.pose,
      status,
      photoUrl: status === 'ready' && paths?.photo ? signMediaPath(paths.photo, PHOTO_URL_TTL_SEC) : null,
      thumbUrl: status === 'ready' && paths?.thumb ? signMediaPath(paths.thumb, PHOTO_URL_TTL_SEC) : null,
    }
  })
}

/** Удаляет фото, запись медиа и каталог файлов. */
export async function deleteProgressPhoto(
  actor: Actor,
  clientId: string,
  id: string,
): Promise<void> {
  if (actor.id !== clientId) throw new ForbiddenError('Фото прогресса удаляет сам клиент')
  await assertClientAccess(clientId)

  const [photo] = await db
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, clientId)))
    .limit(1)

  if (!photo) throw new Error('Фото не найдено')

  const [file] = await db.select().from(mediaTable).where(eq(mediaTable.id, photo.mediaId)).limit(1)

  await db.delete(progressPhotos).where(eq(progressPhotos.id, id))

  if (file) {
    await db.delete(mediaTable).where(eq(mediaTable.id, file.id))

    try {
      await rm(safeJoin(mediaRoot(), mediaDir(file)), { recursive: true, force: true })
    } catch (error) {
      console.error('[body] не удалось удалить файлы фото', error)
    }
  }
}
export async function deleteMeasurement(actor: Actor, clientId: string, id: string): Promise<void> {
  await assertCanWrite(actor, clientId)

  const [row] = await db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, clientId)))
    .limit(1)

  if (!row) throw new Error('Замер не найден')

  await db.delete(bodyMeasurements).where(eq(bodyMeasurements.id, id))
}