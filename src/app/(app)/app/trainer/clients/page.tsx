import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listClients, type ClientFilter } from '@/modules/trainer'
import { formatLongDate } from '@/shared/dates'
import { PageHeader, TrainerPage } from '@/components/trainer/page'

// Список зависит от сессии, прав и фильтров.
export const instant = false

const TZ = 'Asia/Krasnoyarsk'

const FILTERS: { value: ClientFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'trial', label: 'Пробные' },
  { value: 'active', label: 'С подпиской' },
  { value: 'expiring', label: 'Заканчиваются' },
  { value: 'expired', label: 'Без доступа' },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'К'
}

function accessLabel(access: { hasAccess: boolean; status: string; daysLeft: number | null }): {
  text: string
  tone: string
} {
  if (!access.hasAccess) return { text: 'Нет доступа', tone: 'text-danger' }
  if (access.status === 'trial') {
    return { text: `Пробный · ${access.daysLeft ?? 0} дн.`, tone: 'text-text-secondary' }
  }
  if ((access.daysLeft ?? 99) <= 7) {
    return { text: `Заканчивается · ${access.daysLeft ?? 0} дн.`, tone: 'text-warning' }
  }
  return { text: 'Подписка', tone: 'text-success' }
}

export default async function TrainerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q = '', filter = 'all' } = await searchParams
  const { actor } = await requireUser()
  if (!can(actor, 'clients.view')) notFound()

  const activeFilter: ClientFilter = FILTERS.some((item) => item.value === filter)
    ? (filter as ClientFilter)
    : 'all'

  const clients = await listClients(actor, { query: q, filter: activeFilter })
  const now = new Date()

  return (
    <TrainerPage>
      <PageHeader
        title="Клиенты"
        description={`Клиентов: ${clients.length}`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form className="flex gap-2 lg:w-[420px]">
          <input type="hidden" name="filter" value={activeFilter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Имя или телефон"
            aria-label="Поиск клиента"
            className="h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-control bg-surface-2 px-4 text-[15px] text-text hover:bg-surface-2/70"
          >
            Найти
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Link
              key={item.value}
              href={`/trainer/clients?filter=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`flex min-h-9 items-center rounded-full border px-3 text-[13px] ${
                activeFilter === item.value
                  ? 'border-accent bg-surface-2 text-text'
                  : 'border-border bg-surface-1 text-text-secondary hover:text-text'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {clients.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Никого не нашёл</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border lg:border-border/80">
          {/* Шапка таблицы — только на ПК; на телефоне это карточки. */}
          <div className="hidden grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_170px] items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-2.5 text-[12px] tracking-wide text-text-muted uppercase lg:grid">
            <span className="w-10" />
            <span>Клиент</span>
            <span>Последняя тренировка</span>
            <span className="text-right">Доступ</span>
          </div>

          <div className="flex flex-col divide-y divide-border/60 bg-surface-1 lg:divide-border/40">
            {clients.map((client) => {
              const label = accessLabel(client.access)
              const lastWorkout = client.lastWorkoutAt
                ? formatLongDate(client.lastWorkoutAt, TZ, now)
                : 'тренировок ещё не было'

              return (
                <Link
                  key={client.id}
                  href={`/trainer/clients/${client.id}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 hover:bg-surface-2/50 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_170px] lg:px-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[14px] text-text-secondary">
                    {initials(client.name)}
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] text-text">{client.name}</span>
                    <span className="truncate text-[13px] text-text-muted lg:hidden">
                      {lastWorkout}
                    </span>
                    <span className="hidden truncate text-[13px] text-text-muted lg:block">
                      {client.contact}
                    </span>
                  </span>

                  <span className="hidden text-[13px] text-text-secondary lg:block">
                    {lastWorkout}
                  </span>

                  <span className={`text-right text-[13px] ${label.tone}`}>{label.text}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </TrainerPage>
  )
}
