const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/
const MAX_EMAIL_LENGTH = 254
const MAX_LOCAL_LENGTH = 64

/** Приводит адрес к нижнему регистру; возвращает `null`, если это не адрес почты. */
export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase()
  if (value.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(value)) return null
  const local = value.slice(0, value.indexOf('@'))
  return local.length > 0 && local.length <= MAX_LOCAL_LENGTH ? value : null
}

/**
 * Один «настоящий» ящик для учёта пробного периода: без `+тега`, у gmail ещё и без точек.
 * Это не лишает человека права войти — только не даёт получить пробный месяц повторно.
 */
export function canonicalEmail(email: string): string {
  const at = email.lastIndexOf('@')
  let local = email.slice(0, at).split('+')[0] ?? ''
  let domain = email.slice(at + 1)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replaceAll('.', '')
  return `${local}@${domain}`
}
