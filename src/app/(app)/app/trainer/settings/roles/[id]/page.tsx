import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can, listRoles, PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { saveRoleAction } from '../../actions'

// Редактор роли зависит от сессии и прав.
export const instant = false

export default async function RoleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireUser()
  if (!can(actor, 'roles.manage')) notFound()

  const { id } = await params
  const roles = await listRoles()
  const role = roles.find((item) => item.id === id)
  if (!role) notFound()

  const scopeOf = (code: string): string => {
    const granted = role.permissions.find((permission) => permission.code === code)
    return granted?.scope ?? ''
  }

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">{role.name}</h1>

      {role.isSystem ? (
        <p className="text-[15px] text-text-secondary">
          Системную роль «Владелец» изменить нельзя: у неё всегда все права.
        </p>
      ) : (
        <ActionForm action={saveRoleAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={role.id} />

          <label className="flex flex-col gap-1 text-[15px] text-text">
            Название
            <input
              name="name"
              defaultValue={role.name}
              className="h-12 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
            />
          </label>

          {PERMISSION_GROUPS.map((group) => {
            const codes = PERMISSIONS.filter((code) => PERMISSION_LABELS[code].group === group)

            return (
              <section key={group} className="flex flex-col gap-2">
                <h2 className="text-[17px] font-semibold">{group}</h2>

                {codes.map((code) => (
                  <label key={code} className="flex items-center justify-between gap-2 text-[15px] text-text">
                    <span>{PERMISSION_LABELS[code].label}</span>
                    <select
                      name={`perm_${code}`}
                      defaultValue={scopeOf(code)}
                      className="h-11 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
                    >
                      <option value="">Нет</option>
                      <option value="all">Все</option>
                      {code.startsWith('clients.') ? <option value="own">Свои клиенты</option> : null}
                    </select>
                  </label>
                ))}
              </section>
            )
          })}

          <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
            Сохранить роль
          </button>
        </ActionForm>
      )}
    </main>
  )
}