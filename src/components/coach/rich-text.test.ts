import { expect, test } from 'vitest'
import { parseBlocks, parseInline } from './rich-text'

test('абзацы разделяются пустой строкой', () => {
  expect(parseBlocks('Первый\n\nВторой')).toEqual([
    { type: 'p', text: 'Первый' },
    { type: 'p', text: 'Второй' },
  ])
})

test('маркированный и нумерованный списки', () => {
  expect(parseBlocks('Вот план:\n- жим\n- тяга\n\n1. разминка\n2. работа')).toEqual([
    { type: 'p', text: 'Вот план:' },
    { type: 'ul', items: ['жим', 'тяга'] },
    { type: 'ol', items: ['разминка', 'работа'] },
  ])
})

test('жирный текст выделяется, остальное остаётся обычным', () => {
  expect(parseInline('Сделай **3 подхода** по 10')).toEqual([
    { bold: false, text: 'Сделай ' },
    { bold: true, text: '3 подхода' },
    { bold: false, text: ' по 10' },
  ])
})

test('незакрытые звёздочки не ломают текст', () => {
  expect(parseInline('цена ** не закрыта')).toEqual([{ bold: false, text: 'цена ** не закрыта' }])
})

test('пустая строка не даёт блоков', () => {
  expect(parseBlocks('  \n ')).toEqual([])
})
