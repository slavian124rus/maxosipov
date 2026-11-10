import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can, listRoles } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { saveRoleAction } from '../actions'

// Роли зависят от сессии и прав.
export const instant = false

export default async function RolesPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'roles.manage')) notFound()

  const roles = await listRoles()

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Роли и права</h1>

      <div className="flex flex-col gap-2">
        {roles.map((role) => (
          <div
            key={role.id}
            className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
          >
            <div className="flex flex-col">
              <span className="text-[15px] text-text">{role.name}</span>
              <span className="text-[13px] text-text-muted">Прав: {role.permissions.length}</span>
            </div>

            {role.isSystem ? (
              <span className="text-[13px] text-text-muted">🔒 системная</span>
            ) : (
              <Link href={`/trainer/settings/roles/${role.id}`} className="text-[15px] text-accent">
                Изменить
              </Link>
            )}
          </div>
        ))}
      </div>

      <ActionForm action={saveRoleAction} className="flex flex-wrap gap-2">
        <input
          name="name"
          placeholder="Название новой роли"
          aria-label="Название новой роли"
          className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text"
        />
        <button type="submit" className="h-12 rounded-control bg-surface-2 px-4 text-[15px] text-text">
          Создать
        </button>
      </ActionForm>

      <Link href="/trainer/settings/people" className="text-[15px] text-accent">
        Люди и роли
      </Link>
    </main>
  )
}