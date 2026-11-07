import type { SmsProvider } from './types'

/**
 * Провайдер для разработки: ничего не отправляет, печатает код в консоль сервера.
 * Значение по умолчанию (`SMS_PROVIDER=console`).
 */
export function createConsoleProvider(): SmsProvider {
  return {
    async send(phoneE164, text) {
      console.log(`[sms:console] ${phoneE164} → ${text}`)
    },
  }
}
