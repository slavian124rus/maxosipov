import { env } from '@/shared/env'
import { createConsoleProvider } from './console'
import { createSmsRuProvider } from './smsru'
import type { SmsProvider } from './types'

let cached: SmsProvider | null = null

/** Провайдер СМС по `SMS_PROVIDER`: `console` (по умолчанию) или `smsru`. */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached

  if (env.SMS_PROVIDER === 'smsru') {
    if (!env.SMS_API_KEY) {
      throw new Error('SMS_API_KEY не задан, а SMS_PROVIDER=smsru')
    }
    cached = createSmsRuProvider(env.SMS_API_KEY)
    return cached
  }

  cached = createConsoleProvider()
  return cached
}

export type { SmsProvider }
