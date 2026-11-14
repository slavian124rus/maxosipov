import { expect, test } from 'vitest'
import { ZodError } from 'zod'
import { applyPatch, diffPrograms, formatScheme, PatchError, type ProgramTree } from './patch'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const DAY1 = '44444444-4444-4444-8444-444444444444'
const DAY2 = '55555555-5555-4555-8555-555555555555'
const PE1 = '66666666-6666-4666-8666-666666666666'
const PE2 = '77777777-7777-4777-8777-777777777777'

const published = new Set([A, B, C])

function tree(): ProgramTree {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    ownerId: '99999999-9999-4999-8999-999999999999',
    authorKind: 'trainer',
    name: 'Старт: 3 дня',
    status: 'active',
    days: [
      {
        id: DAY1,
        order: 1,
        name: 'День A — спина и бицепс',
        exercises: [
          {
            id: PE1,
            order: 1,
            exerciseId: A,
            sets: 3,
            repMin: 10,
            repMax: 12,
            restSec: 90,
            targetWeightKg: null,
            setWeights: null,
            note: null,
          },
          {
            id: PE2,
            order: 2,
            exerciseId: B,
            sets: 3,
            repMin: 10,
            repMax: 12,
            restSec: 90,
            targetWeightKg: null,
            setWeights: null,
            note: null,
          },
        ],
      },
      { id: DAY2, order: 2, name: 'День B — ноги', exercises: [] },
    ],
  }
}

test('formatScheme: «3 подхода · 10–12 раз» и «3 подхода · 10 раз»', () => {
  expect(formatScheme(3, 10, 12)).toBe('3 подхода · 10–12 раз')
  expect(formatScheme(4, 8, 8)).toBe('4 подхода · 8 раз')
})

test('add_exercise добавляет в конец и после afterId', () => {
  const appended = applyPatch(
    tree(),
    { ops: [{ op: 'add_exercise', dayId: DAY1, exerciseId: C, sets: 3, repMin: 8, repMax: 10 }] },
    published,
  )
  expect(appended.days[0]?.exercises).toHaveLength(3)
  expect(appended.days[0]?.exercises[2]?.exerciseId).toBe(C)
  expect(appended.days[0]?.exercises[2]?.restSec).toBe(90)

  const inserted = applyPatch(
    tree(),
    {
      ops: [
        {
          op: 'add_exercise',
          dayId: DAY1,
          exerciseId: C,
          sets: 3,
          repMin: 8,
          repMax: 10,
          afterId: PE1,
        },
      ],
    },
    published,
  )
  expect(inserted.days[0]?.exercises.map((item) => item.exerciseId)).toEqual([A, C, B])
  expect(inserted.days[0]?.exercises.map((item) => item.order)).toEqual([1, 2, 3])
})

test('remove_exercise убирает и переиндексирует', () => {
  const next = applyPatch(
    tree(),
    { ops: [{ op: 'remove_exercise', programExerciseId: PE1 }] },
    published,
  )
  expect(next.days[0]?.exercises.map((item) => item.exerciseId)).toEqual([B])
  expect(next.days[0]?.exercises[0]?.order).toBe(1)
})

test('replace_exercise меняет упражнение, сохраняя схему', () => {
  const next = applyPatch(
    tree(),
    { ops: [{ op: 'replace_exercise', programExerciseId: PE1, exerciseId: C }] },
    published,
  )
  expect(next.days[0]?.exercises[0]?.exerciseId).toBe(C)
  expect(next.days[0]?.exercises[0]?.sets).toBe(3)
})

test('set_sets_reps и set_target_weight меняют поля', () => {
  const next = applyPatch(
    tree(),
    {
      ops: [
        { op: 'set_sets_reps', programExerciseId: PE1, sets: 4, repMin: 8, repMax: 10 },
        { op: 'set_target_weight', programExerciseId: PE1, weightKg: 55 },
      ],
    },
    published,
  )
  expect(next.days[0]?.exercises[0]).toMatchObject({
    sets: 4,
    repMin: 8,
    repMax: 10,
    targetWeightKg: 55,
  })
})

test('reorder переставляет упражнения дня', () => {
  const next = applyPatch(
    tree(),
    { ops: [{ op: 'reorder', dayId: DAY1, orderedIds: [PE2, PE1] }] },
    published,
  )
  expect(next.days[0]?.exercises.map((item) => item.id)).toEqual([PE2, PE1])
  expect(next.days[0]?.exercises.map((item) => item.order)).toEqual([1, 2])
})

test('add_day и rename_day', () => {
  const added = applyPatch(tree(), { ops: [{ op: 'add_day', name: 'День C — повтор A' }] }, published)
  expect(added.days).toHaveLength(3)
  expect(added.days[2]?.name).toBe('День C — повтор A')

  const renamed = applyPatch(
    tree(),
    { ops: [{ op: 'rename_day', dayId: DAY2, name: 'Ноги' }] },
    published,
  )
  expect(renamed.days[1]?.name).toBe('Ноги')
})

test('add_day с заданным dayId: в новый день можно сразу добавлять упражнения в том же патче', () => {
  const NEW_DAY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const next = applyPatch(
    tree(),
    {
      ops: [
        { op: 'delete_day', dayId: DAY2 },
        { op: 'add_day', name: 'Плечи и бицепс', dayId: NEW_DAY },
        { op: 'add_exercise', dayId: NEW_DAY, exerciseId: A, sets: 4, repMin: 8, repMax: 12 },
        { op: 'add_exercise', dayId: NEW_DAY, exerciseId: B, sets: 3, repMin: 10, repMax: 12 },
      ],
    },
    published,
  )
  expect(next.days.map((day) => day.name)).toEqual(['День A — спина и бицепс', 'Плечи и бицепс'])
  expect(next.days[1]?.id).toBe(NEW_DAY)
  expect(next.days[1]?.exercises).toHaveLength(2)
})

test('исходное дерево не меняется', () => {
  const before = tree()
  applyPatch(before, { ops: [{ op: 'remove_exercise', programExerciseId: PE1 }] }, published)
  expect(before.days[0]?.exercises).toHaveLength(2)
})

test('несуществующий день / упражнение → PatchError с понятным текстом', () => {
  expect(() =>
    applyPatch(
      tree(),
      { ops: [{ op: 'add_exercise', dayId: C, exerciseId: A, sets: 3, repMin: 10, repMax: 12 }] },
      published,
    ),
  ).toThrow(new PatchError('Дня нет в программе'))

  expect(() =>
    applyPatch(tree(), { ops: [{ op: 'remove_exercise', programExerciseId: C }] }, published),
  ).toThrow(new PatchError('Упражнения нет в программе'))
})

test('упражнение не из каталога → «Такого упражнения нет в каталоге зала»', () => {
  expect(() =>
    applyPatch(
      tree(),
      { ops: [{ op: 'add_exercise', dayId: DAY1, exerciseId: C, sets: 3, repMin: 10, repMax: 12 }] },
      new Set([A, B]),
    ),
  ).toThrow('Такого упражнения нет в каталоге зала')
})

test('repMin > repMax → ошибка', () => {
  expect(() =>
    applyPatch(
      tree(),
      { ops: [{ op: 'set_sets_reps', programExerciseId: PE1, repMin: 12, repMax: 10 }] },
      published,
    ),
  ).toThrow('Минимум повторений больше максимума')
})

test('sets вне 1..10 → ошибка валидации Zod', () => {
  expect(() =>
    applyPatch(
      tree(),
      { ops: [{ op: 'add_exercise', dayId: DAY1, exerciseId: C, sets: 11, repMin: 10, repMax: 12 }] },
      published,
    ),
  ).toThrow(ZodError)
})

test('reorder с неполным набором id → ошибка', () => {
  expect(() =>
    applyPatch(tree(), { ops: [{ op: 'reorder', dayId: DAY1, orderedIds: [PE1] }] }, published),
  ).toThrow('Порядок должен содержать все упражнения дня')
})

test('diffPrograms: тексты добавления, изменения и удаления', () => {
  const before = tree()
  const after = applyPatch(
    before,
    {
      ops: [
        { op: 'set_sets_reps', programExerciseId: PE1, sets: 4, repMin: 8, repMax: 8 },
        { op: 'remove_exercise', programExerciseId: PE2 },
        { op: 'add_exercise', dayId: DAY2, exerciseId: C, sets: 3, repMin: 10, repMax: 12 },
      ],
    },
    published,
  )

  const names = (id: string): string =>
    ({ [A]: 'Жим ногами', [B]: 'Разгибание ног', [C]: 'Приседания' })[id] ?? id
  const lines = diffPrograms(before, after, names).map((line) => line.text)

  expect(lines).toContain('Жим ногами: 3 подхода · 10–12 раз → 4 подхода · 8 раз')
  expect(lines).toContain('Убрано: Разгибание ног')
  expect(lines).toContain('Добавлено: Приседания, 3 подхода · 10–12 раз')
})

test('delete_day убирает день с упражнениями и переиндексирует остальные', () => {
  const result = applyPatch(tree(), { ops: [{ op: 'delete_day', dayId: DAY1 }] }, published)

  expect(result.days).toHaveLength(1)
  expect(result.days[0]?.id).toBe(DAY2)
  expect(result.days[0]?.order).toBe(1)
  // Упражнения удалённого дня ушли вместе с ним.
  expect(result.days.flatMap((day) => day.exercises)).toHaveLength(0)
})

test('delete_day: можно удалить последний день, программа остаётся пустой', () => {
  const result = applyPatch(
    tree(),
    { ops: [{ op: 'delete_day', dayId: DAY1 }, { op: 'delete_day', dayId: DAY2 }] },
    published,
  )

  expect(result.days).toEqual([])
})

test('delete_day: несуществующий день → PatchError, дерево не меняется', () => {
  expect(() => applyPatch(tree(), { ops: [{ op: 'delete_day', dayId: C }] }, published)).toThrow(
    new PatchError('Дня нет в программе'),
  )
})

test('diffPrograms: удалённый день попадает в историю как «Убран день»', () => {
  const before = tree()
  const after = applyPatch(before, { ops: [{ op: 'delete_day', dayId: DAY2 }] }, published)
  const lines = diffPrograms(before, after).map((line) => line.text)

  expect(lines).toContain('Убран день: День B — ноги')
})

test('diffPrograms: перестановка отмечается как moved', () => {
  const before = tree()
  const after = applyPatch(
    before,
    { ops: [{ op: 'reorder', dayId: DAY1, orderedIds: [PE2, PE1] }] },
    published,
  )
  const lines = diffPrograms(before, after, (id) => (id === A ? 'Жим' : 'Тяга'))
  expect(lines.some((line) => line.kind === 'moved')).toBe(true)
})
test('set_set_weights: разный вес по подходам, рабочий вес — максимальный', () => {
  const next = applyPatch(
    tree(),
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20, 20] }] },
    published,
  )
  const item = next.days[0]!.exercises[0]!
  expect(item.setWeights).toEqual([15, 20, 20])
  expect(item.targetWeightKg).toBe(20)
})

test('set_set_weights: число весов должно совпадать с числом подходов', () => {
  expect(() =>
    applyPatch(
      tree(),
      { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20] }] },
      published,
    ),
  ).toThrow(PatchError)
})

test('set_set_weights: null возвращает один вес на все подходы и сохраняет рабочий вес', () => {
  const withWeights = applyPatch(
    tree(),
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20, 20] }] },
    published,
  )
  const cleared = applyPatch(
    withWeights,
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: null }] },
    published,
  )
  expect(cleared.days[0]!.exercises[0]!.setWeights).toBeNull()
  expect(cleared.days[0]!.exercises[0]!.targetWeightKg).toBe(20)
})

test('set_target_weight сбрасывает веса по подходам: вес снова один на все', () => {
  const withWeights = applyPatch(
    tree(),
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20, 20] }] },
    published,
  )
  const uniform = applyPatch(
    withWeights,
    { ops: [{ op: 'set_target_weight', programExerciseId: PE1, weightKg: 25 }] },
    published,
  )
  expect(uniform.days[0]!.exercises[0]!.setWeights).toBeNull()
  expect(uniform.days[0]!.exercises[0]!.targetWeightKg).toBe(25)
})

test('смена числа подходов подгоняет веса по подходам: лишние отрезаются, недостающие повторяют последний', () => {
  const withWeights = applyPatch(
    tree(),
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20, 20] }] },
    published,
  )
  const fewer = applyPatch(withWeights, { ops: [{ op: 'set_sets_reps', programExerciseId: PE1, sets: 2 }] }, published)
  expect(fewer.days[0]!.exercises[0]!.setWeights).toEqual([15, 20])
  const more = applyPatch(withWeights, { ops: [{ op: 'set_sets_reps', programExerciseId: PE1, sets: 4 }] }, published)
  expect(more.days[0]!.exercises[0]!.setWeights).toEqual([15, 20, 20, 20])
})

test('дифф показывает смену весов по подходам', () => {
  const after = applyPatch(
    tree(),
    { ops: [{ op: 'set_set_weights', programExerciseId: PE1, weights: [15, 20, 20] }] },
    published,
  )
  const lines = diffPrograms(tree(), after, () => 'Тяга')
  expect(lines.some((line) => line.text.includes('15') && line.text.includes('20'))).toBe(true)
})
