import type { EmailProvider } from './types'

const SMTPBZ_ENDPOINT = 'https://api.smtp.bz/v1/smtp/send'
const TIMEOUT_MS = 10_000

type SmtpBzResponse = {
  result?: boolean
  errors?: { message?: string } | null
}

export type SmtpBzOptions = {
  apiKey: string
  /** Адрес отправителя; домен должен быть подтверждён в кабинете SMTP.bz. */
  from: string
  fromName: string
}

/**
 * SMTP.bz по HTTP API: `POST https://api.smtp.bz/v1/smtp/send`, ключ — в заголовке `Authorization`.
 * Успех — `{ "result": true }`, ошибка — `{ "result": false, "errors": { "message": … } }`.
 */
export function createSmtpBzProvider({ apiKey, from, fromName }: SmtpBzOptions): EmailProvider {
  return {
    async send(to, message) {
      let response: Response
      try {
        response = await fetch(SMTPBZ_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            name: fromName,
            to,
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        throw new Error('SMTP.bz недоступен или не ответил вовремя')
      }

      const raw = await response.text()
      let payload: SmtpBzResponse
      try {
        payload = JSON.parse(raw) as SmtpBzResponse
      } catch {
        throw new Error(`SMTP.bz вернул не JSON (HTTP ${response.status})`)
      }

      if (payload.result !== true) {
        throw new Error(`SMTP.bz отклонил письмо: ${payload.errors?.message ?? `HTTP ${response.status}`}`)
      }
    },
  }
}
