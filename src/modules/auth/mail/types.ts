export type EmailMessage = {
  subject: string
  text: string
  html?: string
}

/** Отправка писем. Адрес получателя уже нормализован (`normalizeEmail`). */
export interface EmailProvider {
  send(to: string, message: EmailMessage): Promise<void>
}
