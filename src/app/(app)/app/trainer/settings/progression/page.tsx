import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { saveProgressionAction } from '../actions'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function ProgressionSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'settings.progression')) notFound()

  const gym = await getGym()
  const rules = gym.settings.progressionRules

  return (
    <SettingsPage title="Правила прогрессии">
      <ActionForm action={saveProgressionAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[15px] text-text">
          Тренировок подряд для повышения веса
          <span className="text-[13px] text-text-muted">
            Сколько тренировок подряд нужно сделать все подходы, чтобы алгоритм предложил больше.
          </span>
          <input
            name="sessionsToIncrease"
            type="number"
            min={1}
            max={5}
            defaultValue={rules.sessionsToIncrease}
            className="h-12 w-24 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <label className="flex items-center gap-2 text-[15px] text-text">
          <input
            type="checkbox"
            name="fastTrackOnEasy"
            defaultChecked={rules.fastTrackOnEasy}
            className="h-5 w-5"
          />
          Повышать сразу, если все подходы «Легко»
        </label>

        <label className="flex flex-col gap-1 text-[15px] text-text">
          Тренировок с недобором для снижения веса
          <span className="text-[13px] text-text-muted">
            После стольких неудачных тренировок подряд алгоритм предложит вес ниже.
          </span>
          <input
            name="failSessionsToDrop"
            type="number"
            min={1}
            max={5}
            defaultValue={rules.failSessionsToDrop}
            className="h-12 w-24 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-[15px] text-text">
          На сколько процентов снижать
          <input
            name="dropPercent"
            type="number"
            min={5}
            max={30}
            defaultValue={rules.dropPercent}
            className="h-12 w-24 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
          Сохранить
        </button>
      </ActionForm>
    </SettingsPage>
  )
}