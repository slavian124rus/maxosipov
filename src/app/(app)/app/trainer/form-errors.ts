import { ZodError } from 'zod'
import type { FormState } from './form-state'

/**
 * Превращает исключение в текст для человека. Показываем только русские сообщения —
 * свои (`Нельзя снять последнего владельца`, `Недостаточно прав`) и из схем валидации;
 * английский текст драйвера БД наружу не уходит.
 */
export function formFailure(error: unknown, fallback: string): FormState {
  const message =
    error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : ''

  if (message && /[а-яё]/i.test(message)) return { error: message, saved: false }

  console.error('[trainer] действие формы не выполнено', error)
  return { error: fallback, saved: false }
}
