import type { Permission, RolePermission } from './permissions'
import { ForbiddenError } from './errors'

/** Тот, кто совершает действие. Собирается из пользователя и его роли. */
export type Actor = {
  id: string
  roleId: string
  gymId: string
  isOwner: boolean
  permissions: RolePermission[]
}

/** Клиент, к которому применяется право: чей он и кто его ведёт. */
export type PermissionTarget = {
  clientTrainerId: string | null
  clientId: string
}

/**
 * Чистая проверка права. Область `own` без цели — это «список своих клиентов».
 */
export function checkPermission(
  actor: Actor,
  perm: Permission,
  target?: PermissionTarget,
): boolean {
  if (actor.isOwner) return true

  const granted = actor.permissions.filter((permission) => permission.code === perm)
  if (granted.length === 0) return false

  if (granted.some((permission) => permission.scope === 'all')) return true
  if (!target) return true

  return target.clientTrainerId === actor.id
}

/**
 * Область права у актора: `all`, `own` или `null` (права нет).
 * Нужна спискам: `all` — все клиенты зала, `own` — только свои.
 */
export function permissionScope(actor: Actor, perm: Permission): 'all' | 'own' | null {
  if (actor.isOwner) return 'all'
  const granted = actor.permissions.filter((permission) => permission.code === perm)
  if (granted.length === 0) return null
  return granted.some((permission) => permission.scope === 'all') ? 'all' : 'own'
}

/** Синоним `checkPermission` — так права читаются в коде экранов. */
export const can = checkPermission

/** Бросает `ForbiddenError`, если права нет. */
export function assertCan(actor: Actor, perm: Permission, target?: PermissionTarget): void {
  if (!checkPermission(actor, perm, target)) {
    throw new ForbiddenError()
  }
}
