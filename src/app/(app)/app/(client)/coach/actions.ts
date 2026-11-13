'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { archiveConversation } from '@/modules/coach-ai'
import { readableError } from '@/shared/form-error'

/** «В архив»: чат пропадает из списка, но не удаляется. */
export async function archiveConversationAction(conversationId: string): Promise<{ error: string | null }> {
  const { user } = await requireUser()

  try {
    await archiveConversation(user.id, conversationId)
  } catch (error) {
    return { error: readableError(error, 'Не удалось убрать чат') }
  }

  revalidatePath('/coach')
  return { error: null }
}
