import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { LineChart, niceRange } from './line-chart'

const day = (value: number): Date => new Date(`2026-11-0${value}T09:00:00Z`)

test('одна точка: крупная точка и подпись значения', () => {
  const html = renderToStaticMarkup(
    <LineChart points={[{ x: day(7), y: 78.1 }]} ariaLabel="Вес" timezone="UTC" />,
  )

  expect(html).toContain('78,1')
  expect(html).toContain('r="6"')
  expect(html).toContain('role="img"')
})

test('две точки: рисуется линия', () => {
  const html = renderToStaticMarkup(
    <LineChart
      points={[
        { x: day(1), y: 80 },
        { x: day(7), y: 78 },
      ]}
      ariaLabel="Вес"
    />,
  )

  expect(html).toContain('<path')
  expect(html).toContain('M')
  expect(html).toContain('1 нояб')
  expect(html).toContain('7 нояб')
})

test('плоский график не делит на ноль', () => {
  const html = renderToStaticMarkup(
    <LineChart
      points={[
        { x: day(1), y: 80 },
        { x: day(7), y: 80 },
      ]}
      ariaLabel="Вес"
    />,
  )

  expect(html).not.toContain('NaN')
  expect(html).toContain('80')
})

test('пустой набор не рисуется', () => {
  expect(renderToStaticMarkup(<LineChart points={[]} ariaLabel="Вес" />)).toBe('')
})

test('niceRange даёт запас 10 % и не схлопывается', () => {
  expect(niceRange([80, 90])).toEqual({ min: 79, max: 91 })
  expect(niceRange([80])).toEqual({ min: 72, max: 88 })
})