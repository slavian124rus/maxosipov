/**
 * Состояние формы продления подписки. Живёт отдельно от `'use server'`-файла:
 * такие файлы могут экспортировать только асинхронные функции, а константу
 * нужно импортировать и в клиентский компонент.
 */
export type GrantState = {
  error: string | null
  /** Готовая подпись результата: «Выдано до 5 января 2027». */
  untilLabel: string | null
  /** На сколько продлили — для текста «Подписка продлена на 3 месяца». */
  months: number | null
}

export const INITIAL_GRANT_STATE: GrantState = { error: null, untilLabel: null, months: null }
