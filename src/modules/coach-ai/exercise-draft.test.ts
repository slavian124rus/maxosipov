import { expect, test } from 'vitest'
import type { LanguageModel } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { draftExerciseText, MISTAKE_LIMIT, STEP_LIMIT, TIP_LIMIT } from './exercise-draft'

function mockJson(object: unknown): LanguageModel {
  return new MockLanguageModelV3({
    modelId: 'mock-main',
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

const input = {
  name: 'Жим ногами',
  machine: 'Жим ногами',
  primary: ['quads'],
  secondary: ['glutes'],
}

test('длины соблюдены, лишние элементы отрезаны', async () => {
  const model = mockJson({
    steps: [
      'Сядь и прижми поясницу',
      'Поставь стопы на платформу',
      'Плавно опусти платформу',
      'Выжми до конца, не отрывая таз',
      'Следи за коленями',
      'Дыши ровно',
    ],
    mistakes: [
      'Отрываешь таз от спинки',
      'Доводишь колени внутрь',
      'Берёшь слишком большой вес',
      'Делаешь рывком',
      'Задерживаешь дыхание',
    ],
    tip: 'Начни с лёгкого веса и почувствуй, как работает квадрицепс — это важнее цифры на тренажёре.',
  })

  const draft = await draftExerciseText(input, { getModel: () => model })

  expect(draft.steps).toHaveLength(5)
  expect(draft.steps.every((step) => step.length <= STEP_LIMIT)).toBe(true)
  expect(draft.mistakes).toHaveLength(4)
  expect(draft.mistakes.every((mistake) => mistake.length <= MISTAKE_LIMIT)).toBe(true)
  expect(draft.tip.length).toBeLessThanOrEqual(TIP_LIMIT)
})

test('пустые пункты отбрасываются', async () => {
  const model = mockJson({
    steps: ['Сядь ровно', '', '   '],
    mistakes: ['Рывки корпусом'],
    tip: 'Держи темп',
  })

  const draft = await draftExerciseText(input, { getModel: () => model })

  expect(draft.steps).toEqual(['Сядь ровно'])
  expect(draft.mistakes).toEqual(['Рывки корпусом'])
  expect(draft.tip).toBe('Держи темп')
})