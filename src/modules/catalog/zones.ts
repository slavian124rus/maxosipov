import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { getGym } from '@/modules/gym'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { machineZones, machines, type MachineZone } from './schema'

/** Зона со счётчиком тренажёров — для настроек. */
export type MachineZoneItem = MachineZone & { machineCount: number }

/**
 * Дорегистрирует в справочнике зоны, которые уже стоят у тренажёров.
 *
 * Справочник производный от данных: зону могли вписать в карточку тренажёра до
 * появления таблицы `machine_zones` (или миграцию применили без `db:seed`), и тогда
 * настройки зон показывали пустой список, хотя в дереве зоны есть. Один
 * `INSERT … ON CONFLICT DO NOTHING` — дёшево и повторять можно сколько угодно.
 */
export async function syncMachineZones(): Promise<void> {
  await db.execute(sql`
    insert into ${machineZones} ("gym_id", "name")
    select distinct m."gym_id", btrim(m."zone")
    from ${machines} m
    where m."zone" is not null and btrim(m."zone") <> ''
    on conflict ("gym_id", "name") do nothing
  `)
}

/**
 * Зоны зала по порядку, затем по алфавиту. Перед чтением подтягиваем зоны из
 * тренажёров, чтобы список в настройках совпадал с деревом (см. `syncMachineZones`).
 */
export async function listZones(): Promise<MachineZoneItem[]> {
  await syncMachineZones()

  const rows = await db
    .select({
      zone: machineZones,
      machineCount: sql<number>`count(${machines.id})::int`,
    })
    .from(machineZones)
    .leftJoin(machines, and(eq(machines.zone, machineZones.name), isNull(machines.archivedAt)))
    .groupBy(machineZones.id)
    .orderBy(asc(machineZones.sortOrder), asc(machineZones.name))

  return rows.map((row) => ({ ...row.zone, machineCount: row.machineCount }))
}

/** Имена зон без счётчиков — для подсказок в форме тренажёра. */
export async function listZoneNames(): Promise<string[]> {
  return (await listZones()).map((zone) => zone.name)
}

/**
 * Добавляет зону в справочник. Повторное имя не ошибка — возвращаем существующую,
 * чтобы форма тренажёра могла свободно писать зону текстом.
 */
export async function ensureZone(name: string): Promise<MachineZone | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const gym = await getGym()
  const [existing] = await db
    .select()
    .from(machineZones)
    .where(and(eq(machineZones.gymId, gym.id), eq(machineZones.name, trimmed)))
    .limit(1)
  if (existing) return existing

  const [created] = await db
    .insert(machineZones)
    .values({ gymId: gym.id, name: trimmed })
    .onConflictDoNothing({ target: [machineZones.gymId, machineZones.name] })
    .returning()

  return created ?? null
}

/** Новая зона из настроек. */
export async function createZone(actor: Actor, name: string): Promise<MachineZone> {
  assertCan(actor, 'catalog.edit')
  const trimmed = name.trim()

  if (trimmed.length < 2) throw new Error('Название зоны слишком короткое')
  if (trimmed.length > 60) throw new Error('Название зоны — до 60 символов')

  const gym = await getGym()
  const [existing] = await db
    .select({ id: machineZones.id })
    .from(machineZones)
    .where(and(eq(machineZones.gymId, gym.id), eq(machineZones.name, trimmed)))
    .limit(1)
  if (existing) throw new Error(`Зона «${trimmed}» уже есть`)

  const [created] = await db
    .insert(machineZones)
    .values({ gymId: gym.id, name: trimmed })
    .returning()

  if (!created) throw new Error('Зона не создана')
  return created
}

/**
 * Переименование зоны: обновляем и справочник, и `machines.zone` у тренажёров —
 * иначе дерево в кабинете показывало бы старую зону.
 */
export async function renameZone(actor: Actor, id: string, name: string): Promise<MachineZone> {
  assertCan(actor, 'catalog.edit')
  const trimmed = name.trim()

  if (trimmed.length < 2) throw new Error('Название зоны слишком короткое')
  if (trimmed.length > 60) throw new Error('Название зоны — до 60 символов')

  const [zone] = await db.select().from(machineZones).where(eq(machineZones.id, id)).limit(1)
  if (!zone) throw new Error('Зона не найдена')
  if (zone.name === trimmed) return zone

  const [taken] = await db
    .select({ id: machineZones.id })
    .from(machineZones)
    .where(and(eq(machineZones.gymId, zone.gymId), eq(machineZones.name, trimmed)))
    .limit(1)
  if (taken) throw new Error(`Зона «${trimmed}» уже есть`)

  return db.transaction(async (tx) => {
    const now = new Date()

    await tx
      .update(machines)
      .set({ zone: trimmed, updatedAt: now })
      .where(and(eq(machines.gymId, zone.gymId), eq(machines.zone, zone.name)))

    const [updated] = await tx
      .update(machineZones)
      .set({ name: trimmed, updatedAt: now })
      .where(eq(machineZones.id, id))
      .returning()

    if (!updated) throw new Error('Зона не найдена')
    return updated
  })
}

/**
 * Удаляет зону. Если к ней привязаны тренажёры — отказ: иначе они молча
 * оказались бы «без зоны». Сначала их переносят в другую зону.
 */
export async function deleteZone(actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'catalog.edit')

  const [zone] = await db.select().from(machineZones).where(eq(machineZones.id, id)).limit(1)
  if (!zone) throw new Error('Зона не найдена')

  const [used] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(machines)
    .where(and(eq(machines.gymId, zone.gymId), eq(machines.zone, zone.name), isNull(machines.archivedAt)))

  const count = used?.count ?? 0
  if (count > 0) {
    throw new Error(
      `В зоне «${zone.name}» есть тренажёры: ${count}. Сначала перенеси их в другую зону`,
    )
  }

  await db.delete(machineZones).where(eq(machineZones.id, id))
}
