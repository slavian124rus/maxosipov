// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getOfflineDb } from './db'
import { useActiveSession } from './use-active-session'

beforeEach(async () => {
  const db = await getOfflineDb()
  await db.sets.clear()
  await db.activeSession.clear()
})

test('подход, записанный до окончания старта, не теряется', async () => {
  const { result } = renderHook(() => useActiveSession())

  await act(async () => {
    // Клиент нетерпеливый: жмёт «Записать подход», не дождавшись старта тренировки.
    const starting = result.current.startOrResume({
      programDayId: 'day-1',
      mode: 'free',
      programSnapshot: null,
    })
    const logging = result.current.logSet({
      exerciseId: 'ex-1',
      setIndex: 1,
      weightKg: 40,
      reps: 10,
    })

    await Promise.all([starting, logging])
  })

  const rows = await (await getOfflineDb()).sets.toArray()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ setIndex: 1, weightKg: 40, reps: 10 })
})

test('второй подход получает следующий номер, старт один', async () => {
  const { result } = renderHook(() => useActiveSession())

  await act(async () => {
    await result.current.startOrResume({ programDayId: 'day-1', mode: 'free', programSnapshot: null })
    await result.current.logSet({ exerciseId: 'ex-1', setIndex: 1, weightKg: 40, reps: 10 })
    await result.current.logSet({ exerciseId: 'ex-1', setIndex: 2, weightKg: 42.5, reps: 9 })
  })

  const db = await getOfflineDb()
  expect(await db.sets.count()).toBe(2)
  expect(await db.activeSession.count()).toBe(1)
})

test('без старта подход не пишется: понятная ошибка вместо тишины', async () => {
  const { result } = renderHook(() => useActiveSession())

  await expect(
    result.current.logSet({ exerciseId: 'ex-1', setIndex: 1, weightKg: 40, reps: 10 }),
  ).rejects.toThrow('Тренировка не начата')
})

test('ощущение пишется всем подходам упражнения', async () => {
  const { result } = renderHook(() => useActiveSession())

  await act(async () => {
    await result.current.startOrResume({ programDayId: 'day-1', mode: 'free', programSnapshot: null })
    await result.current.logSet({ exerciseId: 'ex-1', setIndex: 1, weightKg: 40, reps: 10 })
    await result.current.logSet({ exerciseId: 'ex-1', setIndex: 2, weightKg: 40, reps: 10 })
    await result.current.setFeeling('ex-1', 'hard')
  })

  const rows = await (await getOfflineDb()).sets.toArray()
  expect(rows.map((row) => row.feeling)).toEqual(['hard', 'hard'])
})

test('случайный сбой хранилища не ломает следующую запись', async () => {
  const { result } = renderHook(() => useActiveSession())

  await act(async () => {
    await result.current.startOrResume({ programDayId: 'day-1', mode: 'free', programSnapshot: null })
  })

  const db = await getOfflineDb()
  const spy = vi.spyOn(db.sets, 'put').mockRejectedValueOnce(new Error('quota'))

  await expect(
    result.current.logSet({ exerciseId: 'ex-1', setIndex: 1, weightKg: 40, reps: 10 }),
  ).rejects.toThrow('quota')

  spy.mockRestore()

  await act(async () => {
    await result.current.logSet({ exerciseId: 'ex-1', setIndex: 1, weightKg: 40, reps: 10 })
  })

  expect(await db.sets.count()).toBe(1)
})
