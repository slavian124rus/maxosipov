import { notFound } from 'next/navigation'
import { getClientCard } from '@/modules/trainer'
import { can, type Actor } from '@/modules/rbac'
import type { ProgramTree } from '@/modules/training'
import { isNotFoundError } from '@/shared/errors'

/**
 * Права на программу: шаблон правит тот, у кого есть `clients.edit_programs`;
 * программу клиента — тот, кому карточка клиента разрешает править программу.
 * Во всех остальных случаях — 404, как и на странице программы.
 */
export async function assertProgramAccess(actor: Actor, program: ProgramTree): Promise<void> {
  if (program.ownerId === null) {
    if (!can(actor, 'clients.edit_programs')) notFound()
    return
  }

  try {
    const card = await getClientCard(actor, program.ownerId)
    if (!card.permissions.editProgram) notFound()
  } catch (error) {
    if (isNotFoundError(error)) notFound()
    throw error
  }
}
