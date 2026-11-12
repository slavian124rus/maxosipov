'use server'

import { revalidatePath } from 'next/cache'
import { getClientProfile, requireUser } from '@/modules/auth'
import { suggestStartWeights } from '@/modules/coach-ai'
import { estimateStartWeight } from '@/modules/progression'
import {
  applyProgramWeights,
  archiveProgram,
  assignTemplate,
  getActiveProgram,
  getProgramTree,
  programExerciseHints,
  programWeightStats,
  toStartWeightProfile,
} from '@/modules/training'
import { readableError } from '@/shared/form-error'

export type ProgramActionResult = { error: string | null; message?: string }

export type WeightPreviewItem = {
  exerciseId: string
  name: string
  weightKg: number
  reason: string
}

export type WeightPreview = {
  error: string | null
  /** `ai` — подобрал МаксИИм, `profile` — расчёт по анкете (ИИ недоступен). */
  source: 'ai' | 'profile'
  summary: string
  items: WeightPreviewItem[]
}

function revalidateClient(clientId: string): void {
  revalidatePath(`/trainer/clients/${clientId}`)
  revalidatePath('/trainer/clients')
  revalidatePath('/trainer/programs')
}

/** Проверяем, что программа принадлежит этому клиенту: id приходит из формы. */
async function clientProgram(programId: string, clientId: string) {
  const program = await getProgramTree(programId)
  if (!program || program.ownerId !== clientId) return null

  return program
}

/**
 * Тренер выдаёт клиенту шаблон (DESIGN.md §8.9). Прежняя активная программа уходит
 * в архив, упражнения получают веса по анкете клиента — свои у каждого.
 */
export async function assignClientProgramAction(input: {
  clientId: string
  templateId: string
}): Promise<ProgramActionResult> {
  const { actor } = await requireUser()

  try {
    await assignTemplate(actor, input.templateId, [input.clientId])
  } catch (error) {
    return { error: readableError(error, 'Программа не выдана') }
  }

  const program = await getActiveProgram(input.clientId)
  const stats = program ? programWeightStats(program) : { total: 0, withWeight: 0 }

  revalidateClient(input.clientId)

  return {
    error: null,
    message:
      stats.withWeight > 0
        ? `Программа выдана. Веса по анкете: ${stats.withWeight} из ${stats.total}`
        : 'Программа выдана. Анкета не заполнена — веса задай сам или подбери с МаксИИмом',
  }
}

/** Удаление программы клиента: уходит в архив, история тренировок остаётся. */
export async function removeClientProgramAction(input: {
  clientId: string
  programId: string
}): Promise<ProgramActionResult> {
  const { actor } = await requireUser()
  const program = await clientProgram(input.programId, input.clientId)
  if (!program) return { error: 'Программа не найдена' }

  try {
    await archiveProgram(actor, input.programId)
  } catch (error) {
    return { error: readableError(error, 'Программа не удалена') }
  }

  revalidateClient(input.clientId)
  return { error: null, message: 'Программа удалена' }
}

/**
 * Предпросмотр весов: МаксИИм смотрит анкету и упражнения, а если модель недоступна —
 * веса считаются по анкете той же формулой, что и при выдаче шаблона.
 * В программу ничего не пишется, пока тренер не нажмёт «Применить».
 */
export async function previewClientWeightsAction(input: {
  clientId: string
  programId: string
}): Promise<WeightPreview> {
  const { actor } = await requireUser()
  const program = await clientProgram(input.programId, input.clientId)
  if (!program) return { error: 'Программа не найдена', source: 'profile', summary: '', items: [] }

  const profile = toStartWeightProfile(await getClientProfile(input.clientId))
  if (!profile) {
    return {
      error: 'У клиента не заполнена анкета: нет пола, роста и веса — веса не из чего считать',
      source: 'profile',
      summary: '',
      items: [],
    }
  }

  const hints = await programExerciseHints(program)
  // Одно упражнение может стоять в нескольких днях — МаксИИму достаточно одного.
  const unique = [...new Map(hints.map((hint) => [hint.exerciseId, hint])).values()]

  try {
    const ai = await suggestStartWeights(
      profile,
      unique.map((hint) => ({
        exerciseId: hint.exerciseId,
        name: hint.name,
        machineName: hint.machineName,
        primary: hint.primary,
        stepKg: hint.stepKg,
        sets: hint.sets,
        repMin: hint.repMin,
        repMax: hint.repMax,
      })),
      { userId: actor.id },
    )

    const names = new Map(unique.map((hint) => [hint.exerciseId, hint.name]))
    const items = ai.items
      .map((item) => ({
        exerciseId: item.exerciseId,
        name: names.get(item.exerciseId) ?? 'Упражнение',
        weightKg: item.weightKg,
        reason: item.reason,
      }))
      .filter((item) => item.weightKg > 0)

    if (items.length > 0) return { error: null, source: 'ai', summary: ai.summary, items }
  } catch (error) {
    console.error('[trainer] МаксИИм не подобрал веса', error)
  }

  const items = unique
    .map((hint) => ({
      exerciseId: hint.exerciseId,
      name: hint.name,
      weightKg: estimateStartWeight(
        { primary: hint.primary, onMachine: hint.machineName !== null, stepKg: hint.stepKg },
        profile,
      ),
      reason: 'расчёт по анкете',
    }))
    .filter((item) => item.weightKg > 0)

  return {
    error: null,
    source: 'profile',
    summary:
      items.length > 0
        ? 'МаксИИм сейчас недоступен — веса посчитаны по анкете'
        : 'По анкете веса не получаются: в программе только упражнения с собственным весом',
    items,
  }
}

/** Применяет предпросмотр к программе клиента. */
export async function applyClientWeightsAction(input: {
  clientId: string
  programId: string
  weights: Record<string, number>
}): Promise<ProgramActionResult> {
  await requireUser()
  const program = await clientProgram(input.programId, input.clientId)
  if (!program) return { error: 'Программа не найдена' }

  const updated = await applyProgramWeights(input.programId, input.weights)
  revalidateClient(input.clientId)

  return {
    error: null,
    message: updated > 0 ? `Веса обновлены: ${updated}` : 'Веса уже такие — менять нечего',
  }
}
