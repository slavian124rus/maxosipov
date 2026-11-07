import type { SmsProvider } from './types'

const SMSRU_ENDPOINT = 'https://sms.ru/sms/send'

type SmsRuResponse = {
  status?: string
  status_code?: number
  status_text?: string
  sms?: Record<string, { status?: string; status_code?: number; status_text?: string }>
}

/**
 * СМС.ру по официальной документации (https://sms.ru/api/send):
 * `GET https://sms.ru/sms/send?api_id=…&to=79991234567&msg=…&json=1`.
 * Успех — `status: "OK"` и у номера `status: "OK"`.
 */
export function createSmsRuProvider(apiKey: string): SmsProvider {
  return {
    async send(phoneE164, text) {
      const to = phoneE164.replace(/\D/g, '')
      const url = new URL(SMSRU_ENDPOINT)
      url.searchParams.set('api_id', apiKey)
      url.searchParams.set('to', to)
      url.searchParams.set('msg', text)
      url.searchParams.set('json', '1')

      const response = await fetch(url, { method: 'GET' })
      const raw = await response.text()

      let payload: SmsRuResponse
      try {
        payload = JSON.parse(raw) as SmsRuResponse
      } catch {
        throw new Error(`СМС.ру вернул не JSON: ${raw.slice(0, 200)}`)
      }

      const recipient = payload.sms?.[to]

      if (payload.status !== 'OK' || recipient?.status !== 'OK') {
        const reason =
          recipient?.status_text ??
          payload.status_text ??
          `status=${payload.status ?? 'unknown'}, code=${payload.status_code ?? 'unknown'}`
        throw new Error(`СМС.ру не отправил сообщение: ${reason}`)
      }
    },
  }
}
