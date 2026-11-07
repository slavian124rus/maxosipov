'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  createSession,
  normalizePhone,
  requestOtp,
  SESSION_COOKIE,
  sessionCookieOptions,
  signInWithVerifiedPhone,
  verifyOtp,
} from '@/modules/auth'

export type FormState = { error: string | null }

const RATE_MESSAGE = 'Слишком много попыток. Попробуй через час'

async function clientIp(): Promise<string> {
  const headerStore = await headers()
  const forwarded = headerStore.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headerStore.get('x-real-ip') ?? 'unknown'
}

async function userAgent(): Promise<string | null> {
  const headerStore = await headers()
  return headerStore.get('user-agent')
}

/** Отправляет код и уводит на экран ввода. */
export async function requestCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const phone = normalizePhone(String(formData.get('phone') ?? ''))
  if (!phone) return { error: 'Проверь номер' }

  const result = await requestOtp(phone, await clientIp())
  if (!result.ok) return { error: RATE_MESSAGE }

  redirect(`/login/code?phone=${encodeURIComponent(phone)}`)
}

/** Повторная отправка кода с того же экрана (без перехода). */
export async function resendCodeAction(phone: string): Promise<FormState> {
  const normalized = normalizePhone(phone)
  if (!normalized) return { error: 'Проверь номер' }

  const result = await requestOtp(normalized, await clientIp())
  if (!result.ok) return { error: RATE_MESSAGE }

  return { error: null }
}

/** Проверяет код, создаёт сессию и уводит в приложение. */
export async function verifyCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const phone = normalizePhone(String(formData.get('phone') ?? ''))
  const code = String(formData.get('code') ?? '').trim()

  if (!phone) return { error: 'Проверь номер' }
  if (!/^\d{4}$/.test(code)) return { error: 'Неверный код' }

  const result = await verifyOtp(phone, code)
  if (!result.ok) {
    if (result.reason === 'expired') return { error: 'Код устарел — запроси новый' }
    if (result.reason === 'too_many_attempts') {
      return { error: 'Слишком много попыток — запроси новый код' }
    }
    return { error: 'Неверный код' }
  }

  const { userId, isNew } = await signInWithVerifiedPhone(phone)
  const { token, expiresAt } = await createSession(userId, await userAgent())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))

  redirect(isNew ? '/onboarding' : '/')
}
