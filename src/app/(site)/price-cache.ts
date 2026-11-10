import { cacheLife } from 'next/cache'
import { getSubscriptionPrice } from '@/modules/landing'

/**
 * Год для строки «© …» в подвале. Чтение часов блокирует prerender при
 * `cacheComponents` («blocking-prerender-current-time»), поэтому год тоже кэшируем:
 * обновится вместе с часовой ревалидацией страницы.
 */
export async function landingYear(): Promise<number> {
  'use cache'
  cacheLife('hours')

  return new Date().getFullYear()
}

/**
 * Цена подписки для лендинга: читается при сборке и обновляется раз в час
 * (план, «Архитектура»: `revalidate = 3600`). Без базы — например, во время
 * `docker build` — цена считается неизвестной, страница всё равно собирается.
 */
export async function landingPrice(): Promise<number | null> {
  'use cache'
  cacheLife('hours')

  return getSubscriptionPrice()
}
