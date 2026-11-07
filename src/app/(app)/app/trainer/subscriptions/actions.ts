'use server'

import { revalidatePath } from 'next/cache'
import { disable, freeze, grant, unfreeze } from '@/modules/access'
import { requireUser } from '@/modules/auth'

const PAGE = '/trainer/subscriptions'

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const raw = String(value ?? '').trim()
  return raw || undefined
}

export async function grantMonthsAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const userId = String(formData.get('userId'))
  const months = Number(formData.get('months')) as 1 | 3 | 6 | 12

  await grant(actor, userId, {
    months,
    ...(optionalNumber(formData.get('priceRub')) !== undefined
      ? { priceRub: optionalNumber(formData.get('priceRub'))! }
      : {}),
    ...(optionalText(formData.get('note')) ? { note: optionalText(formData.get('note'))! } : {}),
  })

  revalidatePath(PAGE)
}

export async function grantUntilAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const userId = String(formData.get('userId'))
  const raw = String(formData.get('untilDate') ?? '')

  // Дата из поля `date` — считаем полднем по Красноярску, чтобы не прыгать на сутки.
  const untilDate = new Date(`${raw}T12:00:00+07:00`)
  if (Number.isNaN(untilDate.getTime())) throw new Error('Неверная дата')

  await grant(actor, userId, {
    untilDate,
    ...(optionalNumber(formData.get('priceRub')) !== undefined
      ? { priceRub: optionalNumber(formData.get('priceRub'))! }
      : {}),
    ...(optionalText(formData.get('note')) ? { note: optionalText(formData.get('note'))! } : {}),
  })

  revalidatePath(PAGE)
}

export async function freezeAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  await freeze(actor, String(formData.get('userId')))
  revalidatePath(PAGE)
}

export async function unfreezeAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  await unfreeze(actor, String(formData.get('userId')))
  revalidatePath(PAGE)
}

export async function disableAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  await disable(actor, String(formData.get('userId')))
  revalidatePath(PAGE)
}
