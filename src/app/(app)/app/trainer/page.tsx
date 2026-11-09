import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { getTrainerFeed } from '@/modules/trainer'
import { formatLongDate } from '@/shared/dates'
import { FeedSection } from '@/components/trainer/feed-section'
import { markProposalSeenAction, resolveFlagAction } from './actions'

// Лента зависит от сессии и данных клиентов.
export const instant = false

const TZ = 'Asia/Krasnoyarsk'

export default async function TrainerTodayPage() {
  const { actor } = await requireUser()
  const feed = await getTrainerFeed(actor)
  const now = new Date()

  const empty =
    feed.painFlags.length === 0 &&
    feed.trainingNow.length === 0 &&
    feed.acceptedAiChanges.length === 0 &&
    feed.expiringSoon.length === 0 &&
    feed.newClients.length === 0

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[13px] text-text-muted">Сегодня</p>
        <h1 className="text-[22px] font-semibold">{formatLongDate(now, TZ, now)}</h1>
      </header>

      {empty ? <p className="text-[15px] text-text-secondary">Всё спокойно. Клиенты тренируются по плану</p> : null}

      {feed.painFlags.length > 0 ? (
        <FeedSection title="Жалобы на боль" count={feed.painFlags.length} tone="danger">
          {feed.painFlags.map((flag) => (
            <div key={flag.id} className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0">
              <p className="text-[15px] text-text">
                <span className="font-semibold">{flag.clientName}</span>
                {flag.flagged === 'injury' ? ' · травма' : ' · боль'}
              </p>
              <p className="text-[13px] text-text-secondary">{flag.text}</p>
              <div className="flex gap-2">
                <Link
                  href={`/trainer/clients/${flag.clientId}?tab=coach`}
                  className="flex h-10 flex-1 items-center justify-center rounded-control border border-border text-[15px] text-text"
                >
                  Открыть
                </Link>
                <form action={resolveFlagAction} className="flex-1">
                  <input type="hidden" name="id" value={flag.id} />
                  <button
                    type="submit"
                    className="h-10 w-full rounded-control bg-surface-2 text-[15px] text-text"
                  >
                    Разобрался
                  </button>
                </form>
              </div>
            </div>
          ))}
        </FeedSection>
      ) : null}

      {feed.trainingNow.length > 0 ? (
        <FeedSection title="Тренируются сейчас" count={feed.trainingNow.length}>
          {feed.trainingNow.map((client) => (
            <Link
              key={client.id}
              href={`/trainer/clients/${client.id}`}
              className="text-[15px] text-text"
            >
              {client.name}
            </Link>
          ))}
        </FeedSection>
      ) : null}

      {feed.acceptedAiChanges.length > 0 ? (
        <FeedSection title="Приняли изменения МаксИИма" count={feed.acceptedAiChanges.length}>
          {feed.acceptedAiChanges.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0">
              <Link href={`/trainer/clients/${item.clientId}?tab=program`} className="text-[15px] text-text">
                {item.clientName}
              </Link>
              {item.line ? <p className="text-[13px] text-text-secondary">{item.line}</p> : null}
              <form action={markProposalSeenAction}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="h-9 rounded-control bg-surface-2 px-3 text-[13px] text-text">
                  Понятно
                </button>
              </form>
            </div>
          ))}
        </FeedSection>
      ) : null}

      {feed.expiringSoon.length > 0 ? (
        <FeedSection title="Заканчивается доступ (7 дней)" count={feed.expiringSoon.length}>
          {feed.expiringSoon.map((item) => (
            <div key={item.clientId} className="flex items-center justify-between gap-2">
              <Link href={`/trainer/clients/${item.clientId}`} className="text-[15px] text-text">
                {item.name}
              </Link>
              <span className="text-[13px] text-warning">
                {item.daysLeft === 0 ? 'сегодня' : `${item.daysLeft} дн.`}
              </span>
            </div>
          ))}
        </FeedSection>
      ) : null}

      {feed.newClients.length > 0 ? (
        <FeedSection title="Новые клиенты" count={feed.newClients.length}>
          {feed.newClients.map((client) => (
            <Link key={client.id} href={`/trainer/clients/${client.id}`} className="text-[15px] text-text">
              {client.name}
            </Link>
          ))}
        </FeedSection>
      ) : null}
    </main>
  )
}