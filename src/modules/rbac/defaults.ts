import type { Permission, RolePermission } from './permissions'
import { PERMISSIONS } from './permissions'

const all = (code: Permission): RolePermission => ({ code, scope: 'all' })
const own = (code: Permission): RolePermission => ({ code, scope: 'own' })

const CLIENT_PERMISSIONS: Permission[] = [
  'clients.view',
  'clients.edit_programs',
  'clients.view_photos',
  'clients.view_ai_flags',
  'clients.notes',
  'clients.measurements',
]

/** Пять ролей из ARCHITECTURE.md §8.3. Сид создаёт их идемпотентно. */
export const DEFAULT_ROLES: {
  name: string
  isSystem: boolean
  isClient: boolean
  permissions: RolePermission[]
}[] = [
  {
    name: 'Владелец',
    isSystem: true,
    isClient: false,
    permissions: PERMISSIONS.map(all),
  },
  {
    name: 'Главный тренер',
    isSystem: false,
    isClient: false,
    permissions: PERMISSIONS.filter(
      (code) => code !== 'roles.manage' && code !== 'users.assign_roles',
    ).map(all),
  },
  {
    name: 'Тренер',
    isSystem: false,
    isClient: false,
    permissions: [...CLIENT_PERMISSIONS.map(own), all('catalog.edit')],
  },
  {
    name: 'Администратор зала',
    isSystem: false,
    isClient: false,
    permissions: [all('clients.view'), all('subscriptions.grant')],
  },
  {
    name: 'Клиент',
    isSystem: false,
    isClient: true,
    permissions: [],
  },
]

export const OWNER_ROLE_NAME = 'Владелец'
export const CLIENT_ROLE_NAME = 'Клиент'
