import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listSubscriptionsForActor, type SubscriptionFilter } from '@/modules/access'
import { formatContact, requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import { SubscriptionsList, type SubscriptionRowView } from './subscriptions-list'

// Список зависит от сессии и фильтров.
export const instant = false

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'trial', label: 'Пробные' },
  { value: 'ending', label: 'Заканчиваются (7 дней)' },
  { value: 'expired', label: 'Истекли' },
] as const

const EVENT_LABELS: Record<string, string> = {
  trial_started: 'пробный период',
  granted: 'подписка выдана',
  frozen: 'заморожена',
  unfrozen: 'разморожена',
  disabled: 'отключена',
  expired: 'истекла',
}

function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function statusLabel(status: string, hasAccess: boolean): string {
  if (status === 'trial') return hasAccess ? 'Пробный' : 'Пробный истёк'
  if (status === 'active') return hasAccess ? 'Подписка' : 'Подписка истекла'
  if (status === 'frozen') return 'Заморожена'
  if (status === 'disabled') return 'Отключена'
  if (status === 'expired') return 'Истекла'
  return 'Нет подписки'
}

export default async function TrainerSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q = '', filter = 'all' } = await searchParams
  const { actor } = await requireUser()
  if (!can(actor, 'subscriptions.grant')) notFound()
  const gym = await getGym()

  const activeFilter: SubscriptionFilter = FILTERS.some((item) => item.value === filter)
    ? (filter as SubscriptionFilter)
    : 'all'

  // Только клиенты, которых актор вправе видеть (ревью F3).
  const items = await listSubscriptionsForActor(actor, { query: q, filter: activeFilter })

  const view: SubscriptionRowView[] = items.map(({ userId, name, contact, access, events }) => ({
    id: userId,
    name,
    contact: formatContact(contact),
    statusLabel: statusLabel(access.status, access.hasAccess),
    endsAtLabel: access.endsAt ? formatDateRu(access.endsAt) : null,
    tone: !access.hasAccess ? 'danger' : (access.daysLeft ?? 99) <= 7 ? 'warning' : 'normal',
    isFrozen: access.status === 'frozen',
    history: events.map((event) => ({
      id: event.id,
      label: EVENT_LABELS[event.type] ?? event.type,
      date: formatDateRu(event.createdAt),
    })),
  }))

  return (
    <TrainerPage>
      <PageHeader
        title="Подписки"
        description="Продление, заморозка и история доступа"
        actions={
          <Link
            href="/trainer/settings/access"
            className="flex min-h-11 items-center rounded-control border border-border px-4 text-[15px] text-text hover:border-accent"
          >
            Настройки доступа
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form className="flex gap-2 lg:w-[420px]">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Имя или телефон"
            aria-label="Поиск по подпискам"
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
              href={`/trainer/subscriptions?filter=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
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

      <SubscriptionsList rows={view} defaultPrice={gym.settings.subscriptionPriceRub} />
    </TrainerPage>
  )
}
