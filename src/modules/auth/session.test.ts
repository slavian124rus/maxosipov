import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { users } from './schema'
import { sessions } from './schema'
import { cookieDomainFor, createSession, destroySession, validateSessionToken } from './session'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../tests/db'
import { db } from '@/shared/db'

const DAY = 24 * 60 * 60 * 1000
const GYM_ID = '00000000-0000-4000-8000-000000000001'
const NOW = new Date('2026-11-07T09:00:00.000Z')

let userId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  await resetDb()
  const roles = await seedDefaultRoles()

  const [user] = await db
    .insert(users)
    .values({
      phone: '+79990000099',
      name: 'Тест',
      gymId: GYM_ID,
      roleId: roles['Клиент']!.id,
    })
    .returning()
  userId = user!.id
})

test('создаёт сессию и валидирует токен', async () => {
  const { token, expiresAt } = await createSession(userId, 'vitest')
  expect(expiresAt.toISOString()).toBe(new Date(NOW.getTime() + 90 * DAY).toISOString())

  const validated = await validateSessionToken(token)
  expect(validated?.userId).toBe(userId)
})

test('в базе хранится только хэш токена', async () => {
  const { token } = await createSession(userId, 'vitest')
  const [row] = await db.select().from(sessions).where(eq(sessions.userId, userId))

  expect(row?.tokenHash).not.toBe(token)
  expect(row?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
})

test('просроченная сессия не валидна', async () => {
  const { token } = await createSession(userId, 'vitest')
  vi.setSystemTime(new Date(NOW.getTime() + 91 * DAY))

  expect(await validateSessionToken(token)).toBeNull()
})

test('сессию продлевают, если до конца меньше 30 дней', async () => {
  const { token } = await createSession(userId, 'vitest')

  const in80Days = new Date(NOW.getTime() + 80 * DAY)
  vi.setSystemTime(in80Days)

  const validated = await validateSessionToken(token)
  expect(validated?.expiresAt.toISOString()).toBe(new Date(in80Days.getTime() + 90 * DAY).toISOString())

  const [row] = await db.select().from(sessions).where(eq(sessions.userId, userId))
  expect(row?.expiresAt.toISOString()).toBe(validated?.expiresAt.toISOString())
})

test('свежую сессию не продлевают', async () => {
  const { token, expiresAt } = await createSession(userId, 'vitest')

  const in5Days = new Date(NOW.getTime() + 5 * DAY)
  vi.setSystemTime(in5Days)

  const validated = await validateSessionToken(token)
  expect(validated?.expiresAt.toISOString()).toBe(expiresAt.toISOString())
})

test('destroySession удаляет сессию', async () => {
  const { token } = await createSession(userId, 'vitest')
  await destroySession(token)

  expect(await validateSessionToken(token)).toBeNull()
})

test('неизвестный токен → null', async () => {
  expect(await validateSessionToken('нет-такого-токена')).toBeNull()
})

test('cookieDomainFor: общая кука на поддоменах только для боевого домена', () => {
  expect(cookieDomainFor('https://app.maxosipov.ru')).toBe('.maxosipov.ru')
  expect(cookieDomainFor('https://app.maxosipov.ru/')).toBe('.maxosipov.ru')
  expect(cookieDomainFor('http://app.localhost:3000')).toBeUndefined()
  expect(cookieDomainFor('http://localhost:3000')).toBeUndefined()
})
