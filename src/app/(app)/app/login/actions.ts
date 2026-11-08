'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientIpFrom } from '@/shared/client-ip'
import {
  createSession,
  normalizePhone,
  requestOtp,
  SESSION_COOKIE,
  sessionCookieOptions,
  signInWithVerifiedPhone,
  takePendingLink,
  verifyOtp,
} from '@/modules/auth'

export type FormState = { error: string | null }

const RATE_MESSAGE = 'Слишком много попыток. Попробуй через час'

async function clientIp(): Promise<string> {
  return clientIpFrom(await headers())
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
  const linkId = String(formData.get('link') ?? '').trim()

  if (!phone) return { error: 'Проверь номер' }
  if (!/^\d{4}$/.test(code)) return { error: 'Неверный код' }

  const result = await verifyOtp(phone, code)
  if (!result.ok) {
    if (result.reason === 'expired') return { error: 'Код устарел — запроси новый' }
    if (result.reason === 'locked_day') {
      return { error: 'Слишком много попыток. Попробуй завтра или войди через VK/Яндекс' }
    }
    if (result.reason === 'too_many_attempts') {
      return { error: 'Слишком много попыток — запроси новый код' }
    }
    return { error: 'Неверный код' }
  }

  // Пришли из OAuth без телефона — привязываем способ входа к подтверждённому номеру.
  const pending = linkId ? await takePendingLink(linkId) : null
  const link = pending
    ? {
        provider: pending.provider,
        providerUserId: pending.providerUserId,
        ...(pending.name ? { name: pending.name } : {}),
      }
    : undefined

  const { userId, isNew } = await signInWithVerifiedPhone(phone, link)
  const { token, expiresAt } = await createSession(userId, await userAgent())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))

  redirect(isNew ? '/onboarding' : '/')
}
