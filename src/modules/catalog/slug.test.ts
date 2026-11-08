import { expect, test } from 'vitest'
import { slugify } from './slug'

test.each([
  ['Тяга верхнего блока к груди', 'tyaga-verkhnego-bloka-k-grudi'],
  ['Жим ногами 45°', 'zhim-nogami-45'],
  ['Подъём штанги на бицепс', 'podyom-shtangi-na-bitseps'],
  ['Щипцы, щётка и ёж', 'shchiptsy-shchyotka-i-yozh'],
  ['  Лишние   пробелы  ', 'lishnie-probely'],
])('«%s» → %s', (input, expected) => {
  expect(slugify(input)).toBe(expected)
})

test('пустое название даёт пустую строку', () => {
  expect(slugify('   ')).toBe('')
})
