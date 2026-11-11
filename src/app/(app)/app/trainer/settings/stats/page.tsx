import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getAiSpend } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { dayKey } from '@/shared/dates'
import { getStats } from '@/modules/trainer'

// Статистика зависит от сессии и прав.
export const instant = false

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`
}

export default async function StatsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'analytics.view')) notFound()

  const now = new Date()
  const month = dayKey(now, 'Asia/Krasnoyarsk').slice(0, 7)

  const [stats, spend] = await Promise.all([
    getStats(actor, now),
    can(actor, 'settings.ai') ? getAiSpend(actor, month) : Promise.resolve(null),
  ])

  const cards = [
    { label: 'Активных клиентов', value: String(stats.activeClients) },
    { label: 'На пробном', value: String(stats.trials) },
    { label: 'Пробный → подписка', value: percent(stats.trialToPaidRate) },
    { label: 'Тренировок за 7 дней', value: String(stats.workoutsLast7d) },
    { label: 'Вопросов МаксИИму за 7 дней', value: String(stats.aiMessagesLast7d) },
  ]

  return (
    <SettingsPage title="Статистика">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-3">
            <p className="font-display text-[28px] leading-none text-text">{card.value}</p>
            <p className="text-[13px] text-text-muted">{card.label}</p>
          </div>
        ))}
      </div>

      {spend ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">Расход на МаксИИма за месяц</h2>
          <p className="font-display text-[24px] text-text">{spend.totalRub} ₽</p>

          {spend.byModel.map((row) => (
            <div key={row.model} className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-1 px-3 py-2">
              <span className="text-[13px] text-text">{row.model}</span>
              <span className="text-[13px] text-text-muted">
                {row.tokensIn} / {row.tokensOut} токенов · {row.costRub} ₽
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </SettingsPage>
  )
}