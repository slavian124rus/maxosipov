// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addRest, clearRest, readRest, remainingSeconds, startRest } from './rest-store'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T10:00:00Z'))
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

test('отдых хранится с моментом окончания и переживает «уход со страницы»', () => {
  startRest('pe-1', 90)
  vi.setSystemTime(new Date('2026-11-14T10:00:30Z'))

  const rest = readRest()
  expect(rest?.id).toBe('pe-1')
  expect(remainingSeconds(rest!)).toBe(60)
})

test('таймер считает по часам, а не по тикам: после фона время не «замерзает»', () => {
  startRest('pe-1', 60)
  vi.setSystemTime(new Date('2026-11-14T10:00:45Z'))
  expect(remainingSeconds(readRest()!)).toBe(15)
})

test('истёкший отдых не возвращается', () => {
  startRest('pe-1', 30)
  vi.setSystemTime(new Date('2026-11-14T10:05:00Z'))
  expect(readRest()).toBeNull()
})

test('+30 секунд продлевает и конец, и общую длительность', () => {
  startRest('pe-1', 60)
  addRest(30)
  const rest = readRest()!
  expect(rest.seconds).toBe(90)
  expect(remainingSeconds(rest)).toBe(90)
})

test('clearRest убирает отдых, новый старт заменяет прежний', () => {
  startRest('pe-1', 60)
  startRest('pe-2', 45)
  expect(readRest()?.id).toBe('pe-2')
  clearRest()
  expect(readRest()).toBeNull()
})

test('повреждённая запись в памяти не ломает экран', () => {
  localStorage.setItem('maxim.rest', '{oops')
  expect(readRest()).toBeNull()
})
