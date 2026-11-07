import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { ZodError } from 'zod'
import { users } from '@/modules/auth'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import type { Actor } from './check'
import { DEFAULT_ROLES } from './defaults'
import { ForbiddenError } from './errors'
import type { RolePermission } from './permissions'
import { roleAudit, roles, type Role } from './schema'
import { assignRole, createRole, deleteRole, loadActor, updateRole } from './service'

const GYM_ID = '00000000-0000-4000-8000-000000000001'

let ownerRole: Role
let trainerRole: Role
let clientRole: Role
let owner: Actor
let trainer: Actor
let ownerUserId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const seeded = await seedDefaultRoles()
  ownerRole = seeded['Владелец']!
  trainerRole = seeded['Тренер']!
  clientRole = seeded['Клиент']!

  const [ownerRow] = await db
    .insert(users)
    .values({
      phone: '+79990000001',
      name: 'Владелец',
      gymId: GYM_ID,
      roleId: ownerRole.id,
    })
    .returning()
  const [trainerRow] = await db
    .insert(users)
    .values({
      phone: '+79990000002',
      name: 'Максим',
      gymId: GYM_ID,
      roleId: trainerRole.id,
    })
    .returning()
  await db.insert(users).values({
    phone: '+79990000011',
    name: 'Клиент',
    gymId: GYM_ID,
    roleId: clientRole.id,
    trainerId: trainerRow!.id,
  })

  ownerUserId = ownerRow!.id
  owner = await loadActor(ownerRow!.id)
  trainer = await loadActor(trainerRow!.id)
})

test('deleteRole для роли «Владелец» бросает ForbiddenError', async () => {
  await expect(deleteRole(owner, ownerRole.id)).rejects.toBeInstanceOf(ForbiddenError)
})

test('updateRole для «Владелец» бросает ForbiddenError', async () => {
  await expect(updateRole(owner, ownerRole.id, { name: 'Босс' })).rejects.toBeInstanceOf(
    ForbiddenError,
  )
  await expect(
    updateRole(owner, ownerRole.id, { permissions: [{ code: 'clients.view', scope: 'own' }] }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('снять роль «Владелец» с единственного владельца нельзя', async () => {
  await expect(assignRole(owner, ownerUserId, clientRole.id)).rejects.toThrow(
    'Нельзя снять последнего владельца',
  )
})

test('createRole без права roles.manage бросает ForbiddenError', async () => {
  await expect(
    createRole(trainer, { name: 'Методист', permissions: [{ code: 'clients.view', scope: 'all' }] }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

test('createRole владельцем создаёт роль и пишет в role_audit', async () => {
  const permissions: RolePermission[] = [{ code: 'clients.view', scope: 'all' }]
  const role = await createRole(owner, { name: 'Методист', permissions })

  expect(role.name).toBe('Методист')
  expect(role.permissions).toEqual(permissions)

  const audit = await db.select().from(roleAudit).where(eq(roleAudit.target, role.id))
  expect(audit).toHaveLength(1)
  expect(audit[0]?.action).toBe('role.create')
})

test('createRole с неизвестным кодом права — ошибка валидации Zod', async () => {
  await expect(
    createRole(owner, {
      name: 'Кривая роль',
      permissions: [{ code: 'nope.nope' as RolePermission['code'], scope: 'all' }],
    }),
  ).rejects.toBeInstanceOf(ZodError)
})

test('default roles — ровно 5 ролей из ARCHITECTURE.md §8.3', async () => {
  const all = await db.select().from(roles)
  expect(all).toHaveLength(5)
  expect(all.map((role) => role.name).sort()).toEqual(DEFAULT_ROLES.map((role) => role.name).sort())
  expect(all.filter((role) => role.isSystem).map((role) => role.name)).toEqual(['Владелец'])
})
