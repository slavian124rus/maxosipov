import Link from 'next/link'
import { accessPreviewLabel, grantPreviewLabel, type AccessState } from '@/modules/access'
import type { ClientCard } from '@/modules/trainer'
import { GrantSubscription, type GrantOption } from '@/components/trainer/grant-subscription'
import {
  disableAction,
  freezeAction,
  unfreezeAction,
} from '@/app/(app)/app/trainer/subscriptions/actions'

const TZ = 'Asia/Krasnoyarsk'

/** Варианты продления с точной датой: считаем на сервере по поясу зала. */
function grantOptions(access: AccessState, months: readonly (1 | 3 | 6 | 12)[]): GrantOption[] {
  return months.map((value) => ({
    months: value,
    label: `+${value} мес`,
    untilLabel: grantPreviewLabel(access, value, TZ),
  }))
}

const GOAL: Record<string, string> = {
  strength: 'Сила',
  mass: 'Масса',
  fat_loss: 'Похудение',
  health: 'Здоровье',
}

const EXPERIENCE: Record<string, string> = {
  novice: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Опытный',
}

const SEX: Record<string, string> = { male: 'Мужской', female: 'Женский' }

function dateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Вкладка «Профиль»: анкета, ограничения и подписка с кнопками этапа 1. */
export function ProfileTab({ card }: { card: ClientCard }) {
  const profile = card.profile

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-4 py-3">
        <h2 className="text-[17px] font-semibold">Анкета</h2>

        {profile ? (
          <>
            <p className="text-[15px] text-text-secondary">
              {SEX[profile.sex] ?? profile.sex}, {profile.birthYear} г. р., {profile.heightCm} см,{' '}
              {profile.weightKg} кг
            </p>
            <p className="text-[15px] text-text-secondary">
              Цель: {GOAL[profile.goal] ?? profile.goal} · опыт: {EXPERIENCE[profile.experience] ?? profile.experience} ·
              тренировок в неделю: {profile.sessionsPerWeek}
            </p>
          </>
        ) : (
          <p className="text-[15px] text-text-secondary">Анкета не заполнена</p>
        )}

        {profile?.healthConsentAt && profile.limitations ? (
          <p className="text-[15px] text-warning">Ограничения: {profile.limitations}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-3">
        <h2 className="text-[17px] font-semibold">Подписка</h2>
        <p className="text-[15px] text-text-secondary">
          {card.access.hasAccess
            ? `Доступ до ${card.access.endsAt ? dateRu(card.access.endsAt) : '—'}`
            : 'Доступа нет'}
          {card.access.status === 'frozen' ? ' · заморожена' : ''}
        </p>

        {card.permissions.grantSubscription ? (
          <div className="flex flex-col gap-3">
            <GrantSubscription
              clientId={card.id}
              clientName={card.name}
              currentLabel={accessPreviewLabel(card.access, TZ)}
              options={grantOptions(card.access, [1, 3])}
            />

            <div className="flex flex-wrap gap-2">
              {card.access.status === 'frozen' ? (
                <form action={unfreezeAction}>
                  <input type="hidden" name="userId" value={card.id} />
                  <button
                    type="submit"
                    className="h-11 rounded-control bg-surface-2 px-3 text-[15px] text-text"
                  >
                    Разморозить
                  </button>
                </form>
              ) : (
                <form action={freezeAction}>
                  <input type="hidden" name="userId" value={card.id} />
                  <button
                    type="submit"
                    className="h-11 rounded-control bg-surface-2 px-3 text-[15px] text-text"
                  >
                    Заморозить
                  </button>
                </form>
              )}

              <form action={disableAction}>
                <input type="hidden" name="userId" value={card.id} />
                <button
                  type="submit"
                  className="h-11 rounded-control border border-border px-3 text-[15px] text-danger"
                >
                  Отключить
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <Link href="/trainer/subscriptions" className="text-[13px] text-accent">
          Все подписки и история
        </Link>
      </section>
    </div>
  )
}