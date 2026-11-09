import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

// Ключи нужны, чтобы notify реально пытался отправить push (push.ts читает process.env).
process.env.VAPID_PUBLIC_KEY = 'test-public-key'
process.env.VAPID_PRIVATE_KEY = 'test-private-key'

const sendNotification = vi.fn()

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}))

const { db } = await import('@/shared/db')
const { closeDb, prepareTestDb, resetDb } = await import('../../../tests/db')
const { notifications, pushSubscriptions } = await import('./schema')
const { notify, subscribePush } = await import('./notify')

const USER_ID = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  sendNotification.mockReset()
})

async function addSubscription(endpoint: string): Promise<void> {
  await subscribePush(USER_ID, { endpoint, keys: { p256dh: 'key', auth: 'auth' } }, 'test')
}

test('повтор с тем же dedupeKey — одна строка и одна отправка', async () => {
  sendNotification.mockResolvedValue({ statusCode: 201 })
  await addSubscription('https://push.example/one')

  await notify(USER_ID, 'sub_ends_3d', {}, 'sub3d:user:2026-12-07')
  await notify(USER_ID, 'sub_ends_3d', {}, 'sub3d:user:2026-12-07')

  const rows = await db.select().from(notifications).where(eq(notifications.userId, USER_ID))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.dedupeKey).toBe('sub3d:user:2026-12-07')
  expect(rows[0]?.pushedAt).not.toBeNull()
  expect(sendNotification).toHaveBeenCalledTimes(1)
})

test('ответ 410 у одной из двух подписок: она удалена, вторая получила', async () => {
  sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
    if (subscription.endpoint.endsWith('/dead')) {
      throw Object.assign(new Error('Gone'), { statusCode: 410 })
    }
    return { statusCode: 201 }
  })

  await addSubscription('https://push.example/dead')
  await addSubscription('https://push.example/alive')

  await notify(USER_ID, 'program_updated')

  const left = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, USER_ID))
  expect(left.map((row) => row.endpoint)).toEqual(['https://push.example/alive'])
  expect(sendNotification).toHaveBeenCalledTimes(2)
})

test('без push (ai_change_accepted) строка есть, отправки нет', async () => {
  await addSubscription('https://push.example/one')

  await notify(USER_ID, 'ai_change_accepted', { name: 'Иван', line: 'Добавлено: тяга', clientId: 'c1' })

  const rows = await db.select().from(notifications).where(eq(notifications.userId, USER_ID))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.pushedAt).toBeNull()
  expect(sendNotification).not.toHaveBeenCalled()
})

test('пустая сводка тренеру не отправляется', async () => {
  await addSubscription('https://push.example/one')

  await notify(USER_ID, 'trainer_daily', { expiring: 0, pain: 0 }, 'daily:2026-11-09')

  expect(sendNotification).not.toHaveBeenCalled()
})

test('подписка сохраняется и обновляется по endpoint', async () => {
  await addSubscription('https://push.example/one')
  await subscribePush(USER_ID, { endpoint: 'https://push.example/one', keys: { p256dh: 'new', auth: 'new' } }, 'ua2')

  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, USER_ID))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.keys.p256dh).toBe('new')
  expect(rows[0]?.userAgent).toBe('ua2')
})