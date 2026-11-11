import { Phone } from 'lucide-react'
import { notFound } from 'next/navigation'
import { formatPhone, requireUser } from '@/modules/auth'
import { listLeads } from '@/modules/landing'
import { can } from '@/modules/rbac'
import { formatLongDate } from '@/shared/dates'
import { getGym } from '@/modules/gym'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import { markLeadContactedAction } from './actions'

// Список заявок зависит от сессии и прав.
export const instant = false

const timeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' })

/** Заявки с лендинга: имя, телефон текстом и кнопкой звонка, время, отметка «Связался». */
export default async function TrainerLeadsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'clients.view')) notFound()

  const leads = await listLeads(actor)
  const gym = await getGym()
  const timeZone = gym.timezone
  const time = timeFormatter(timeZone)
  const now = new Date()

  return (
    <TrainerPage>
      <PageHeader eyebrow="С сайта" title="Заявки" description="Кто оставил номер на лендинге" />

      {leads.length === 0 ? (
        <p className="text-[15px] text-text-secondary">
          Пока никто не оставил номер. Заявки появляются здесь и приходят уведомлением
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {leads.map((lead) => {
          const tel = lead.phone.replace(/[^\d+]/g, '')
          const when = `${formatLongDate(lead.createdAt, timeZone, now)}, ${time.format(lead.createdAt)}`

          return (
            <li
              key={lead.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-[17px] font-semibold text-text">{lead.name}</p>
                  <p className="text-[13px] text-text-secondary">{when}</p>
                </div>

                {lead.contactedAt ? (
                  <span className="shrink-0 text-[13px] text-success">Связался</span>
                ) : (
                  <span className="shrink-0 text-[13px] text-warning">Новая</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <a href={`tel:${tel}`} className="text-[17px] text-text tabular-nums">
                  {formatPhone(lead.phone)}
                </a>
                <a
                  href={`tel:${tel}`}
                  aria-label={`Позвонить: ${lead.name}`}
                  className="grid size-11 shrink-0 place-items-center rounded-control bg-accent text-white transition-colors hover:bg-accent-pressed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Phone size={20} strokeWidth={1.75} aria-hidden="true" />
                </a>
              </div>

              {lead.contactedAt ? null : (
                <form action={markLeadContactedAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button
                    type="submit"
                    className="h-11 w-full rounded-control bg-surface-2 text-[15px] text-text"
                  >
                    Связался
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </TrainerPage>
  )
}
