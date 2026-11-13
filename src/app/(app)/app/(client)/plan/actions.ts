'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { assertClientAccess } from '@/modules/access'
import { applyProgramPatchAs, getProgramTree, type ProgramPatch } from '@/modules/training'
import { readableError } from '@/shared/form-error'

export type PlanResult = { error: string | null }

/**
 * Правка клиентом своей программы. Права берутся из владения программой
 * (`assertProgramWrite`): чужую программу сервис не даст изменить.
 */
export async function patchMyPlanAction(input: {
  programId: string
  patch: ProgramPatch
}): Promise<PlanResult> {
  try {
    const { user, actor } = await requireUser()
    await assertClientAccess(user.id)

    const program = await getProgramTree(input.programId)
    if (!program || program.ownerId !== user.id) throw new Error('Это не твоя программа')

    await applyProgramPatchAs(actor, input.programId, input.patch, 'client')
  } catch (error) {
    return { error: readableError(error, 'Не удалось сохранить') }
  }

  revalidatePath('/plan')
  revalidatePath('/')
  revalidatePath('/workout')
  return { error: null }
}
