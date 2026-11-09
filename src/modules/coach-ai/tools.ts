import { and, eq, isNull } from 'drizzle-orm'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { exercises, machines, MUSCLES, type MuscleCode } from '@/modules/catalog'
import { getGym } from '@/modules/gym'
import { recommend, type Recommendation } from '@/modules/progression'
import {
  aiProposals,
  applyPatch,
  getHistoryForExercise,
  PatchError,
  programPatchSchema,
  type ProgramPatch,
  type ProgramTree,
} from '@/modules/training'
import { db } from '@/shared/db'

export type CoachToolContext = {
  userId: string
  conversationId: string | null
  program: ProgramTree | null
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
    description: 'Поиск упражнений в каталоге зала по мышце, тренажёру или названию.',
    inputSchema: z.object({
      muscle: z.string().optional(),
      machine: z.string().optional(),
      query: z.string().optional(),
    }),
    execute: async ({ muscle, machine, query }) => {
      const gym = await gymPromise
      const rows = await catalogRows(gym.id)
      const text = query?.trim().toLowerCase()

      const found = rows.filter((row) => {
        if (muscle) {
          const code = muscleCode(muscle)
          if (!row.primary.includes(code as MuscleCode) && !row.secondary.includes(code as MuscleCode)) {
            return false
          }
        }
        if (machine && !(row.machine ?? '').toLowerCase().includes(machine.toLowerCase())) return false
        if (text && !row.name.toLowerCase().includes(text)) return false
        return true
      })

      return {
        exercises: found.slice(0, 30).map((row) => ({
          id: row.id,
          name: row.name,
          primary: row.primary,
          secondary: row.secondary,
          machine: row.machine,
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
      'Черновик новой тренировки или программы. Создаёт предложение, клиент нажмёт «Принять».',
    inputSchema: z.object({
      name: z.string().trim().min(1).max(80),
      days: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(80),
            exercises: z
              .array(
                z.object({
                  exerciseId: z.string().uuid(),
                  sets: z.number().int().min(1).max(10),
                  repMin: z.number().int().min(1).max(100),
                  repMax: z.number().int().min(1).max(100),
                }),
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

      const payload = { name: input.name, days: input.days, rationale: input.rationale ?? null }
      const [created] = await db
        .insert(aiProposals)
        .values({
          userId: ctx.userId,
          programId: ctx.program?.id ?? null,
          kind: 'new_program',
          diff: payload,
          payload,
          conversationId: ctx.conversationId,
          rationale: input.rationale ?? null,
        })
        .returning({ id: aiProposals.id })

      return { ok: true as const, proposalId: created!.id }
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

      try {
        // Проверяем патч на копии дерева — в БД ничего не пишем.
        applyPatch(ctx.program, patch, known)
      } catch (error) {
        if (error instanceof PatchError) return { ok: false as const, error: error.message }
        throw error
      }

      const [created] = await db
        .insert(aiProposals)
        .values({
          userId: ctx.userId,
          programId: ctx.program.id,
          kind: 'patch',
          diff: patch,
          payload: patch,
          conversationId: ctx.conversationId,
          rationale: rationale ?? null,
        })
        .returning({ id: aiProposals.id })

      return { ok: true as const, proposalId: created!.id }
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