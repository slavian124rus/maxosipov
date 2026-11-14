import { expect, test, vi } from 'vitest'
import { recoverReply } from './recover-reply'

const sleep = async () => {}

test('дожидается ответа, который сервер дописал после обрыва связи', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce([{ role: 'user', content: 'привет' }])
    .mockResolvedValueOnce([
      { role: 'user', content: 'привет' },
      { role: 'assistant', content: 'Здравствуй!' },
    ])
  expect(await recoverReply(load, 'привет', { attempts: 5, sleep })).toBe('Здравствуй!')
  expect(load).toHaveBeenCalledTimes(2)
})

test('ответ на предыдущее такое же сообщение не принимается за новый', async () => {
  const load = vi.fn().mockResolvedValue([
    { role: 'user', content: 'привет' },
    { role: 'assistant', content: 'старый' },
    { role: 'user', content: 'привет' },
  ])
  expect(await recoverReply(load, 'привет', { attempts: 3, sleep })).toBeNull()
})

test('ошибка сети при опросе не ломает ожидание', async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ])
  expect(await recoverReply(load, 'a', { attempts: 3, sleep })).toBe('b')
})

test('ответа нет за все попытки — null', async () => {
  const load = vi.fn().mockResolvedValue([{ role: 'user', content: 'a' }])
  expect(await recoverReply(load, 'a', { attempts: 3, sleep })).toBeNull()
  expect(load).toHaveBeenCalledTimes(3)
})
