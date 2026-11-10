import { env } from '@/shared/env'
import { createConsoleProvider } from './console'
import { createSmsAeroProvider } from './smsaero'
import { createSmsRuProvider } from './smsru'
import type { SmsProvider } from './types'

let cached: SmsProvider | null = null

/** Провайдер СМС по `SMS_PROVIDER`: `console` (по умолчанию), `smsru` или `smsaero`. */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached

  if (env.SMS_PROVIDER === 'smsru') {
    if (!env.SMS_API_KEY) {
      throw new Error('SMS_API_KEY не задан, а SMS_PROVIDER=smsru')
    }
    cached = createSmsRuProvider(env.SMS_API_KEY)
    return cached
  }

  if (env.SMS_PROVIDER === 'smsaero') {
    if (!env.SMS_API_KEY || !env.SMS_AERO_LOGIN) {
      throw new Error('SMS_API_KEY и SMS_AERO_LOGIN не заданы, а SMS_PROVIDER=smsaero')
    }
    cached = createSmsAeroProvider({
      login: env.SMS_AERO_LOGIN,
      apiKey: env.SMS_API_KEY,
      sign: env.SMS_AERO_SIGN ?? 'SMS Aero',
    })
    return cached
  }

  cached = createConsoleProvider()
  return cached
}

export type { SmsProvider }
