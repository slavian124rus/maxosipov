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
const { notify, notifyThrottled, subscribePush } = await import('./notify')
const { isAllowedPushEndpoint } = await import('./push')

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
  await addSubscription('https://fcm.googleapis.com/fcm/send/one')

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

  await addSubscription('https://fcm.googleapis.com/fcm/send/dead')
  await addSubscription('https://fcm.googleapis.com/fcm/send/alive')

  await notify(USER_ID, 'program_updated')

  const left = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, USER_ID))
  expect(left.map((row) => row.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/alive'])
  expect(sendNotification).toHaveBeenCalledTimes(2)
})

test('без push (ai_change_accepted) строка есть, отправки нет', async () => {
  await addSubscription('https://fcm.googleapis.com/fcm/send/one')

  await notify(USER_ID, 'ai_change_accepted', { name: 'Иван', line: 'Добавлено: тяга', clientId: 'c1' })

  const rows = await db.select().from(notifications).where(eq(notifications.userId, USER_ID))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.pushedAt).toBeNull()
  expect(sendNotification).not.toHaveBeenCalled()
})

test('пустая сводка тренеру не отправляется', async () => {
  await addSubscription('https://fcm.googleapis.com/fcm/send/one')

  await notify(USER_ID, 'trainer_daily', { expiring: 0, pain: 0 }, 'daily:2026-11-09')

  expect(sendNotification).not.toHaveBeenCalled()
})

test('подписка сохраняется и обновляется по endpoint', async () => {
  await addSubscription('https://fcm.googleapis.com/fcm/send/one')
  await subscribePush(USER_ID, { endpoint: 'https://fcm.googleapis.com/fcm/send/one', keys: { p256dh: 'new', auth: 'new' } }, 'ua2')

  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, USER_ID))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.keys.p256dh).toBe('new')
  expect(rows[0]?.userAgent).toBe('ua2')
})
test('адрес подписки: только https-адреса настоящих push-сервисов (защита от SSRF)', async () => {
  const bad = [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://127.0.0.1/hook',
    'https://localhost/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://internal-service.local/push',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.example/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'не адрес',
  ]
  for (const endpoint of bad) {
    expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false)
    await expect(addSubscription(endpoint), endpoint).rejects.toThrow('Некорректная подписка')
  }

  const good = [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]
  for (const endpoint of good) expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true)

  const rows = await db.select().from(pushSubscriptions)
  expect(rows).toHaveLength(0)
})

test('notifyThrottled: не чаще одного уведомления вида в окно, потом снова можно', async () => {
  sendNotification.mockResolvedValue({ statusCode: 201 })
  await addSubscription('https://fcm.googleapis.com/fcm/send/one')

  expect(await notifyThrottled(USER_ID, 'program_updated', {}, 60_000)).toBe(true)
  expect(await notifyThrottled(USER_ID, 'program_updated', {}, 60_000)).toBe(false)
  expect(await notifyThrottled(USER_ID, 'program_updated', {}, 60_000)).toBe(false)
  expect(sendNotification).toHaveBeenCalledTimes(1)

  // Другой вид уведомления окно не занимает.
  expect(await notifyThrottled(USER_ID, 'sub_ended', {}, 60_000)).toBe(true)

  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(await notifyThrottled(USER_ID, 'program_updated', {}, 5)).toBe(true)

  const rows = await db.select().from(notifications).where(eq(notifications.userId, USER_ID))
  expect(rows.filter((row) => row.kind === 'program_updated')).toHaveLength(2)
})
