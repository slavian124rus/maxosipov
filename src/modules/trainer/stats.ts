import { getTrialConversion } from '@/modules/access'
import { countUserMessagesSince } from '@/modules/coach-ai'
import { getGym } from '@/modules/gym'
import { assertCan, type Actor } from '@/modules/rbac'
import { countFinishedSessionsSince } from '@/modules/training'
import { listClients } from './clients'

export type TrainerStats = {
  activeClients: number
  trials: number
  /** `null`, если за 90 дней ни у кого не закончился пробный период. */
  trialToPaidRate: number | null
  workoutsLast7d: number
  aiMessagesLast7d: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Пять метрик кабинета (право `analytics.view`). */
export async function getStats(actor: Actor, now: Date = new Date()): Promise<TrainerStats> {
  assertCan(actor, 'analytics.view')

  const gym = await getGym()
  const clients = await listClients(actor)
  const ids = clients.map((client) => client.id)
  const since = new Date(now.getTime() - 7 * DAY_MS)

  const activeClients = clients.filter((client) => client.access.hasAccess).length
  const trials = clients.filter(
    (client) => client.access.status === 'trial' && client.access.hasAccess,
  ).length

  const conversion = await getTrialConversion(now, gym.settings.trialDays)

  const [workoutsLast7d, aiMessagesLast7d] = await Promise.all([
    countFinishedSessionsSince(ids, since),
    countUserMessagesSince(ids, since),
  ])

  return {
    activeClients,
    trials,
    trialToPaidRate:
      conversion.total === 0
        ? null
        : Math.round((conversion.paid / conversion.total) * 100) / 100,
    workoutsLast7d,
    aiMessagesLast7d,
  }
}