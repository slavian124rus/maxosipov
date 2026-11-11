import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can, listPeople, listRoles } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { setTrainerAction } from '../actions'
import { RoleForm } from '../people-form'

// «Люди» зависит от сессии и прав.
export const instant = false

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const { actor } = await requireUser()
  if (!can(actor, 'users.assign_roles')) notFound()

  const [people, roles] = await Promise.all([listPeople(actor, q), listRoles()])
  const trainers = people.filter((person) => person.roleName !== 'Клиент')

  return (
    <SettingsPage title="Люди">
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Имя или телефон"
          aria-label="Поиск человека"
          className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text"
        />
        <button type="submit" className="h-12 rounded-control bg-surface-2 px-4 text-[15px] text-text">
          Найти
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {people.map((person) => (
          <div key={person.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3">
            <div className="flex flex-col">
              <span className="text-[15px] text-text">{person.name || 'Без имени'}</span>
              <span className="text-[13px] text-text-muted">{person.contact}</span>
            </div>

            <RoleForm
              userId={person.id}
              roleId={person.roleId}
              roles={roles.map((role) => ({ id: role.id, name: role.name }))}
              label={`Роль: ${person.name}`}
            />

            {person.roleName === 'Клиент' ? (
              <ActionForm action={setTrainerAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="clientId" value={person.id} />
                <select
                  name="trainerId"
                  defaultValue={person.trainerId ?? ''}
                  aria-label={`Тренер: ${person.name}`}
                  className="h-11 flex-1 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
                >
                  <option value="">Без тренера</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name || trainer.contact}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-11 rounded-control bg-surface-2 px-3 text-[13px] text-text">
                  Тренер
                </button>
              </ActionForm>
            ) : null}
          </div>
        ))}
      </div>
    </SettingsPage>
  )
}