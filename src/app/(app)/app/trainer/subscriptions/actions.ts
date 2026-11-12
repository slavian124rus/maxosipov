'use server'

import { revalidatePath } from 'next/cache'
import { disable, formatDayRu, freeze, grant, unfreeze } from '@/modules/access'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { INITIAL_GRANT_STATE, type GrantState } from './grant-state'

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

/**
 * Продление подписки из кабинета (DESIGN.md §8.9): на месяцы или до даты.
 * Возвращает дату окончания, чтобы форма показала «Выдано до …», а не молча закрылась.
 */
export async function grantSubscriptionAction(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const { actor } = await requireUser()
  const userId = String(formData.get('userId') ?? '')
  if (!userId) return { ...INITIAL_GRANT_STATE, error: 'Не выбран клиент' }

  const monthsRaw = String(formData.get('months') ?? '').trim()
  const untilRaw = String(formData.get('untilDate') ?? '').trim()

  try {
    const priceRub = optionalNumber(formData.get('priceRub'))
    const note = optionalText(formData.get('note'))
    const extra = {
      ...(priceRub !== undefined ? { priceRub } : {}),
      ...(note ? { note } : {}),
    }

    let row
    let months: number | null = null

    if (monthsRaw) {
      months = Number(monthsRaw)
      row = await grant(actor, userId, {
        months: months as 1 | 3 | 6 | 12,
        ...extra,
      })
    } else if (untilRaw) {
      // Дата из поля `date` — полдень по Красноярску, чтобы не прыгать на сутки.
      const untilDate = new Date(`${untilRaw}T12:00:00+07:00`)
      if (Number.isNaN(untilDate.getTime())) {
        return { ...INITIAL_GRANT_STATE, error: 'Неверная дата' }
      }
      row = await grant(actor, userId, { untilDate, ...extra })
    } else {
      return { ...INITIAL_GRANT_STATE, error: 'Укажи срок продления' }
    }

    const gym = await getGym()
    revalidatePath(PAGE)
    revalidatePath(`/trainer/clients/${userId}`)
    revalidatePath('/trainer')

    return {
      error: null,
      untilLabel: `Выдано до ${formatDayRu(row.endsAt, gym.timezone)}`,
      months,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      ...INITIAL_GRANT_STATE,
      error: /[а-яё]/i.test(message) ? message : 'Не удалось продлить подписку',
    }
  }
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
