'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { markProposalSeen, resolveFlag } from '@/modules/trainer'

/** «Разобрался» в ленте: жалоба больше не показывается. */
export async function resolveFlagAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  try {
    await resolveFlag(actor, id, String(formData.get('note') ?? ''))
  } catch (error) {
    console.error('[trainer] не удалось разобрать жалобу', error)
  }

  revalidatePath('/trainer')
}

/** «Понятно» у принятого изменения МаксИИма: убирает его из ленты. */
export async function markProposalSeenAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  try {
    await markProposalSeen(actor, id)
  } catch (error) {
    console.error('[trainer] не удалось отметить предложение', error)
  }

  revalidatePath('/trainer')
}