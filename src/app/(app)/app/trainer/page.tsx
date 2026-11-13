import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { getTrainerFeed } from '@/modules/trainer'
import { formatLongDate } from '@/shared/dates'
import { FeedSection } from '@/components/trainer/feed-section'
import { PageHeader, Panel, TrainerPage } from '@/components/trainer/page'
import { PushOptIn } from '@/components/app/push-opt-in'
import { env } from '@/shared/env'
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

  // Быстрые действия — то, что Максим делает с телефона и с ПК чаще всего.
  const quickActions = [
    can(actor, 'clients.view') ? { href: '/trainer/clients', label: 'Найти клиента' } : null,
    can(actor, 'catalog.edit')
      ? { href: '/trainer/exercises/new', label: 'Добавить упражнение' }
      : null,
    can(actor, 'catalog.edit') ? { href: '/trainer/machines', label: 'Тренажёры и фото' } : null,
    can(actor, 'subscriptions.grant')
      ? { href: '/trainer/subscriptions', label: 'Продлить подписку' }
      : null,
  ].filter((item): item is { href: string; label: string } => item !== null)

  return (
    <TrainerPage>
      <PageHeader
        eyebrow="Сегодня"
        title={formatLongDate(now, TZ, now)}
        description="Что требует внимания прямо сейчас"
      />

      {empty ? (
        <p className="text-[15px] text-text-secondary">
          Всё спокойно. Клиенты тренируются по плану
        </p>
      ) : null}

      {feed.painFlags.length > 0 ? (
        <FeedSection title="Жалобы на боль" count={feed.painFlags.length} tone="danger">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {feed.painFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0 lg:rounded-control lg:border lg:border-danger/30 lg:p-3 lg:first:border"
              >
                <p className="text-[15px] text-text">
                  <span className="font-semibold">{flag.clientName}</span>
                  {flag.flagged === 'injury' ? ' · травма' : ' · боль'}
                </p>
                <p className="text-[13px] text-text-secondary">{flag.text}</p>
                <div className="flex gap-2">
                  <Link
                    href={`/trainer/clients/${flag.clientId}?tab=coach`}
                    className="flex h-10 flex-1 items-center justify-center rounded-control border border-border text-[15px] text-text hover:border-accent"
                  >
                    Открыть
                  </Link>
                  <form action={resolveFlagAction} className="flex flex-1 flex-col gap-2">
                    <input type="hidden" name="id" value={flag.id} />
                    <input
                      type="text"
                      name="note"
                      maxLength={300}
                      placeholder="Что сказать МаксИИму (необязательно)"
                      className="h-10 rounded-control border border-border bg-surface-1 px-3 text-[14px] text-text placeholder:text-text-muted"
                    />
                    <button
                      type="submit"
                      className="h-10 w-full rounded-control bg-surface-2 text-[15px] text-text hover:bg-surface-2/70"
                    >
                      Разобрался
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </FeedSection>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {feed.trainingNow.length > 0 ? (
          <FeedSection title="Тренируются сейчас" count={feed.trainingNow.length}>
            <div className="flex flex-col gap-1.5">
              {feed.trainingNow.map((client) => (
                <Link
                  key={client.id}
                  href={`/trainer/clients/${client.id}`}
                  className="text-[15px] text-text hover:text-accent"
                >
                  {client.name}
                </Link>
              ))}
            </div>
          </FeedSection>
        ) : null}

        {feed.acceptedAiChanges.length > 0 ? (
          <FeedSection title="Приняли изменения МаксИИма" count={feed.acceptedAiChanges.length}>
            <div className="flex flex-col gap-2">
              {feed.acceptedAiChanges.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0"
                >
                  <Link
                    href={`/trainer/clients/${item.clientId}?tab=program`}
                    className="text-[15px] text-text hover:text-accent"
                  >
                    {item.clientName}
                  </Link>
                  {item.line ? (
                    <p className="text-[13px] text-text-secondary">{item.line}</p>
                  ) : null}
                  <form action={markProposalSeenAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-control bg-surface-2 px-3 text-[13px] text-text hover:bg-surface-2/70"
                    >
                      Понятно
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </FeedSection>
        ) : null}

        {feed.expiringSoon.length > 0 ? (
          <FeedSection title="Заканчивается доступ (7 дней)" count={feed.expiringSoon.length}>
            <div className="flex flex-col gap-1.5">
              {feed.expiringSoon.map((item) => (
                <div key={item.clientId} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/trainer/clients/${item.clientId}`}
                    className="text-[15px] text-text hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  <span className="tabular-nums text-[13px] text-warning">
                    {item.daysLeft === 0 ? 'сегодня' : `${item.daysLeft} дн.`}
                  </span>
                </div>
              ))}
            </div>
          </FeedSection>
        ) : null}

        {feed.newClients.length > 0 ? (
          <FeedSection title="Новые клиенты" count={feed.newClients.length}>
            <div className="flex flex-col gap-1.5">
              {feed.newClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/trainer/clients/${client.id}`}
                  className="text-[15px] text-text hover:text-accent"
                >
                  {client.name}
                </Link>
              ))}
            </div>
          </FeedSection>
        ) : null}

        {quickActions.length > 0 ? (
          <Panel title="Быстрые действия">
            <div className="flex flex-col gap-1">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-11 items-center rounded-control px-2 text-[15px] text-text-secondary hover:bg-surface-2 hover:text-text"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>

      {/* Без этой кнопки Максим не получит push о жалобах: разрешение — только по нажатию. */}
      <div className="lg:max-w-[560px]">
        <PushOptIn vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null} />
      </div>
    </TrainerPage>
  )
}

