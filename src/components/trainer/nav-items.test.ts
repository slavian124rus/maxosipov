import { expect, test } from 'vitest'
import type { Actor, Permission } from '@/modules/rbac'
import { settingsNavItems, trainerNavItems } from './nav-config'
import { isNavActive, mobileNavItems, settingsGroups } from './nav-items'

function actor(permissions: Permission[], isOwner = false): Actor {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    roleId: '00000000-0000-4000-8000-000000000002',
    gymId: '00000000-0000-4000-8000-000000000003',
    isOwner,
    permissions: permissions.map((code) => ({ code, scope: 'all' as const })),
  }
}

const hrefs = (items: { href: string }[]): string[] => items.map((item) => item.href)

test('владелец видит все разделы кабинета', () => {
  expect(hrefs(trainerNavItems(actor([], true)))).toEqual([
    '/trainer',
    '/trainer/clients',
    '/trainer/programs',
    '/trainer/exercises',
    '/trainer/machines',
    '/trainer/subscriptions',
    '/trainer/settings',
  ])
})

test('тренер без права на подписки не видит раздел «Подписки»', () => {
  const items = trainerNavItems(actor(['clients.view', 'clients.edit_programs', 'catalog.edit']))

  expect(hrefs(items)).toEqual([
    '/trainer',
    '/trainer/clients',
    '/trainer/programs',
    '/trainer/exercises',
    '/trainer/machines',
    '/trainer/settings',
  ])
})

test('catalog.publish без catalog.edit открывает упражнения, но не тренажёры', () => {
  const items = trainerNavItems(actor(['catalog.publish']))

  expect(hrefs(items)).toContain('/trainer/exercises')
  expect(hrefs(items)).not.toContain('/trainer/machines')
})

test('без прав остаётся только «Сегодня» и «Ещё»', () => {
  expect(hrefs(trainerNavItems(actor([])))).toEqual(['/trainer', '/trainer/settings'])
})

test('в нижнем меню телефона не больше пяти пунктов, «Ещё» всегда последний', () => {
  const mobile = mobileNavItems(trainerNavItems(actor([], true)))

  expect(mobile).toHaveLength(5)
  expect(hrefs(mobile)).toEqual([
    '/trainer',
    '/trainer/clients',
    '/trainer/programs',
    '/trainer/exercises',
    '/trainer/settings',
  ])
  expect(mobile.at(-1)?.label).toBe('Ещё')
})

test('isNavActive: «Сегодня» только точным адресом, остальные — с вложенными', () => {
  expect(isNavActive('/trainer', '/trainer')).toBe(true)
  expect(isNavActive('/trainer/clients', '/trainer')).toBe(false)
  expect(isNavActive('/trainer/clients', '/trainer/clients')).toBe(true)
  expect(isNavActive('/trainer/clients/42', '/trainer/clients')).toBe(true)
  expect(isNavActive('/trainer/machines', '/trainer/clients')).toBe(false)
})

test('раздел «Ещё»: пункты по правам, группы в порядке Зал → Доступ → Люди', () => {
  const owner = settingsNavItems(actor([], true))
  const groups = settingsGroups(owner)

  expect(groups.map((group) => group.title)).toEqual(['Зал', 'Доступ', 'Люди'])
  expect(groups[0]?.items.map((item) => item.label)).toContain('МаксИИм')
  expect(groups[1]?.items.map((item) => item.label)).toEqual([
    'Подписки',
    'Пробный период и цена',
  ])
  expect(groups[2]?.items.map((item) => item.label)).toEqual(['Люди', 'Роли и права', 'Журнал'])
})

test('раздел «Ещё»: пустые группы не показываются', () => {
  const groups = settingsGroups(settingsNavItems(actor(['catalog.edit'])))

  expect(groups.map((group) => group.title)).toEqual(['Зал'])
  expect(groups[0]?.items.map((item) => item.href)).toEqual([
    '/trainer/machines',
    '/trainer/settings/zones',
    '/trainer/settings/warmups',
  ])
})

test('у каждого пункта меню есть иконка и подпись для ПК', () => {
  for (const item of trainerNavItems(actor([], true))) {
    expect(item.icon).toBeTruthy()
    expect(item.hint?.length ?? 0).toBeGreaterThan(0)
  }
})
