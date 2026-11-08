import { ForbiddenError } from '@/modules/rbac'
import { getAccessForUser } from './service'

export const NO_ACCESS_MESSAGE = 'Подписка закончилась. Продли у Максима — и продолжаем'

/**
 * Проверка доступа по подписке для серверных функций и роутов,
 * которые отдают платные данные (ARCHITECTURE.md §8.4).
 * Владелец и те, кто выдаёт подписки, проходят всегда.
 */
export async function assertClientAccess(userId: string): Promise<void> {
  const access = await getAccessForUser(userId)
  if (!access.hasAccess && !access.bypass) {
    throw new ForbiddenError(NO_ACCESS_MESSAGE)
  }
}
