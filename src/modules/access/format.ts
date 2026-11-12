import { addMonthsClamped } from './dates'
import type { AccessState } from './compute'

/**
 * «5 января 2027» по часовому поясу зала — для подписок в кабинете (DESIGN.md §9.2).
 * Формат один на предпросмотр продления и на сообщение «Выдано до …».
 */
export function formatDayRu(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/\s*г\.$/, '')
}

/**
 * До какой даты дойдёт доступ, если продлить на `months` месяцев — подпись для подтверждения.
 * Совпадает с логикой `grant` в сервисе: продлеваем от конца подписки, а если доступа нет — от сегодня.
 * Замороженную подписку считаем от разморозки, поэтому точную дату не обещаем.
 */
export function grantPreviewLabel(
  access: Pick<AccessState, 'hasAccess' | 'status' | 'endsAt'>,
  months: number,
  tz: string,
  now: Date = new Date(),
): string {
  if (access.status === 'frozen') return 'дата сдвинется после разморозки'

  const base = access.hasAccess && access.endsAt ? access.endsAt : now
  return formatDayRu(addMonthsClamped(base, months, tz), tz)
}

/** Текущее состояние доступа словами: «сейчас до 5 декабря 2026» или «доступа нет». */
export function accessPreviewLabel(
  access: Pick<AccessState, 'hasAccess' | 'status' | 'endsAt'>,
  tz: string,
): string {
  if (access.status === 'frozen') return 'подписка заморожена'
  if (access.hasAccess && access.endsAt) return `сейчас до ${formatDayRu(access.endsAt, tz)}`
  return 'доступа нет'
}
