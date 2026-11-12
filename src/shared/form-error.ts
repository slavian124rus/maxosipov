import { ZodError } from 'zod'

/**
 * Текст ошибки для человека. Zod отдаёт массив проблем, и `error.message` — это JSON,
 * который нельзя показывать: берём первое русское сообщение из схемы.
 */
export function readableError(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback
  }

  const message = error instanceof Error ? error.message : ''
  return message && /[а-яё]/i.test(message) ? message.split('\n')[0]! : fallback
}
