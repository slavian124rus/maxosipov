import { expect, test } from 'vitest'
import { canonicalEmail, normalizeEmail } from './email'

test('приводит к нижнему регистру и обрезает пробелы', () => {
  expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com')
})

test('отвергает не-адреса', () => {
  for (const bad of ['', 'foo', 'foo@bar', 'foo@@bar.ru', 'fo o@bar.ru', '@bar.ru', 'foo@.ru', 'a@b.c']) {
    expect(normalizeEmail(bad), bad).toBeNull()
  }
})

test('отвергает слишком длинный адрес', () => {
  expect(normalizeEmail(`${'a'.repeat(250)}@b.ru`)).toBeNull()
})

test('canonicalEmail убирает +тег, а у gmail ещё и точки', () => {
  expect(canonicalEmail('foo.bar+gym@gmail.com')).toBe('foobar@gmail.com')
  expect(canonicalEmail('foo.bar+gym@googlemail.com')).toBe('foobar@gmail.com')
  expect(canonicalEmail('foo.bar+gym@yandex.ru')).toBe('foo.bar@yandex.ru')
  expect(canonicalEmail('foo@mail.ru')).toBe('foo@mail.ru')
})
