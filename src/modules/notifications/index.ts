import { db } from '@/shared/db'
import { notifications, type NotificationKind } from './schema'

export { notifications } from './schema'
export type { Notification, NotificationKind } from './schema'

/**
 * Пишет событие в таблицу уведомлений. На этом этапе push не отправляется:
 * его добавит кабинет тренера (этап 5).
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(notifications).values({ userId, kind, payload })
}
