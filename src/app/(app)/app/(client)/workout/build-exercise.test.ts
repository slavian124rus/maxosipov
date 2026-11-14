import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { exercises } from '@/modules/catalog'
import { gyms } from '@/modules/gym'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { closeDb, prepareTestDb, resetDb, seedDefaultRoles } from '../../../../../../tests/db'
import { buildWorkoutExercise } from './build-exercise'

let userId: string
let exerciseId: string

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  await resetDb()
  const roles = await seedDefaultRoles()

  const [gym] = await db
    .insert(gyms)
    .values({
      name: 'Колизей',
      address: 'Красноярск',
      brand: { name: 'Максим Осипов', shortName: 'МаксИИм', colors: { accent: '#E5322D' }, logoUrl: null },
      settings: {
        trialDays: 30,
        subscriptionPriceRub: null,
        aiDailyLimit: 30,
        progressionRules: { sessionsToIncrease: 2, fastTrackOnEasy: true, failSessionsToDrop: 2, dropPercent: 10 },
        aiMemo: '',
      },
    })
    .returning()

  const [user] = await db
    .insert(users)
    .values({ phone: '+79990000021', name: 'Клиент', gymId: gym!.id, roleId: roles['Клиент']!.id })
    .returning()
  userId = user!.id

  const [exercise] = await db
    .insert(exercises)
    .values({
      gymId: gym!.id,
      name: 'Тяга верхнего блока обратным хватом',
      slug: 'tyaga-verhnego-bloka',
      primaryMuscles: ['lats'],
      secondaryMuscles: [],
      steps: ['Шаг'],
      // Правка карточки вернула упражнение в черновики, а в программе клиента оно осталось.
      status: 'draft',
      defaultRepMin: 12,
      defaultRepMax: 15,
    })
    .returning({ id: exercises.id })
  exerciseId = exercise!.id
})

test('упражнение-черновик из программы клиента показывается на тренировке с названием', async () => {
  const card = await buildWorkoutExercise(userId, {
    programExerciseId: 'pe-1',
    exerciseId,
    sets: 4,
    repMin: 12,
    repMax: 15,
    restSec: 90,
    targetWeightKg: null,
  })

  expect(card.name).toBe('Тяга верхнего блока обратным хватом')
  expect(card.steps).toEqual(['Шаг'])
})

test('вес по подходам из программы доходит до тренировки, рисунок сохраняется', async () => {
  const card = await buildWorkoutExercise(userId, {
    programExerciseId: 'pe-1',
    exerciseId,
    sets: 4,
    repMin: 10,
    repMax: 12,
    restSec: 90,
    targetWeightKg: 20,
    setWeights: [15, 20, 20, 20],
  })
  expect(card.planSetWeights).toEqual([15, 20, 20, 20])
})

test('без веса по подходам план по подходам пустой', async () => {
  const card = await buildWorkoutExercise(userId, {
    programExerciseId: 'pe-1',
    exerciseId,
    sets: 3,
    repMin: 10,
    repMax: 12,
    restSec: 90,
    targetWeightKg: 20,
  })
  expect(card.planSetWeights).toBeNull()
})
