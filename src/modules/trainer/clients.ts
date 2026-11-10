import { and, eq, isNull } from 'drizzle-orm'
import {
  computeAccess,
  getAccessForUser,
  subscriptions,
  type AccessState,
} from '@/modules/access'
import { getClientProfile, users, type ClientProfile } from '@/modules/auth'
import {
  listMeasurements,
  listProgressPhotos,
  type BodyMeasurement,
  type ProgressPhotoView,
} from '@/modules/body'
import {
  listAcceptedProposals,
  listFlaggedMessages,
  listProposalCards,
  type AiFlagView,
  type ProposalCard,
  type TrainerProposalItem,
} from '@/modules/coach-ai'
import { can, permissionScope, roles, type Actor } from '@/modules/rbac'
import {
  getActiveProgram,
  getLastWorkoutDates,
  listProgramChanges,
  listSessions,
  type ProgramChangeView,
  type ProgramTree,
} from '@/modules/training'
import { db } from '@/shared/db'
import { NotFoundError } from '@/shared/errors'
import { assertClientVisible } from './notes'
import { trainerNotes, type TrainerNote } from './schema'

export type ClientFilter = 'all' | 'trial' | 'expiring' | 'expired' | 'active'

export type ClientListItem = {
  id: string
  name: string
  /** Телефон или, если его нет, почта. */
  contact: string
  access: AccessState
  lastWorkoutAt: Date | null
}

export type ClientSessionItem = {
  id: string
  startedAt: Date
  finishedAt: Date | null
  mode: string
}

export type ClientCard = {
  id: string
  name: string
  /** Телефон или, если его нет, почта. */
  contact: string
  createdAt: Date
  access: AccessState
  profile: ClientProfile | null
  program: ProgramTree | null
  programChanges: ProgramChangeView[]
  sessions: ClientSessionItem[]
  measurements: BodyMeasurement[]
  photos: ProgressPhotoView[]
  notes: TrainerNote[]
  aiFlags: AiFlagView[]
  proposals: ProposalCard[]
  acceptedProposals: TrainerProposalItem[]
  permissions: {
    editProgram: boolean
    viewPhotos: boolean
    viewAiFlags: boolean
    notes: boolean
    measurements: boolean
    grantSubscription: boolean
  }
}

const ENDING_DAYS = 7

function matchesFilter(access: AccessState, filter: ClientFilter): boolean {
  if (filter === 'trial') return access.status === 'trial' && access.hasAccess
  if (filter === 'active') return access.status === 'active' && access.hasAccess
  if (filter === 'expired') return !access.hasAccess
  if (filter === 'expiring') return access.hasAccess && (access.daysLeft ?? Infinity) <= ENDING_DAYS
  return true
}

function matchesQuery(user: { name: string; phone: string | null; email: string | null }, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const digits = query.replace(/\D/g, '')

  return user.name.toLowerCase().includes(text) ||
    (digits.length > 0 && (user.phone ?? '').includes(digits)) ||
    (user.email ?? '').includes(text)
}

/** Клиенты, которых актор вправе видеть: область `own` — только свои, `all` — все в зале. */
export async function listClients(
  actor: Actor,
  options: { query?: string; filter?: ClientFilter } = {},
): Promise<ClientListItem[]> {
  const scope = permissionScope(actor, 'clients.view')
  if (scope === null) throw new NotFoundError('Клиенты не найдены')

  const onlyOwn = scope === 'own'
  const now = new Date()

  const rows = await db
    .select({ user: users, sub: subscriptions })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(
      and(
        eq(roles.isClient, true),
        isNull(users.deletedAt),
        eq(users.gymId, actor.gymId),
        onlyOwn ? eq(users.trainerId, actor.id) : undefined,
      ),
    )
    .orderBy(users.name)

  const visible = rows
    .map(({ user, sub }) => ({ user, access: computeAccess(sub, now) }))
    .filter(({ user }) => matchesQuery(user, options.query ?? ''))
    .filter(({ access }) => matchesFilter(access, options.filter ?? 'all'))

  const ids = visible.map(({ user }) => user.id)
  const lastWorkouts = await getLastWorkoutDates(ids)

  return visible.map(({ user, access }) => ({
    id: user.id,
    name: user.name || 'Без имени',
    contact: user.phone ?? user.email ?? '',
    access,
    lastWorkoutAt: lastWorkouts.get(user.id) ?? null,
  }))
}

/**
 * Карточка клиента. Чужой клиент (вне области прав) — `NotFoundError` → 404,
 * а не данные (Review Focus 1).
 */
export async function getClientCard(actor: Actor, clientId: string): Promise<ClientCard> {
  await assertClientVisible(actor, clientId)

  const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1)
  if (!client) throw new NotFoundError('Клиент не найден')

  const target = { clientId, clientTrainerId: client.trainerId }
  const access = await getAccessForUser(clientId)
  const profile = await getClientProfile(clientId)
  const program = await getActiveProgram(clientId)
  const programChanges = program ? await listProgramChanges(program.id) : []
  const sessions = await listSessions(clientId, 30)
  const measurements = await listMeasurements(actor, clientId, { limit: 60 })

  const viewPhotos = can(actor, 'clients.view_photos', target)
  const photos = viewPhotos ? await listProgressPhotos(actor, clientId) : []

  // Заметки приватны: без права `clients.notes` вкладка пустая и форма не показывается.
  const notes = can(actor, 'clients.notes', target)
    ? await db
        .select()
        .from(trainerNotes)
        .where(eq(trainerNotes.clientId, clientId))
        .orderBy(trainerNotes.createdAt)
    : []

  // Полная переписка тренеру не видна: только жалобы и предложения (ARCHITECTURE.md §9.9).
  const viewAiFlags = can(actor, 'clients.view_ai_flags', target)
  const aiFlags = viewAiFlags
    ? (await listFlaggedMessages(actor, clientId)).filter((flag) => flag.resolvedAt === null)
    : []
  const proposals = viewAiFlags ? await listProposalCards(clientId) : []
  const acceptedProposals = viewAiFlags
    ? await listAcceptedProposals(actor, { clientId, limit: 10 })
    : []

  return {
    id: client.id,
    name: client.name || 'Без имени',
    contact: client.phone ?? client.email ?? '',
    createdAt: client.createdAt,
    access,
    profile,
    program,
    programChanges,
    sessions: sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      mode: session.mode,
    })),
    measurements,
    photos,
    notes,
    aiFlags,
    proposals,
    acceptedProposals,
    permissions: {
      editProgram: can(actor, 'clients.edit_programs', target),
      viewPhotos,
      viewAiFlags,
      notes: can(actor, 'clients.notes', target),
      measurements: can(actor, 'clients.measurements', target),
      grantSubscription: can(actor, 'subscriptions.grant', target),
    },
  }
}