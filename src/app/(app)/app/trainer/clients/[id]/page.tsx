import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import { formatContact } from '@/modules/auth'
import { getClientCard } from '@/modules/trainer'
import { isNotFoundError } from '@/shared/errors'
import { dayKey } from '@/shared/dates'
import type { CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { PageHeader, Panel, TrainerPage } from '@/components/trainer/page'
import { ClientNameEditor } from '@/components/trainer/client-name-editor'
import { ProfileTab } from '@/components/trainer/client-tabs/profile-tab'
import { ProgramTab } from '@/components/trainer/client-tabs/program-tab'
import { HistoryTab } from '@/components/trainer/client-tabs/history-tab'
import { ProgressTab } from '@/components/trainer/client-tabs/progress-tab'
import { NotesTab } from '@/components/trainer/client-tabs/notes-tab'
import { CoachTab } from '@/components/trainer/client-tabs/coach-tab'

// Карточка клиента зависит от сессии и прав.
export const instant = false

const TABS = [
  { id: 'profile', label: 'Профиль' },
  { id: 'program', label: 'Программа' },
  { id: 'history', label: 'История' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'notes', label: 'Заметки' },
  { id: 'coach', label: 'МаксИИм' },
] as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'К'
}

function dateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default async function ClientCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { actor } = await requireUser()
  const { id } = await params
  const { tab = 'profile' } = await searchParams

  let card
  try {
    card = await getClientCard(actor, id)
  } catch (error) {
    if (isNotFoundError(error)) notFound()
    throw error
  }

  const activeTab = TABS.some((item) => item.id === tab) ? tab : 'profile'
  const catalog: CatalogItem[] =
    activeTab === 'program'
      ? (await listExercises({ status: 'published' })).map((item) => ({
          id: item.id,
          name: item.name,
          machineName: item.machineName,
          zone: item.machineZone,
          primary: item.primaryMuscles,
        }))
      : []

  const today = dayKey(new Date(), 'Asia/Krasnoyarsk')

  const accessText = card.access.hasAccess
    ? card.access.endsAt
      ? `до ${dateRu(card.access.endsAt)}`
      : 'активен'
    : 'нет доступа'

  return (
    <TrainerPage>
      <PageHeader
        back={{ href: '/trainer/clients', label: 'Клиенты' }}
        title={card.name}
        description={formatContact(card.contact)}
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
          <Panel>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[16px] text-text-secondary">
                {initials(card.name)}
              </span>
              <div className="flex min-w-0 flex-col">
                {card.permissions.editName ? (
                  <ClientNameEditor clientId={card.id} name={card.name} />
                ) : (
                  <span className="truncate text-[15px] text-text">{card.name || 'Без имени'}</span>
                )}
                <span className="truncate text-[13px] text-text-muted">
                  {formatContact(card.contact)}
                </span>
              </div>
            </div>

            <dl className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-muted">Доступ</dt>
                <dd
                  className={
                    card.access.hasAccess
                      ? (card.access.daysLeft ?? 99) <= 7
                        ? 'text-warning'
                        : 'text-success'
                      : 'text-danger'
                  }
                >
                  {accessText}
                </dd>
              </div>
              {card.access.status === 'frozen' ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Статус</dt>
                  <dd className="text-text-secondary">заморожена</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-muted">С нами с</dt>
                <dd className="text-text-secondary">{dateRu(card.createdAt)}</dd>
              </div>
            </dl>

            <Link
              href="/trainer/subscriptions"
              className="text-[13px] text-accent underline-offset-4 hover:underline"
            >
              Все подписки и история
            </Link>
          </Panel>

          {/* Вкладки: на телефоне — чипы в строку, на ПК — вертикальное меню. */}
          <nav
            aria-label="Разделы карточки"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:rounded-card lg:border lg:border-border lg:bg-surface-1 lg:p-1.5"
          >
            {TABS.map((item) => {
              const active = activeTab === item.id

              return (
                <Link
                  key={item.id}
                  href={`/trainer/clients/${card.id}?tab=${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[13px] lg:rounded-control lg:border-0 lg:px-3 lg:py-2.5 lg:text-[15px] ${
                    active
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border text-text-secondary hover:text-text lg:hover:bg-surface-2/60'
                  }`}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute top-2 bottom-2 left-0 hidden w-[3px] rounded-full bg-accent lg:block"
                    />
                  ) : null}
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          {activeTab === 'profile' ? <ProfileTab card={card} /> : null}
          {activeTab === 'program' ? <ProgramTab card={card} catalog={catalog} /> : null}
          {activeTab === 'history' ? <HistoryTab card={card} /> : null}
          {activeTab === 'progress' ? <ProgressTab card={card} today={today} /> : null}
          {activeTab === 'notes' ? <NotesTab card={card} /> : null}
          {activeTab === 'coach' ? <CoachTab card={card} /> : null}
        </div>
      </div>
    </TrainerPage>
  )
}