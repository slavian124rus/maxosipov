import type { EmailProvider } from './types'

/** Для разработки: ничего не отправляет, печатает письмо в консоль сервера. */
export function createConsoleEmailProvider(): EmailProvider {
  return {
    async send(to, message) {
      console.log(`[email:console] ${to} · ${message.subject} → ${message.text}`)
    },
  }
}
