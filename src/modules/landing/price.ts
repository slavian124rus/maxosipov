import { getGym } from '@/modules/gym'

/**
 * Цена подписки из настроек зала (`gyms.settings.subscriptionPriceRub`).
 *
 * `null` — цена не задана в админке: тогда лендинг показывает «дальше — цену скажет
 * Максим» (план, Review Focus 3). Ошибку чтения тоже считаем «цены нет»: страница
 * статическая и собирается в Docker без базы (`docker/Dockerfile`), а настоящая цена
 * подтягивается на первой же часовой ревалидации.
 */
export async function getSubscriptionPrice(): Promise<number | null> {
  try {
    const gym = await getGym()
    const price = gym.settings.subscriptionPriceRub

    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null
  } catch (error) {
    console.error('[landing] цену подписки не прочитали, показываем «цену скажет Максим»', error)
    return null
  }
}
