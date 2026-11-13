import { describe, expect, test } from 'vitest'
import type { WarmupItem } from './schema'
import { adjustWarmupForPain, resolveDayFocus, warmupSeconds } from './warmup'

const item = (title: string, zones: string[], durationSec: number | null = 60, reps: number | null = null): WarmupItem => ({
  title,
  exerciseId: null,
  durationSec,
  reps,
  note: null,
  zones,
})

describe('resolveDayFocus', () => {
  test('заданный тренером тип дня главнее расчёта', () => {
    expect(resolveDayFocus('upper', [['quads'], ['quads']])).toBe('upper')
  })

  test('больше половины упражнений на ноги — legs', () => {
    expect(resolveDayFocus(null, [['quads'], ['hamstrings'], ['calves'], ['chest']])).toBe('legs')
  })

  test('больше половины на верх — upper', () => {
    expect(resolveDayFocus(null, [['chest'], ['lats'], ['biceps'], ['quads']])).toBe('upper')
  })

  test('поровну — full; пустой день — full', () => {
    expect(resolveDayFocus(null, [['quads'], ['chest']])).toBe('full')
    expect(resolveDayFocus(null, [])).toBe('full')
  })

  test('пресс и кор не считаются ни ногами, ни верхом', () => {
    expect(resolveDayFocus(null, [['abs'], ['obliques'], ['quads']])).toBe('full')
  })
})

describe('warmupSeconds', () => {
  test('суммирует время; повторения считает по 3 секунды', () => {
    expect(warmupSeconds([item('Бег', [], 180), item('Приседания', [], null, 10), item('Пауза', [], null, null)])).toBe(210)
  })
})

describe('adjustWarmupForPain', () => {
  const items = [item('Дорожка', [], 180), item('Круги коленями', ['knee'], 60), item('Мостик', ['back'], 60), item('Руки', ['shoulder'], 60)]

  test('без боли ничего не меняет', () => {
    expect(adjustWarmupForPain(items, [], [])).toEqual(items)
  })

  test('убирает пункты, нагружающие больную зону', () => {
    const result = adjustWarmupForPain(items, ['knee'], [])
    expect(result.map((x) => x.title)).toEqual(['Дорожка', 'Мостик', 'Руки'])
  })

  test('добирает время безопасными пунктами из библиотеки, не повторяя уже стоящие', () => {
    const short = [item('Круги коленями', ['knee'], 120), item('Дорожка', [], 120)]
    const library = [item('Дорожка', [], 120), item('Лёгкие круги плечами', ['shoulder'], 120), item('Присед с резинкой', ['knee'], 120), item('Кошка-корова', ['back'], 120)]
    const result = adjustWarmupForPain(short, ['knee'], library)
    expect(result.map((x) => x.title)).toEqual(['Дорожка', 'Лёгкие круги плечами', 'Кошка-корова'])
    expect(warmupSeconds(result)).toBe(360)
  })

  test('общая боль без зоны не меняет разминку', () => {
    expect(adjustWarmupForPain(items, ['general'], [])).toEqual(items)
  })
})
