import { addDays, subscriptions } from '@/modules/access'
import { users } from '@/modules/auth'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { roles, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'
import { aiMessages, aiConversations } from '@/modules/coach-ai'
import { programs, programDays, programExercises } from '@/modules/training'
import { seedDefaultRoles } from '../../../tests/db'

export type TrainerWorld = {
  gymId: string
  trainer: Actor
  trainerId: string
  otherTrainer: Actor
  otherTrainerId: string
  client: Actor
  clientId: string
  otherClientId: string
  programId: string
  exerciseId: string
}

/** Общий стенд тестов кабинета: зал, два тренера, два клиента, программа и упражнение. */
export async function setupTrainerWorld(): Promise<TrainerWorld> {
  const roleRows = await seedDefaultRoles()

  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск, ул. Говорова',
      brand: { name: 'Максим Осипов', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: {
          sessionsToIncrease: 2,
          fastTrackOnEasy: true,
          failSessionsToDrop: 2,
          dropPercent: 10,
        },
        aiMemo: '',
      },
    })
    .returning()

  const [trainerRow] = await db
    .insert(users)
    .values({
      phone: '+79990000002',
      name: 'Максим',
      gymId: gym!.id,
      roleId: roleRows['Главный тренер']!.id,
    })
    .returning()

  const [otherTrainerRow] = await db
    .insert(users)
    .values({
      phone: '+79990000003',
      name: 'Другой тренер',
      gymId: gym!.id,
      roleId: roleRows['Тренер']!.id,
    })
    .returning()

  const [clientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000011',
      name: 'Иван Петров',
      gymId: gym!.id,
      roleId: roleRows['Клиент']!.id,
      trainerId: trainerRow!.id,
    })
    .returning()

  const [otherClientRow] = await db
    .insert(users)
    .values({
      phone: '+79990000012',
      name: 'Мария Соколова',
      gymId: gym!.id,
      roleId: roleRows['Клиент']!.id,
      trainerId: otherTrainerRow!.id,
    })
    .returning()

  const now = new Date()
  for (const userId of [clientRow!.id, otherClientRow!.id]) {
    await db
      .insert(subscriptions)
      .values({ userId, status: 'trial', startsAt: now, endsAt: addDays(now, 30) })
  }

  const [exercise] = await db
    .insert(exercises)
    .values({
      gymId: gym!.id,
      name: 'Тяга верхнего блока',
      slug: `tyaga-${Date.now()}`,
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      status: 'published',
    })
    .returning()

  const [program] = await db
    .insert(programs)
    .values({
      gymId: gym!.id,
      ownerId: clientRow!.id,
      authorId: trainerRow!.id,
      authorKind: 'trainer',
      name: 'Старт: 3 дня',
      status: 'active',
    })
    .returning()

  const [day] = await db
    .insert(programDays)
    .values({ programId: program!.id, order: 1, name: 'День A' })
    .returning()

  await db.insert(programExercises).values({
    dayId: day!.id,
    order: 1,
    exerciseId: exercise!.id,
    sets: 3,
    repMin: 10,
    repMax: 12,
    restSec: 90,
  })

  const clientPermissions = (['clients.view', 'clients.edit_programs', 'clients.notes', 'clients.view_ai_flags', 'clients.view_photos', 'clients.measurements'] as const).map(
    (code) => ({ code, scope: 'own' as const }),
  )

  return {
    gymId: gym!.id,
    trainer: {
      id: trainerRow!.id,
      roleId: roleRows['Главный тренер']!.id,
      gymId: gym!.id,
      isOwner: false,
      permissions: [
        { code: 'clients.view', scope: 'all' },
        { code: 'clients.edit_programs', scope: 'all' },
        { code: 'clients.notes', scope: 'all' },
        { code: 'clients.view_ai_flags', scope: 'all' },
        { code: 'clients.view_photos', scope: 'all' },
        { code: 'clients.measurements', scope: 'all' },
        { code: 'subscriptions.grant', scope: 'all' },
        { code: 'analytics.view', scope: 'all' },
      ],
    },
    trainerId: trainerRow!.id,
    otherTrainer: {
      id: otherTrainerRow!.id,
      roleId: roleRows['Тренер']!.id,
      gymId: gym!.id,
      isOwner: false,
      permissions: clientPermissions,
    },
    otherTrainerId: otherTrainerRow!.id,
    client: {
      id: clientRow!.id,
      roleId: roleRows['Клиент']!.id,
      gymId: gym!.id,
      isOwner: false,
      permissions: [],
    },
    clientId: clientRow!.id,
    otherClientId: otherClientRow!.id,
    programId: program!.id,
    exerciseId: exercise!.id,
  }
}

/** Жалоба клиента в чате МаксИИма. */
export async function addPainFlag(
  clientId: string,
  text: string,
  createdAt: Date = new Date(),
): Promise<string> {
  const [conversation] = await db
    .insert(aiConversations)
    .values({ userId: clientId })
    .returning({ id: aiConversations.id })

  await db.insert(aiMessages).values({
    conversationId: conversation!.id,
    userId: clientId,
    role: 'user',
    content: 'обычный вопрос',
  })

  const [flag] = await db
    .insert(aiMessages)
    .values({
      conversationId: conversation!.id,
      userId: clientId,
      role: 'user',
      content: text,
      flagged: 'pain',
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: aiMessages.id })

  return flag!.id
}

export { roles }
