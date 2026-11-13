import { and, eq, isNull } from 'drizzle-orm'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { exercises, listAlternatives, machines, MUSCLES, type MuscleCode } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import { recommend, type Recommendation } from '@/modules/progression'
import {
  applyPatch,
  getHistoryForExercise,
  PatchError,
  programPatchSchema,
  type ProgramPatch,
  type ProgramTree,
} from '@/modules/training'
import { db } from '@/shared/db'
import { checkDraftPainSafety, checkPainSafety, type PainState } from './pain'
import { createProposal } from './proposals'

export type CoachToolContext = {
  userId: string
  conversationId: string | null
  program: ProgramTree | null
  /** Открытые жалобы на боль: ограничивают, что можно предлагать. */
  pain?: Pick<PainState, 'zones'>
}

type CatalogRow = {
  id: string
  name: string
  primary: MuscleCode[]
  secondary: MuscleCode[]
  machine: string | null
  stepKg: number
}

const NOT_IN_CATALOG = 'Такого упражнения нет в каталоге зала'

async function catalogRows(gymId: string): Promise<CatalogRow[]> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      primary: exercises.primaryMuscles,
      secondary: exercises.secondaryMuscles,
      machine: machines.name,
      stepKg: machines.weightStepKg,
    })
    .from(exercises)
    .leftJoin(machines, eq(exercises.machineId, machines.id))
    .where(
      and(
        eq(exercises.gymId, gymId),
        eq(exercises.status, 'published'),
        isNull(exercises.archivedAt),
      ),
    )
    .orderBy(exercises.name)

  return rows.map((row) => ({ ...row, stepKg: Number(row.stepKg ?? 2.5) }))
}

function exerciseIdsFromPatch(patch: ProgramPatch): string[] {
  const ids: string[] = []
  for (const op of patch.ops) {
    if (op.op === 'add_exercise' || op.op === 'replace_exercise') ids.push(op.exerciseId)
  }
  return ids
}
/** Набор инструментов МаксИИма (ARCHITECTURE.md §9.3). ИИ пишет только в `ai_proposals`. */
export function createCoachTools(ctx: CoachToolContext): ToolSet {
  const gymPromise = getGym()

  /** Модель может назвать мышцу по-русски («широчайшие») — приводим к коду каталога. */
  function muscleCode(value: string): string {
    const lower = value.trim().toLowerCase()
    const found = MUSCLES.find(
      (muscle) => muscle.code === lower || muscle.nameRu.toLowerCase() === lower,
    )
    return found?.code ?? value.trim()
  }

  const get_exercise_history = tool({
    description: 'История подходов упражнения у клиента (последние тренировки).',
    inputSchema: z.object({ exerciseId: z.string().uuid() }),
    execute: async ({ exerciseId }) => {
      const history = await getHistoryForExercise(ctx.userId, exerciseId, 6, { finishedOnly: true })
      return {
        history: history.map((session) => ({
          date: session.date.toISOString(),
          sets: session.sets,
        })),
      }
    },
  })

  const find_exercises = tool({
    description:
      'Поиск упражнений в каталоге зала по мышце, тренажёру или названию. ' +
      'Когда нужна замена упражнению (тренажёр занят, болит, нет такого), передай его id в replace: ' +
      'запасные упражнения, которые указал тренер, придут первыми с пометкой trainerAlternative — предлагай их в первую очередь.',
    inputSchema: z.object({
      muscle: z.string().optional(),
      machine: z.string().optional(),
      query: z.string().optional(),
      replace: z.string().optional(),
    }),
    execute: async ({ muscle, machine, query, replace }) => {
      const gym = await gymPromise
      const rows = await catalogRows(gym.id)
      const text = query?.trim().toLowerCase()

      const found = rows.filter((row) => {
        if (muscle) {
          const code = muscleCode(muscle)
          if (
            !row.primary.includes(code as MuscleCode) &&
            !row.secondary.includes(code as MuscleCode)
          ) {
            return false
          }
        }
        if (machine && !(row.machine ?? '').toLowerCase().includes(machine.toLowerCase()))
          return false
        if (text && !row.name.toLowerCase().includes(text)) return false
        return true
      })

      const trainerPicks = replace ? await listAlternatives(replace) : []
      const pickOrder = new Map(trainerPicks.map((alt, index) => [alt.id, index]))
      // Запасные тренера ищем в каталоге целиком: фильтр по мышце мог бы их отсечь.
      const picked = rows.filter((row) => pickOrder.has(row.id))
      picked.sort((a, b) => pickOrder.get(a.id)! - pickOrder.get(b.id)!)
      const others = found.filter((row) => row.id !== replace && !pickOrder.has(row.id))

      return {
        exercises: [...picked, ...others].slice(0, 30).map((row) => ({
          id: row.id,
          name: row.name,
          primary: row.primary,
          secondary: row.secondary,
          machine: row.machine,
          ...(pickOrder.has(row.id) ? { trainerAlternative: true } : {}),
        })),
      }
    },
  })

  const get_progression = tool({
    description: 'Рекомендация алгоритма по весу для упражнения программы.',
    inputSchema: z.object({ exerciseId: z.string().uuid() }),
    execute: async ({ exerciseId }): Promise<Recommendation> => {
      const gym = await gymPromise
      const rows = await catalogRows(gym.id)
      const catalog = rows.find((row) => row.id === exerciseId)
      const target = ctx.program?.days
        .flatMap((day) => day.exercises)
        .find((item) => item.exerciseId === exerciseId)

      const history = await getHistoryForExercise(ctx.userId, exerciseId, 6, { finishedOnly: true })

      return recommend(
        {
          target: target
            ? { sets: target.sets, repMin: target.repMin, repMax: target.repMax }
            : { sets: 3, repMin: 8, repMax: 12 },
          stepKg: catalog?.stepKg ?? 2.5,
          history,
        },
        gym.settings.progressionRules,
      )
    },
  })
  const draft_workout = tool({
    description:
      'Черновик НОВОЙ программы с нуля — только когда клиент прямо просит собрать новую программу. ' +
      'Любое изменение текущей программы (замена, добавление, убрать, веса) — только через propose_program_change. ' +
      'Создаёт предложение, клиент нажмёт «Принять». Отдых: тяжёлые базовые 120–180 с, гипертрофия 60–90 с, изоляция и пресс 45–60 с.',
    inputSchema: z.object({
      name: z.string().trim().min(1).max(80),
      days: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(80),
            exercises: z
              .array(
                z
                  .object({
                    exerciseId: z.string().uuid(),
                    sets: z.number().int().min(1).max(10),
                    repMin: z.number().int().min(1).max(100),
                    repMax: z.number().int().min(1).max(100),
                    restSec: z.number().int().min(15).max(300).optional(),
                  })
                  .refine((item) => item.repMin <= item.repMax, 'repMin не больше repMax'),
              )
              .min(1)
              .max(12),
          }),
        )
        .min(1)
        .max(7),
      rationale: z.string().max(500).optional(),
    }),
    execute: async (input) => {
      const gym = await gymPromise
      const rows = await catalogRows(gym.id)
      const known = new Set(rows.map((row) => row.id))
      const ids = input.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))

      if (ids.some((id) => !known.has(id))) return { ok: false as const, error: NOT_IN_CATALOG }

      const painRows = new Map(rows.map((row) => [row.id, row.primary as string[]]))
      const drafted = checkDraftPainSafety(ids, ctx.pain ?? { zones: [] }, (id) => painRows.get(id) ?? [])
      if (drafted) return { ok: false as const, error: drafted }

      // Правка текущей программы не должна пересобираться заново: так теряются веса.
      if (ctx.program) {
        const current = new Set(
          ctx.program.days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
        )
        const unique = [...new Set(ids)]
        const same = unique.filter((id) => current.has(id)).length

        if (unique.length > 0 && same / unique.length >= 0.5) {
          return {
            ok: false as const,
            error:
              'Это правка текущей программы — используй propose_program_change, а не draft_workout',
          }
        }
      }

      const payload = { name: input.name, days: input.days, rationale: input.rationale ?? null }
      const proposalId = await createProposal({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        kind: 'new_program',
        program: ctx.program,
        payload,
        rationale: input.rationale ?? null,
      })

      return { ok: true as const, proposalId }
    },
  })

  const propose_program_change = tool({
    description:
      'Изменение текущей программы. Создаёт предложение с диффом, клиент нажмёт «Принять».',
    inputSchema: z.object({ patch: programPatchSchema, rationale: z.string().max(500).optional() }),
    execute: async ({ patch, rationale }) => {
      if (!ctx.program) return { ok: false as const, error: 'Нет активной программы' }

      const gym = await gymPromise
      const rows = await catalogRows(gym.id)
      const known = new Set(rows.map((row) => row.id))

      if (exerciseIdsFromPatch(patch).some((id) => !known.has(id))) {
        return { ok: false as const, error: NOT_IN_CATALOG }
      }

      const painRows = new Map(rows.map((row) => [row.id, row.primary as string[]]))
      const unsafe = checkPainSafety(patch.ops, ctx.program, ctx.pain ?? { zones: [] }, (id) => {
        const fromCatalog = painRows.get(id)
        if (fromCatalog) return fromCatalog
        return []
      })
      if (unsafe) return { ok: false as const, error: unsafe }

      try {
        // Проверяем патч на копии дерева — в БД ничего не пишем.
        applyPatch(ctx.program, patch, known)
      } catch (error) {
        if (error instanceof PatchError) return { ok: false as const, error: error.message }
        throw error
      }

      const proposalId = await createProposal({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        kind: 'patch',
        program: ctx.program,
        payload: patch,
        rationale: rationale ?? null,
      })

      return { ok: true as const, proposalId }
    },
  })

  return {
    get_exercise_history,
    find_exercises,
    get_progression,
    draft_workout,
    propose_program_change,
  }
}
