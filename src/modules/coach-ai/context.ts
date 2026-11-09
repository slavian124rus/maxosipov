import { and, eq, isNull } from 'drizzle-orm'
import { clientProfiles, type ClientProfile } from '@/modules/auth'
import { exercises, machines, type MuscleCode } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import { recommend, type Recommendation, type SessionResult } from '@/modules/progression'
import {
  getActiveProgram,
  getHistoryForExercise,
  getSessionSummary,
  listSessions,
  type ProgramTree,
  type SessionSummary,
} from '@/modules/training'
import { db } from '@/shared/db'

export type CatalogEntry = {
  id: string
  name: string
  primary: MuscleCode[]
  machine: string | null
}

export type ContextData = {
  profile: ClientProfile | null
  healthConsent: boolean
  program: ProgramTree | null
  recentSessions: SessionSummary[]
  perExercise: Record<string, SessionResult[]>
  recommendations: Record<string, Recommendation>
  catalog: CatalogEntry[]
  exerciseNames: Record<string, string>
}

const GOAL_LABELS: Record<string, string> = {
  strength: 'сила',
  mass: 'масса',
  fat_loss: 'похудение',
  health: 'здоровье',
}

const EXPERIENCE_LABELS: Record<string, string> = {
  novice: 'новичок',
  intermediate: 'средний',
  advanced: 'опытный',
}

const SEX_LABELS: Record<string, string> = { male: 'мужской', female: 'женский' }

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'грудь',
  lats: 'широчайшие',
  traps: 'трапеции',
  delts_front: 'передние дельты',
  delts_side: 'средние дельты',
  delts_back: 'задние дельты',
  biceps: 'бицепс',
  triceps: 'трицепс',
  forearms: 'предплечья',
  abs: 'пресс',
  obliques: 'косые',
  lower_back: 'поясница',
  glutes: 'ягодицы',
  quads: 'квадрицепс',
  hamstrings: 'бицепс бедра',
  calves: 'икры',
}

function muscleLabel(code: string): string {
  return MUSCLE_LABELS[code] ?? code
}

function weight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone, day: 'numeric', month: 'long' }).format(date)
}
/** Текст контекста запроса разделами (ARCHITECTURE.md §9.2). */
export function buildContextBlock(data: ContextData, timeZone = 'Asia/Krasnoyarsk'): string {
  const lines: string[] = []

  lines.push('Анкета:')
  if (data.profile) {
    lines.push(
      `- пол: ${SEX_LABELS[data.profile.sex] ?? data.profile.sex}, год рождения: ${data.profile.birthYear}, рост: ${data.profile.heightCm} см, вес: ${weight(data.profile.weightKg)} кг`,
    )
    lines.push(
      `- цель: ${GOAL_LABELS[data.profile.goal] ?? data.profile.goal}, опыт: ${EXPERIENCE_LABELS[data.profile.experience] ?? data.profile.experience}, тренировок в неделю: ${data.profile.sessionsPerWeek}`,
    )
  } else {
    lines.push('- анкета не заполнена')
  }

  if (data.healthConsent && data.profile?.limitations) {
    lines.push('', 'Ограничения:', `- ${data.profile.limitations}`)
  }

  lines.push('', 'Программа:')
  if (data.program && data.program.days.length > 0) {
    lines.push(`«${data.program.name}»`)
    for (const day of data.program.days) {
      lines.push(`- ${day.name}`)
      for (const item of day.exercises) {
        const name = data.exerciseNames[item.exerciseId] ?? 'Упражнение'
        const target = item.targetWeightKg === null ? '' : `, вес ${weight(item.targetWeightKg)} кг`
        lines.push(
          `  · ${name}: ${item.sets} подхода по ${item.repMin}–${item.repMax} повторений${target}`,
        )
      }
    }
  } else {
    lines.push('- активной программы нет')
  }

  lines.push('', 'Последние тренировки:')
  if (data.recentSessions.length === 0) {
    lines.push('- ещё не было')
  } else {
    for (const session of data.recentSessions.slice(0, 6)) {
      lines.push(
        `- ${formatDate(session.startedAt, timeZone)}: упражнений ${session.exerciseCount}, объём ${session.volumeKg} кг`,
      )
    }
  }

  lines.push('', 'Результаты по упражнениям (последние 3 тренировки):')
  const exerciseIds = Object.keys(data.perExercise)
  if (exerciseIds.length === 0) {
    lines.push('- истории нет')
  } else {
    for (const exerciseId of exerciseIds) {
      const name = data.exerciseNames[exerciseId] ?? 'Упражнение'
      const results = data.perExercise[exerciseId] ?? []
      if (results.length === 0) {
        lines.push(`- ${name}: ещё не выполнялось`)
        continue
      }
      const text = results
        .map(
          (session) =>
            `${formatDate(session.date, timeZone)} — ${session.sets
              .map((set) => `${weight(set.weightKg)} кг × ${set.reps}`)
              .join(', ')}`,
        )
        .join('; ')
      lines.push(`- ${name}: ${text}`)
    }
  }

  lines.push('', 'Рекомендации алгоритма:')
  const recommendationIds = Object.keys(data.recommendations)
  if (recommendationIds.length === 0) {
    lines.push('- нет данных')
  } else {
    for (const exerciseId of recommendationIds) {
      const name = data.exerciseNames[exerciseId] ?? 'Упражнение'
      const recommendation = data.recommendations[exerciseId]!
      const value =
        recommendation.weightKg === null ? 'подобрать вес' : `${weight(recommendation.weightKg)} кг`
      lines.push(`- ${name}: ${value} (${recommendation.action}, ${recommendation.reasonCode})`)
    }
  }

  lines.push('', 'Каталог зала (id — название — мышцы — тренажёр):')
  if (data.catalog.length === 0) {
    lines.push('- пусто')
  } else {
    for (const item of data.catalog) {
      const muscles = item.primary.map(muscleLabel).join(', ') || 'не указаны'
      lines.push(`${item.id} — ${item.name} — ${muscles} — ${item.machine ?? 'свободные веса'}`)
    }
  }

  return lines.join('\n')
}
/** Собирает контекст запроса на сервере, без персональных данных (ARCHITECTURE.md §9.2). */
export async function loadContextData(userId: string): Promise<ContextData> {
  const gym = await getGym()
  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1)

  const program = await getActiveProgram(userId)

  const sessions = await listSessions(userId, 6)
  const recentSessions = (
    await Promise.all(sessions.map((session) => getSessionSummary(userId, session.id)))
  ).filter((session): session is SessionSummary => session !== null)

  const programItems = program ? program.days.flatMap((day) => day.exercises) : []
  const uniqueExerciseIds = [...new Set(programItems.map((item) => item.exerciseId))]

  const catalogRows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      primary: exercises.primaryMuscles,
      machine: machines.name,
      stepKg: machines.weightStepKg,
    })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .where(
      and(
        eq(exercises.gymId, gym.id),
        eq(exercises.status, 'published'),
        isNull(exercises.archivedAt),
      ),
    )
    .orderBy(exercises.name)

  const perExercise: Record<string, SessionResult[]> = {}
  const recommendations: Record<string, Recommendation> = {}
  const exerciseNames: Record<string, string> = {}

  const stepByExercise = new Map(catalogRows.map((row) => [row.id, Number(row.stepKg ?? 2.5)]))
  const targetByExercise = new Map(programItems.map((item) => [item.exerciseId, item] as const))

  for (const exerciseId of uniqueExerciseIds) {
    const history = await getHistoryForExercise(userId, exerciseId, 3, { finishedOnly: true })
    perExercise[exerciseId] = history

    const target = targetByExercise.get(exerciseId)
    recommendations[exerciseId] = recommend(
      {
        target: target
          ? { sets: target.sets, repMin: target.repMin, repMax: target.repMax }
          : { sets: 3, repMin: 8, repMax: 12 },
        stepKg: stepByExercise.get(exerciseId) ?? 2.5,
        history,
      },
      gym.settings.progressionRules,
    )
  }

  for (const row of catalogRows) exerciseNames[row.id] = row.name

  return {
    profile: profile ?? null,
    healthConsent: Boolean(profile?.healthConsentAt),
    program,
    recentSessions,
    perExercise,
    recommendations,
    catalog: catalogRows.map((row) => ({
      id: row.id,
      name: row.name,
      primary: row.primary,
      machine: row.machine,
    })),
    exerciseNames,
  }
}