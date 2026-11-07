import { expect, test } from 'vitest'
import { checkHealth } from '@/shared/health'

test('checkHealth: успешный ping → up', async () => {
  await expect(checkHealth(async () => {})).resolves.toEqual({ ok: true, db: 'up' })
})

test('checkHealth: зависший ping не вешает проверку → down', async () => {
  const result = await checkHealth(() => new Promise<void>(() => {}), 50)
  expect(result).toEqual({ ok: false, db: 'down' })
})

test('checkHealth: ошибка ping → down', async () => {
  const result = await checkHealth(async () => {
    throw new Error('x')
  })
  expect(result).toEqual({ ok: false, db: 'down' })
})
