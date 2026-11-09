/**
 * Ошибки уровня «объекта нет или он чужой». Страницы и роуты превращают
 * `NotFoundError` в `notFound()` (404), чтобы не подтверждать существование
 * чужих данных (ARCHITECTURE.md §8.4).
 */
export class NotFoundError extends Error {
  readonly status = 404

  constructor(message = 'Не найдено') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}