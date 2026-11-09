import { and, desc, eq } from 'drizzle-orm'
import { assertClientAccess } from '@/modules/access'
import { getGym } from '@/modules/gym'
import { assertCan, ForbiddenError, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { dayKey } from '@/shared/dates'
import { users } from '@/shared/db/schema'
import { bodyMeasurements, type BodyMeasurement } from './schema'
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

/** Удаление замера — те же права, что у добавления. */
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