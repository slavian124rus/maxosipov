import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { assertCan, type Actor } from './check'
import { ForbiddenError } from './errors'
import { PERMISSIONS, type RolePermission } from './permissions'
import { roleAudit, roles, type Role } from './schema'

const rolePermissionSchema = z.object({
  code: z.enum(PERMISSIONS),
  scope: z.enum(['own', 'all']),
})

const roleInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  permissions: z.array(rolePermissionSchema),
})

export type RoleInput = z.infer<typeof roleInputSchema>

async function writeAudit(
  actorId: string,
  action: string,
  target: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await db.insert(roleAudit).values({ actorId, action, target, before, after })
}

async function findRole(roleId: string): Promise<Role> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1)
  if (!role) throw new Error('Роль не найдена')
  return role
}

/** Собирает актора из пользователя и его роли. */
export async function loadActor(userId: string): Promise<Actor> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) throw new Error('Пользователь не найден')

  return {
    id: row.user.id,
    roleId: row.role.id,
    gymId: row.user.gymId,
    isOwner: row.role.isSystem,
    permissions: row.role.permissions,
  }
}

export async function createRole(
  actor: Actor,
  input: { name: string; permissions: RolePermission[] },
): Promise<Role> {
  assertCan(actor, 'roles.manage')
  const data = roleInputSchema.parse(input)

  const [role] = await db
    .insert(roles)
    .values({ name: data.name, permissions: data.permissions, isSystem: false })
    .returning()

  if (!role) throw new Error('Роль не создана')

  await writeAudit(actor.id, 'role.create', role.id, null, role)
  return role
}

export async function updateRole(
  actor: Actor,
  roleId: string,
  input: { name?: string; permissions?: RolePermission[] },
): Promise<Role> {
  assertCan(actor, 'roles.manage')

  const existing = await findRole(roleId)
  if (existing.isSystem) {
    throw new ForbiddenError('Роль «Владелец» нельзя изменить')
  }

  const data = roleInputSchema.partial().parse(input)
  const [updated] = await db
    .update(roles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(roles.id, roleId))
    .returning()

  if (!updated) throw new Error('Роль не изменена')

  await writeAudit(actor.id, 'role.update', roleId, existing, updated)
  return updated
}

export async function deleteRole(actor: Actor, roleId: string): Promise<void> {
  assertCan(actor, 'roles.manage')

  const existing = await findRole(roleId)
  if (existing.isSystem) {
    throw new ForbiddenError('Роль «Владелец» нельзя удалить')
  }

  await db.delete(roles).where(eq(roles.id, roleId))
  await writeAudit(actor.id, 'role.delete', roleId, existing, null)
}

/** Назначает роль пользователю. Последнего владельца снять нельзя. */
export async function assignRole(actor: Actor, userId: string, roleId: string): Promise<void> {
  assertCan(actor, 'users.assign_roles')

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!target) throw new Error('Пользователь не найден')

  const nextRole = await findRole(roleId)
  const currentRole = await findRole(target.roleId)

  if (currentRole.isSystem && !nextRole.isSystem) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(roles.isSystem, true), isNull(users.deletedAt)))

    if ((row?.count ?? 0) <= 1) {
      throw new ForbiddenError('Нельзя снять последнего владельца')
    }
  }

  await db.update(users).set({ roleId, updatedAt: new Date() }).where(eq(users.id, userId))
  await writeAudit(actor.id, 'role.assign', userId, { roleId: target.roleId }, { roleId })
}
