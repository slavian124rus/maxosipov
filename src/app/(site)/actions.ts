'use server'

import { headers } from 'next/headers'
import { ZodError } from 'zod'
import { LANDING_UI } from '../../../content/landing'
import { createLead } from '@/modules/landing'
import { clientIpFrom } from '@/shared/client-ip'
import type { LeadFormState } from './lead-state'

const NAME_MAX = 200
const PHONE_MAX = 40

/**
 * Заявка с лендинга (план, задача 3). Форму проверяем на сервере независимо от
 * атрибутов `required` в разметке: поле может прислать кто угодно (ревью этапа 3, F8).
 */
export async function submitLeadAction(
  previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const name = String(formData.get('name') ?? '').slice(0, NAME_MAX)
  const phone = String(formData.get('phone') ?? '').slice(0, PHONE_MAX)
  const consent = formData.get('consent') === 'on'
  const values = { name, phone, consent }

  try {
    // IP — последний адрес `X-Forwarded-For`: начало заголовка подделывает клиент (ревью этапа 1, F7).
    const ip = clientIpFrom(await headers())

    const result = await createLead({ ...values, ip, source: 'landing' })

    if (!result.ok) return { done: false, error: result.error, ...values }

    return { done: true, error: null, name: '', phone: '', consent: false }
  } catch (error) {
    return failure(error, values)
  }
}

/**
 * Наружу — только понятные русские сообщения (свои и из схем Zod).
 * Текст драйвера БД или стека не показываем (приём из `app/trainer/form-errors.ts`).
 */
function failure(error: unknown, values: Omit<LeadFormState, 'done' | 'error'>): LeadFormState {
  const message =
    error instanceof ZodError
      ? error.issues[0]?.message
      : error instanceof Error
        ? error.message
        : ''

  if (message && /[а-яё]/i.test(message)) return { done: false, error: message, ...values }

  console.error('[landing] заявка не сохранена', error)
  return { done: false, error: LANDING_UI.lead.errorFallback, ...values }
}
