type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(tz)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatterCache.set(tz, formatter)
  return formatter
}

function localParts(date: Date, tz: string): LocalParts {
  const parts = formatterFor(tz).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/** Смещение зоны (в мс) в конкретный момент: местное время минус UTC. */
function zoneOffsetMs(date: Date, tz: string): number {
  const parts = localParts(date, tz)
  const asUtc = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Местное время в зоне `tz` → UTC. Двухшаговая поправка покрывает переходы на летнее время. */
function zonedToUtc(parts: LocalParts, tz: string): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  let timestamp = naive - zoneOffsetMs(new Date(naive), tz)
  timestamp = naive - zoneOffsetMs(new Date(timestamp), tz)
  return new Date(timestamp)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Прибавляет календарные месяцы в часовом поясе зала: 31 января + 1 месяц =
 * последний день февраля (28 или 29). Время суток сохраняется.
 */
export function addMonthsClamped(date: Date, months: number, tz: string): Date {
  const parts = localParts(date, tz)

  const totalMonths = parts.month + months
  const yearShift = Math.floor(totalMonths / 12)
  const year = parts.year + yearShift
  const month = ((totalMonths % 12) + 12) % 12
  const day = Math.min(parts.day, daysInMonth(year, month))

  return zonedToUtc({ ...parts, year, month, day }, tz)
}

/** Прибавляет дни (ровно 24 часа × N) — для пробного периода. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
