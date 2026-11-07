import { expect, test } from 'vitest'
import { checkPermission, type Actor } from './check'
import type { Permission, RolePermission } from './permissions'

const own = (code: Permission): RolePermission => ({ code, scope: 'own' })
const all = (code: Permission): RolePermission => ({ code, scope: 'all' })
const actor = (perms: RolePermission[], isOwner = false): Actor => ({
  id: 't1',
  roleId: 'r',
  gymId: 'g',
  isOwner,
  permissions: perms,
})

test('owner can everything', () => expect(checkPermission(actor([], true), 'roles.manage')).toBe(true))

test('no permission -> false', () => expect(checkPermission(actor([]), 'clients.view')).toBe(false))

test('scope all -> any client', () =>
  expect(
    checkPermission(actor([all('clients.view')]), 'clients.view', {
      clientId: 'c',
      clientTrainerId: 'other',
    }),
  ).toBe(true))

test('scope own -> only my clients', () => {
  const a = actor([own('clients.view')])
  expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: 't1' })).toBe(true)
  expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: 'other' })).toBe(false)
  expect(checkPermission(a, 'clients.view', { clientId: 'c', clientTrainerId: null })).toBe(false)
})

test('scope own without target -> true (list of own clients)', () =>
  expect(checkPermission(actor([own('clients.view')]), 'clients.view')).toBe(true))
