import { expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { LanguageModel } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { parseVoiceLog } from './voice'

const JIM = '11111111-1111-4111-8111-111111111111'
const TYAGA = '22222222-2222-4222-8222-222222222222'

const SESSION = [
  { id: JIM, name: 'Жим ногами' },
  { id: TYAGA, name: 'Тяга верхнего блока' },
]

function mockJson(object: unknown): LanguageModel {
  return new MockLanguageModelV3({
    modelId: 'mock-fast',
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(object) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 50, text: 50, reasoning: 0 },
      },
      warnings: [],
    }),
  })
}

test('«жим ногами три по двенадцать на сто двадцать, последний тяжело»', async () => {
  const model = mockJson({
    rows: [
      {
        spokenName: 'жим ногами',
        exerciseId: JIM,
        sets: [
          { weightKg: 120, reps: 12 },
          { weightKg: 120, reps: 12 },
          { weightKg: 120, reps: 12 },
        ],
        feeling: 'hard',
      },
    ],
  })

  const result = await parseVoiceLog(
    'жим ногами три по двенадцать на сто двадцать, последний тяжело',
    SESSION,
    { getModel: () => model },
  )

  expect(result.rows).toHaveLength(1)
  expect(result.rows[0]?.exerciseId).toBe(JIM)
  expect(result.rows[0]?.sets).toHaveLength(3)
  expect(result.rows[0]?.sets[0]).toEqual({ weightKg: 120, reps: 12 })
  expect(result.rows[0]?.feeling).toBe('hard')
  expect(result.flag).toBeNull()
})

test('упражнение не из тренировки — exerciseId null', async () => {
  const model = mockJson({
    rows: [
      {
        spokenName: 'жим гантелями',
        exerciseId: null,
        sets: [{ weightKg: 20, reps: 10 }],
        feeling: null,
      },
    ],
  })

  const result = await parseVoiceLog('ещё жал гантели', SESSION, { getModel: () => model })

  expect(result.rows[0]?.exerciseId).toBeNull()
  expect(result.rows[0]?.spokenName).toBe('жим гантелями')
})

test('модель вернула exerciseId не из списка — заменяется на null', async () => {
  const model = mockJson({
    rows: [
      {
        spokenName: 'жим ногами',
        exerciseId: randomUUID(),
        sets: [{ weightKg: 120, reps: 12 }],
        feeling: 'good',
      },
    ],
  })

  const result = await parseVoiceLog('жим ногами на сто двадцать', SESSION, { getModel: () => model })

  expect(result.rows[0]?.exerciseId).toBeNull()
})

test('«тянуло поясницу» — флаг pain из detectFlag', async () => {
  const model = mockJson({ rows: [] })

  const result = await parseVoiceLog('тянуло поясницу после приседа', SESSION, {
    getModel: () => model,
  })

  expect(result.flag).toBe('pain')
})