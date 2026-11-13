'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { assertClientAccess } from '@/modules/access'
import { listAlternatives } from '@/modules/catalog'
import { applyProgramPatchAs, getActiveProgram } from '@/modules/training'
import type { WorkoutExercise } from '@/components/workout/free-mode'
import { readableError } from '@/shared/form-error'
import { buildWorkoutExercise } from './build-exercise'

export type SwapResult = { card: WorkoutExercise } | { error: string }

/** Находит строку программы клиента и проверяет, что замена входит в список тренера. */
async function resolveSwap(userId: string, programExerciseId: string, alternativeId: string) {
  const program = await getActiveProgram(userId)
  const item = program?.days.flatMap((day) => day.exercises).find((e) => e.id === programExerciseId)
  if (!program || !item) throw new Error('Упражнение не найдено в твоей программе')

  const allowed = await listAlternatives(item.exerciseId)
  if (!allowed.some((alt) => alt.id === alternativeId)) {
    throw new Error('Это упражнение тренер не указал как замену')
  }

  return { program, item }
}

/** «Только сегодня»: карточка запасного упражнения с теми же подходами и повторениями. Программа не меняется. */
export async function loadAlternativeCardAction(
  programExerciseId: string,
  alternativeId: string,
): Promise<SwapResult> {
  try {
    const { user } = await requireUser()
    await assertClientAccess(user.id)
    const { item } = await resolveSwap(user.id, programExerciseId, alternativeId)

    const card = await buildWorkoutExercise(user.id, {
      programExerciseId,
      exerciseId: alternativeId,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      restSec: item.restSec,
      targetWeightKg: null,
    })
    return { card }
  } catch (error) {
    return { error: readableError(error, 'Не удалось подготовить замену') }
  }
}

/** «Заменить насовсем»: меняет упражнение в программе клиента, вес подбирается заново. */
export async function replaceForeverAction(
  programExerciseId: string,
  alternativeId: string,
): Promise<SwapResult> {
  try {
    const { user, actor } = await requireUser()
    await assertClientAccess(user.id)
    const { program, item } = await resolveSwap(user.id, programExerciseId, alternativeId)

    await applyProgramPatchAs(
      actor,
      program.id,
      { ops: [{ op: 'replace_exercise', programExerciseId, exerciseId: alternativeId }] },
      'client',
    )
    revalidatePath('/workout')
    revalidatePath('/')

    const card = await buildWorkoutExercise(user.id, {
      programExerciseId,
      exerciseId: alternativeId,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      restSec: item.restSec,
      targetWeightKg: null,
    })
    return { card }
  } catch (error) {
    return { error: readableError(error, 'Не удалось заменить упражнение') }
  }
}
