'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { markLeadContacted } from '@/modules/landing'

/** Отметка «Связался» в списке заявок (план, задача 3). */
export async function markLeadContactedAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  try {
    await markLeadContacted(actor, id)
  } catch (error) {
    // Право уже проверено внутри модуля — сюда попадает отказ или сбой БД.
    console.error('[landing] заявка не отмечена', error)
  }

  revalidatePath('/trainer/leads')
}
