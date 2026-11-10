import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import { formatContact } from '@/modules/auth'
import { getClientCard } from '@/modules/trainer'
import { isNotFoundError } from '@/shared/errors'
import { dayKey } from '@/shared/dates'
import type { CatalogItem } from '@/components/trainer/program-editor/program-editor'
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
          primary: item.primaryMuscles,
        }))
      : []

  const today = dayKey(new Date(), 'Asia/Krasnoyarsk')

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">{card.name}</h1>
        <p className="text-[15px] text-text-secondary">{formatContact(card.contact)}</p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/trainer/clients/${card.id}?tab=${item.id}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
              activeTab === item.id
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border text-text-secondary'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'profile' ? <ProfileTab card={card} /> : null}
      {activeTab === 'program' ? <ProgramTab card={card} catalog={catalog} /> : null}
      {activeTab === 'history' ? <HistoryTab card={card} /> : null}
      {activeTab === 'progress' ? <ProgressTab card={card} today={today} /> : null}
      {activeTab === 'notes' ? <NotesTab card={card} /> : null}
      {activeTab === 'coach' ? <CoachTab card={card} /> : null}
    </main>
  )
}