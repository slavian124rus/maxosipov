import { env } from '@/shared/env'
import { createConsoleEmailProvider } from './console'
import { createSmtpBzProvider } from './smtpbz'
import type { EmailProvider } from './types'

let cached: EmailProvider | null = null

/** Провайдер писем по `EMAIL_PROVIDER`: `console` (по умолчанию) или `smtpbz`. */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached

  if (env.EMAIL_PROVIDER === 'smtpbz') {
    if (!env.SMTPBZ_API_KEY || !env.EMAIL_FROM) {
      throw new Error('SMTPBZ_API_KEY и EMAIL_FROM не заданы, а EMAIL_PROVIDER=smtpbz')
    }
    cached = createSmtpBzProvider({
      apiKey: env.SMTPBZ_API_KEY,
      from: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME ?? 'МаксИИм',
    })
    return cached
  }

  cached = createConsoleEmailProvider()
  return cached
}

export type { EmailMessage, EmailProvider } from './types'
