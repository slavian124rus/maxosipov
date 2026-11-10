import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { subscriptions, type SubscriptionStatus } from '@/modules/access'
import { users } from '@/modules/auth'
import { listAcceptedProposals, listTrainerFlags, type TrainerProposalItem } from '@/modules/coach-ai'
import { permissionScope, roles, type Actor } from '@/modules/rbac'
import { listOngoingSessions } from '@/modules/training'
import { db } from '@/shared/db'

export type FlagItem = {
  id: string
  clientId: string
  clientName: string
  text: string
  flagged: 'pain' | 'injury'
  createdAt: Date
}

export type ClientRef = { id: string; name: string; detail?: string }

export type SubItem = { clientId: string; name: string; daysLeft: number; endsAt: Date }

export type TrainerFeed = {
  painFlags: FlagItem[]
  trainingNow: ClientRef[]
  acceptedAiChanges: TrainerProposalItem[]
  expiringSoon: SubItem[]
  newClients: ClientRef[]
}

const TRAINING_NOW_MS = 3 * 60 * 60 * 1000
const ENDING_DAYS = 7
const NEW_CLIENT_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

async function visibleClients(actor: Actor) {
  const scope = permissionScope(actor, 'clients.view')
  if (scope === null) return []

  return db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(roles.isClient, true),
        isNull(users.deletedAt),
        eq(users.gymId, actor.gymId),
        scope === 'own' ? eq(users.trainerId, actor.id) : undefined,
      ),
    )
}

/**
 * Лента «Сегодня» (DESIGN.md §8.9): жалобы, кто тренируется сейчас, принятые
 * изменения МаксИИма, истекающий доступ, новые клиенты. Учитывает область прав.
 */
export async function getTrainerFeed(actor: Actor, now: Date = new Date()): Promise<TrainerFeed> {
  const clients = await visibleClients(actor)
  if (clients.length === 0) {
    return { painFlags: [], trainingNow: [], acceptedAiChanges: [], expiringSoon: [], newClients: [] }
  }

  const ids = clients.map((client) => client.id)
  const nameById = new Map(clients.map((client) => [client.id, client.name || 'Без имени']))

  const flags = await listTrainerFlags(actor, { unresolvedOnly: true, limit: 20 })

  const ongoing = await listOngoingSessions(ids, new Date(now.getTime() - TRAINING_NOW_MS))

  const expiringRows = await db
    .select({ userId: subscriptions.userId, endsAt: subscriptions.endsAt, status: subscriptions.status })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, ids),
        inArray(subscriptions.status, ['trial', 'active']),
        gte(subscriptions.endsAt, now),
        lte(subscriptions.endsAt, new Date(now.getTime() + ENDING_DAYS * DAY_MS)),
      ),
    )

  const statusById = new Map(expiringRows.map((row) => [row.userId, row as { endsAt: Date; status: SubscriptionStatus }]))

  const expiringSoon: SubItem[] = clients
    .filter((client) => statusById.has(client.id))
    .map((client) => {
      const row = statusById.get(client.id)!
      return {
        clientId: client.id,
        name: client.name || 'Без имени',
        daysLeft: Math.max(0, Math.ceil((row.endsAt.getTime() - now.getTime()) / DAY_MS)),
        endsAt: row.endsAt,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const acceptedAiChanges = await listAcceptedProposals(actor, { unseenOnly: true, limit: 20 })

  const newClients: ClientRef[] = clients
    .filter((client) => client.createdAt.getTime() >= now.getTime() - NEW_CLIENT_DAYS * DAY_MS)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((client) => ({ id: client.id, name: client.name || 'Без имени' }))

  const trainingNow: ClientRef[] = ongoing.map((session) => ({
    id: session.userId,
    name: nameById.get(session.userId) ?? 'Клиент',
    detail: session.startedAt.toISOString(),
  }))

  return {
    painFlags: flags.map((flag) => ({
      id: flag.id,
      clientId: flag.clientId,
      clientName: flag.clientName,
      text: flag.text,
      flagged: flag.flagged,
      createdAt: flag.createdAt,
    })),
    trainingNow,
    acceptedAiChanges,
    expiringSoon,
    newClients,
  }
}