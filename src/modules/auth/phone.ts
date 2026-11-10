const RUSSIAN_COUNTRY_CODE = '7'

/** Первая цифра национального номера: 9 — мобильный, 3/4 — городские коды. */
const VALID_NATIONAL_FIRST_DIGITS = new Set(['9', '3', '4'])

/**
 * Приводит российский номер к E.164 (`+7XXXXXXXXXX`).
 * Возвращает `null`, если это не российский номер.
 *
 * Понимает `8 (999) 123-45-67`, `+7 999 1234567`, `79991234567`, `9991234567`.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')

  let national: string | null = null

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    national = digits.slice(1)
  } else if (digits.length === 10) {
    national = digits
  }

  if (!national) return null

  const first = national[0]
  if (!first || !VALID_NATIONAL_FIRST_DIGITS.has(first)) return null

  return `+${RUSSIAN_COUNTRY_CODE}${national}`
}

/** Телефон или почта для списков: почта показывается как есть. */
export function formatContact(contact: string): string {
  return contact.includes('@') ? contact : formatPhone(contact)
}

/** Показывает номер в формате `+7 (999) 123-45-67`; невалидный возвращает как есть. */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) return phone

  const national = normalized.slice(2)
  return `+7 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8)}`
}
