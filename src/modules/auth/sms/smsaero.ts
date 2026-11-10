import type { SmsProvider } from './types'

const SMSAERO_ENDPOINT = 'https://gate.smsaero.ru/v2/sms/send'
/** Статусы сообщения из ответа: 2 — не доставлено, 6 — отклонено. */
const FAILED_STATUSES = new Set([2, 6])

type SmsAeroResponse = {
  success?: boolean
  data?: { status?: number; extendStatus?: string } | null
  message?: string | null
}

export type SmsAeroOptions = {
  /** Логин в кабинете SMS Aero (обычно email). */
  login: string
  apiKey: string
  /** Имя отправителя. «SMS Aero» — бесплатное, для тестов; свою подпись нужно заводить в кабинете. */
  sign: string
}

/**
 * SMS Aero по документации (https://smsaero.ru/integration/documentation/api/):
 * `GET https://gate.smsaero.ru/v2/sms/send?number=79991234567&text=…&sign=…`, HTTP Basic
 * (логин + API-ключ). Ключ идёт только в заголовке, в адрес не попадает.
 * Успех — `success: true` и статус сообщения не «не доставлено»/«отклонено».
 */
export function createSmsAeroProvider({ login, apiKey, sign }: SmsAeroOptions): SmsProvider {
  const authorization = `Basic ${Buffer.from(`${login}:${apiKey}`).toString('base64')}`

  return {
    async send(phoneE164, text) {
      const url = new URL(SMSAERO_ENDPOINT)
      url.searchParams.set('number', phoneE164.replace(/\D/g, ''))
      url.searchParams.set('text', text)
      url.searchParams.set('sign', sign)

      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: authorization, Accept: 'application/json' },
      })
      const raw = await response.text()

      let payload: SmsAeroResponse
      try {
        payload = JSON.parse(raw) as SmsAeroResponse
      } catch {
        throw new Error(`SMS Aero вернул не JSON (HTTP ${response.status})`)
      }

      if (payload.success !== true) {
        throw new Error(`SMS Aero не отправил сообщение: ${payload.message ?? `HTTP ${response.status}`}`)
      }

      const status = payload.data?.status
      if (status !== undefined && FAILED_STATUSES.has(status)) {
        throw new Error(`SMS Aero не доставил сообщение: ${payload.data?.extendStatus ?? `status=${status}`}`)
      }
    },
  }
}
