'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import {
  archiveWarmupTemplate,
  saveWarmupTemplate,
  type WarmupTemplateInput,
} from '@/modules/training'
import { readableError } from '@/shared/form-error'

export type WarmupState = { error: string | null; saved: boolean }

/** Сохраняет шаблон разминки. Права проверяет сервис (`catalog.edit`). */
export async function saveWarmupAction(input: WarmupTemplateInput): Promise<WarmupState> {
  const { actor } = await requireUser()
  try {
    await saveWarmupTemplate(actor, input)
  } catch (error) {
    return { error: readableError(error, 'Не удалось сохранить разминку'), saved: false }
  }
  revalidatePath('/trainer/settings/warmups')
  return { error: null, saved: true }
}

export async function archiveWarmupAction(id: string): Promise<WarmupState> {
  const { actor } = await requireUser()
  try {
    await archiveWarmupTemplate(actor, id)
  } catch (error) {
    return { error: readableError(error, 'Не удалось убрать шаблон'), saved: false }
  }
  revalidatePath('/trainer/settings/warmups')
  return { error: null, saved: true }
}
