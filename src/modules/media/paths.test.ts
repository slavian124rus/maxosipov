import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { mediaDir, safeJoin } from './paths'

describe('mediaDir', () => {
  test('yyyy/mm/id в UTC', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(mediaDir({ id, createdAt: new Date('2026-11-07T20:00:00Z') })).toBe(`2026/11/${id}`)
    expect(mediaDir({ id, createdAt: new Date('2026-01-01T00:00:00Z') })).toBe(`2026/01/${id}`)
  })
})

describe('safeJoin', () => {
  const root = path.resolve('tmp-media-root')

  test('обычный путь склеивается', () => {
    expect(safeJoin(root, '2026/11/abc/video.mp4')).toBe(
      path.join(root, '2026', '11', 'abc', 'video.mp4'),
    )
  })

  test('выход за корень через .. запрещён', () => {
    expect(() => safeJoin(root, '../etc/passwd')).toThrow()
    expect(() => safeJoin(root, '2026/../../etc/passwd')).toThrow()
  })

  test('абсолютный путь запрещён', () => {
    expect(() => safeJoin(root, '/etc/passwd')).toThrow()
    expect(() => safeJoin(root, 'C:/Windows/system32')).toThrow()
  })

  test('нулевой байт запрещён', () => {
    expect(() => safeJoin(root, '2026/video\0.mp4')).toThrow()
  })
})
