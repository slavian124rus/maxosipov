/** Фиксированный список прав — ARCHITECTURE.md §8.3. */
export const PERMISSIONS = [
  'clients.view',
  'clients.edit_programs',
  'clients.view_photos',
  'clients.view_ai_flags',
  'clients.notes',
  'clients.measurements',
  'subscriptions.grant',
  'subscriptions.pricing',
  'catalog.edit',
  'catalog.publish',
  'settings.ai',
  'settings.progression',
  'settings.brand',
  'users.assign_roles',
  'roles.manage',
  'analytics.view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Область действия права: свои клиенты или все. */
export type Scope = 'own' | 'all'

export type RolePermission = { code: Permission; scope: Scope }
