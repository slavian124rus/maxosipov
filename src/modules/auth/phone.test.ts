import { expect, test } from 'vitest'
import { normalizePhone } from './phone'

test.each([
  ['8 (999) 123-45-67', '+79991234567'],
  ['+7 999 1234567', '+79991234567'],
  ['79991234567', '+79991234567'],
  ['9991234567', '+79991234567'],
  [' +7-999-123-45-67 ', '+79991234567'],
  ['+7 (391) 200-10-10', '+73912001010'],
])('приводит «%s» к E.164', (input, expected) => {
  expect(normalizePhone(input)).toBe(expected)
})

test.each(['', '123', '+1 202 555 0101', '8999123456', 'abc', '+7999123456789'])(
  'отклоняет «%s»',
  (input) => {
    expect(normalizePhone(input)).toBeNull()
  },
)
