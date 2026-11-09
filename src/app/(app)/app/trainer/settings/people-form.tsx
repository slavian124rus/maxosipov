'use client'

import { useActionState } from 'react'
import { assignRoleFormAction, type AssignState } from './actions'

const INITIAL: AssignState = { error: null }

type Role = { id: string; name: string }

/** Смена роли человеку с показом ошибки (например, последний владелец). */
export function RoleForm({
  userId,
  roleId,
  roles,
  label,
}: {
  userId: string
  roleId: string
  roles: Role[]
  label: string
}) {
  const [state, formAction, pending] = useActionState(assignRoleFormAction, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="userId" value={userId} />
        <select
          name="roleId"
          defaultValue={roleId}
          aria-label={label}
          className="h-11 flex-1 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-control bg-surface-2 px-3 text-[13px] text-text"
        >
          Сохранить роль
        </button>
      </div>

      {state.error ? <p className="text-[13px] text-danger">{state.error}</p> : null}
    </form>
  )
}