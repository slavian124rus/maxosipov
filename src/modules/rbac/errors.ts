/** Нет прав на действие. Всегда 403. */
export class ForbiddenError extends Error {
  readonly status = 403

  constructor(message = 'Недостаточно прав') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
