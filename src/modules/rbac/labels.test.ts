import { expect, test } from 'vitest'
import { PERMISSIONS } from './permissions'
import { PERMISSION_GROUPS, PERMISSION_LABELS } from './labels'

test('у каждого из 16 прав есть русская подпись и группа', () => {
  expect(PERMISSIONS).toHaveLength(16)

  for (const code of PERMISSIONS) {
    const label = PERMISSION_LABELS[code]
    expect(label, code).toBeDefined()
    expect(label.label.length).toBeGreaterThan(3)
    expect(PERMISSION_GROUPS).toContain(label.group)
  }
})

test('подписи прав не повторяются', () => {
  const labels = PERMISSIONS.map((code) => PERMISSION_LABELS[code].label)
  expect(new Set(labels).size).toBe(labels.length)
})