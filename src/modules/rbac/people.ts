import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { assertCan, type Actor } from './check'
import { roleAudit, roles, type Role } from './schema'

/** Роли зала: системная «Владелец» сверху, дальше по названию. */
export async function listRoles(): Promise<Role[]> {
  const rows = await db.select().from(roles).orderBy(desc(roles.isSystem), roles.name)
  return rows
}

export type PersonItem = {
  id: string
  name: string
  phone: string
  roleId: string
  roleName: string
  trainerId: string | null
}

/** Люди зала для экрана «Люди»: роль и тренер клиента. */
export async function listPeople(actor: Actor, query = ''): Promise<PersonItem[]> {
  assertCan(actor, 'users.assign_roles')

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      roleId: users.roleId,
      roleName: roles.name,
      trainerId: users.trainerId,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.gymId, actor.gymId), isNull(users.deletedAt)))
    .orderBy(roles.name, users.name)

  const text = query.trim().toLowerCase()
  const digits = query.replace(/\D/g, '')

  return rows.filter(
    (row) =>
      !text ||
      row.name.toLowerCase().includes(text) ||
      (digits.length > 0 && row.phone.includes(digits)),
  )
}

/** Привязывает клиента к тренеру (`users.trainer_id`). */
export async function setClientTrainer(
  actor: Actor,
  clientId: string,
  trainerId: string | null,
): Promise<void> {
  assertCan(actor, 'users.assign_roles')

  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
  if (!client) throw new Error('Пользователь не найден')

  await db
    .update(users)
    .set({ trainerId, updatedAt: new Date() })
    .where(eq(users.id, clientId))

  await db.insert(roleAudit).values({
    actorId: actor.id,
    action: 'trainer.assign',
    target: clientId,
    before: { trainerId: client.trainerId },
    after: { trainerId },
  })
}

export type AuditItem = {
  id: string
  actorName: string
  action: string
  targetName: string | null
  createdAt: Date
}

/** Журнал изменений прав и ролей (новые сверху). */
export async function listAudit(actor: Actor, limit = 50): Promise<AuditItem[]> {
  assertCan(actor, 'roles.manage')

  const rows = await db.select().from(roleAudit).orderBy(desc(roleAudit.createdAt)).limit(limit)

  const ids = [...new Set(rows.flatMap((row) => [row.actorId, row.target]))].filter(
    (id): id is string => typeof id === 'string',
  )
  const people =
    ids.length === 0
      ? []
      : await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, ids))

  const nameById = new Map(people.map((person) => [person.id, person.name || 'Без имени']))

  return rows.map((row) => ({
    id: row.id,
    actorName: nameById.get(row.actorId) ?? 'Система',
    action: row.action,
    targetName: row.target ? (nameById.get(row.target) ?? null) : null,
    createdAt: row.createdAt,
  }))
}