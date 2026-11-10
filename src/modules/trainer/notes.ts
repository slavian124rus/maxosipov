import { and, asc, eq } from 'drizzle-orm'
import { users } from '@/modules/auth'
import { assertCan, can, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
import { trainerNotes, type TrainerNote } from './schema'

/** Клиент существует, не удалён, в том же зале и виден актору; иначе 404. */
export async function assertClientVisible(actor: Actor, clientId: string): Promise<void> {
  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)

  const visible =
    client !== undefined &&
    client.gymId === actor.gymId &&
    client.deletedAt === null &&
    can(actor, 'clients.view', { clientId: client.id, clientTrainerId: client.trainerId })

  if (!visible) throw new NotFoundError('Клиент не найден')
}

async function target(clientId: string): Promise<{ clientId: string; clientTrainerId: string | null }> {
  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
  return { clientId, clientTrainerId: client?.trainerId ?? null }
}

/** Добавляет заметку о клиенте. Право `clients.notes` на этого клиента. */
export async function addNote(
  actor: Actor,
  clientId: string,
  input: { text: string; visibleToClient: boolean },
): Promise<TrainerNote> {
  const text = input.text.trim()
  if (text.length === 0 || text.length > 2000) {
    throw new Error('Заметка должна быть от 1 до 2000 символов')
  }

  await assertClientVisible(actor, clientId)
  assertCan(actor, 'clients.notes', await target(clientId))

  const [note] = await db
    .insert(trainerNotes)
    .values({ clientId, authorId: actor.id, text, visibleToClient: input.visibleToClient })
    .returning()

  if (!note) throw new Error('Заметка не сохранена')
  return note
}

/** Все заметки клиента для тренера (право `clients.notes`): старые сверху, как их читают. */
export async function listNotes(actor: Actor, clientId: string): Promise<TrainerNote[]> {
  await assertClientVisible(actor, clientId)
  // Заметки тренера приватны: видит тот, кому разрешено их вести (`clients.notes`), а не каждый, кто видит клиента.
  assertCan(actor, 'clients.notes', await target(clientId))

  return db
    .select()
    .from(trainerNotes)
    .where(eq(trainerNotes.clientId, clientId))
    .orderBy(asc(trainerNotes.createdAt))
}

/** Заметки, которые тренер разрешил показывать клиенту (блок «Заметки Максима»). */
export async function listVisibleNotes(clientId: string): Promise<TrainerNote[]> {
  return db
    .select()
    .from(trainerNotes)
    .where(and(eq(trainerNotes.clientId, clientId), eq(trainerNotes.visibleToClient, true)))
    .orderBy(asc(trainerNotes.createdAt))
}