import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { users } from '@/modules/auth'
import { gyms } from '@/modules/gym'
import { roles } from '@/modules/rbac'
import { db } from '@/shared/db'
import { runSeed } from '../scripts/seed'
import { closeDb, prepareTestDb, resetDb } from './db'

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
})

test('production без SEED_* создаёт только зал и роли, пользователей не создаёт', async () => {
  const result = await runSeed({ production: true })

  expect(result.users).toBe(0)
  expect(await db.select().from(users)).toHaveLength(0)
  expect(await db.select().from(roles)).toHaveLength(5)
  expect(await db.select().from(gyms)).toHaveLength(1)
})

test('production с SEED_OWNER_PHONE и SEED_TRAINER_PHONE создаёт двух пользователей', async () => {
  await runSeed({
    production: true,
    ownerPhone: '+79990000001',
    trainerPhone: '+79990000002',
  })

  const rows = await db.select().from(users)
  expect(rows).toHaveLength(2)
  expect(rows.map((row) => row.phone).sort()).toEqual(['+79990000001', '+79990000002'])
})

test('dev-сид создаёт 7 пользователей и идемпотентен при повторном запуске', async () => {
  await runSeed({ production: false })
  await runSeed({ production: false })

  expect(await db.select().from(users)).toHaveLength(7)
  expect(await db.select().from(roles)).toHaveLength(5)
  expect(await db.select().from(gyms)).toHaveLength(1)
})
