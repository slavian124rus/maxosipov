import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { isPushConfigured, sendPush } from './push'
import {
  notifications,
  pushSubscriptions,
  type NotificationData,
  type NotificationKind,
} from './schema'
import { renderNotification } from './templates'

export type PushSubscriptionJSON = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

/**
 * Пишет событие в таблицу и, если вид это предполагает, отправляет push на все
 * устройства пользователя. `dedupeKey` делает плановые уведомления идемпотентными:
 * повторный запуск задачи с тем же ключом не создаёт вторую строку и не шлёт push.
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  data: NotificationData = {},
  dedupeKey?: string,
): Promise<void> {
  const [created] = await db
    .insert(notifications)
    .values({ userId, kind, payload: data, dedupeKey: dedupeKey ?? null })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id })

  if (!created) return

  const rendered = renderNotification(kind, data)
  if (!rendered.push || !isPushConfigured()) return

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  let delivered = false

  for (const subscription of subscriptions) {
    const result = await sendPush(
      { id: subscription.id, endpoint: subscription.endpoint, keys: subscription.keys },
      { title: rendered.title, body: rendered.body, url: rendered.url },
    )

    if (result === 'gone') {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id))
    }
    if (result === 'sent') delivered = true
  }

  if (delivered) {
    await db
      .update(notifications)
      .set({ pushedAt: new Date(), updatedAt: new Date() })
      .where(eq(notifications.id, created.id))
  }
}

/** Сохраняет подписку устройства; повторная подписка того же endpoint обновляет ключи. */
export async function subscribePush(
  userId: string,
  subscription: PushSubscriptionJSON,
  userAgent: string | null,
): Promise<void> {
  const endpoint = subscription.endpoint
  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth

  if (!endpoint || !p256dh || !auth) throw new Error('Некорректная подписка')

  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, keys: { p256dh, auth }, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, keys: { p256dh, auth }, userAgent, updatedAt: new Date() },
    })
}

/** Отписывает устройство (человек выключил уведомления). */
export async function unsubscribePush(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
}