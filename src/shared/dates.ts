/**
 * Даты без зависимостей от БД — безопасно для клиентских компонентов.
 * Все границы дней и недель считаются в часовом поясе зала (`getGym().timezone`).
 */

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'нояб',
  'дек',
]

const MONTHS_LONG = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const cache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = cache.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  cache.set(timeZone, formatter)
  return formatter
}

/** Части даты в часовом поясе зала. */
export function dateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Ключ дня `YYYY-MM-DD` в часовом поясе зала. */
export function dayKey(date: Date, timeZone: string): string {
  const { year, month, day } = dateParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Ключ понедельника недели, в которую попадает дата. */
export function mondayKey(date: Date, timeZone: string): string {
  const { year, month, day } = dateParts(date, timeZone)
  const utc = Date.UTC(year, month - 1, day)
  const weekday = new Date(utc).getUTCDay()
  const monday = new Date(utc - ((weekday + 6) % 7) * 24 * 60 * 60 * 1000)

  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(
    monday.getUTCDate(),
  ).padStart(2, '0')}`
}

/** «7 нояб» — подпись оси графика. */
export function formatShortDate(date: Date, timeZone: string): string {
  const { month, day } = dateParts(date, timeZone)
  return `${day} ${MONTHS_SHORT[month - 1]}`
}

/** «сегодня» / «вчера» / «7 ноября» (+ год, если он не текущий). */
export function formatLongDate(date: Date, timeZone: string, now: Date = new Date()): string {
  const target = dayKey(date, timeZone)
  const today = dayKey(now, timeZone)

  if (target === today) return 'сегодня'

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (target === dayKey(yesterday, timeZone)) return 'вчера'

  const parts = dateParts(date, timeZone)
  const text = `${parts.day} ${MONTHS_LONG[parts.month - 1]}`

  return parts.year === dateParts(now, timeZone).year ? text : `${text} ${parts.year}`
}

/** Длительность в минутах между двумя моментами (минимум 1). */
export function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
}
