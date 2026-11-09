export { PERMISSIONS } from './permissions'
export type { Permission, RolePermission, Scope } from './permissions'

export { assertCan, can, checkPermission, permissionScope } from './check'
export type { Actor, PermissionTarget } from './check'

export { ForbiddenError } from './errors'

export { CLIENT_ROLE_NAME, DEFAULT_ROLES, OWNER_ROLE_NAME } from './defaults'

export { roleAudit, roles } from './schema'
export type { NewRole, Role, RoleAuditEntry } from './schema'

export { assignRole, createRole, deleteRole, loadActor, updateRole } from './service'
export type { RoleInput } from './service'

export { PERMISSION_GROUPS, PERMISSION_LABELS } from './labels'
export type { PermissionGroup } from './labels'

export { listAudit, listPeople, listRoles, setClientTrainer } from './people'
export type { AuditItem, PersonItem } from './people'

