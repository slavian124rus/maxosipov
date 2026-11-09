'use server'

import { revalidatePath } from 'next/cache'
import {
  createExercise,
  createMachine,
  getExercise,
  publishExercise,
  unpublishExercise,
  updateExercise,
  type ExerciseInput,
} from '@/modules/catalog'
import { requireUser } from '@/modules/auth'
import { draftExerciseText, type ExerciseDraft } from '@/modules/coach-ai'
import { setProcessingOptions } from '@/modules/media'
import { assertCan } from '@/modules/rbac'
import type { MuscleCode } from '@/shared/muscles'

export type SaveExerciseState = { error: string | null; id: string | null; notice?: string | null }

function text(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim()
}

function list(value: FormDataEntryValue | null): string[] {
  return text(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function jsonList(value: FormDataEntryValue | null): string[] {
  try {
    const parsed: unknown = JSON.parse(text(value) || '[]')
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

/** Создаёт или обновляет упражнение; при `publish=1` сразу публикует. */
export async function saveExerciseAction(
  _prev: SaveExerciseState,
  formData: FormData,
): Promise<SaveExerciseState> {
  const { actor } = await requireUser()

  // Серверные действия — публичные адреса: права проверяем до любых изменений.
  try {
    assertCan(actor, 'catalog.edit')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Недостаточно прав', id: null }
  }

  const input: ExerciseInput = {
    name: text(formData.get('name')),
    machineId: text(formData.get('machineId')) || null,
    primaryMuscles: list(formData.get('primary')) as MuscleCode[],
    secondaryMuscles: list(formData.get('secondary')) as MuscleCode[],
    videoMediaId: text(formData.get('videoMediaId')) || null,
    steps: jsonList(formData.get('steps')),
    mistakes: jsonList(formData.get('mistakes')),
    tips: text(formData.get('tips')) || null,
    defaultRepMin: Number(text(formData.get('repMin')) || 8),
    defaultRepMax: Number(text(formData.get('repMax')) || 12),
    overlayProfile: (text(formData.get('overlayProfile')) || 'none') as ExerciseInput['overlayProfile'],
  }

  const id = text(formData.get('id'))
  const publish = text(formData.get('publish')) === '1'
  const cropX = Number(text(formData.get('cropX')) || 0.5)

  try {
    if (input.videoMediaId) {
      await setProcessingOptions(actor, input.videoMediaId, { cropX: Math.min(Math.max(cropX, 0), 1) })
    }

    const before = id ? await getExercise(id, { includeDrafts: true }) : null

    const exercise = id
      ? await updateExercise(actor, id, input)
      : await createExercise(actor, input)

    if (publish) {
      await publishExercise(actor, exercise.id)
    }

    revalidatePath('/trainer/exercises')
    revalidatePath('/exercises')

    const returnedToDraft = before?.status === 'published' && exercise.status === 'draft' && !publish

    return {
      error: null,
      id: exercise.id,
      notice: returnedToDraft
        ? 'Упражнение вернулось в черновики: после правки его нельзя показывать клиентам. Опубликуй его снова, когда видео обработается.'
        : null,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось сохранить', id: null }
  }
}

export type DraftExerciseState = { draft: ExerciseDraft | null; error: string | null }

/** Черновик описания от МаксИИма: заполняет поля, Максим правит (этап 4). */
export async function draftExerciseAction(input: {
  name: string
  machine: string | null
  primary: string[]
  secondary: string[]
}): Promise<DraftExerciseState> {
  const { actor } = await requireUser()

  try {
    assertCan(actor, 'catalog.edit')
  } catch {
    return { draft: null, error: 'Недостаточно прав' }
  }

  try {
    const draft = await draftExerciseText({
      name: input.name.trim(),
      machine: input.machine,
      primary: input.primary,
      secondary: input.secondary,
    })
    return { draft, error: null }
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : 'Не удалось получить черновик',
    }
  }
}

export type MachineState = { error: string | null; ok: boolean }

export async function saveMachineAction(
  _prev: MachineState,
  formData: FormData,
): Promise<MachineState> {
  const { actor } = await requireUser()

  try {
    await createMachine(actor, {
      name: text(formData.get('name')),
      zone: text(formData.get('zone')) || null,
      weightStepKg: Number(text(formData.get('weightStepKg')) || 5),
      photoMediaId: null,
    })
    revalidatePath('/trainer/machines')
    return { error: null, ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось сохранить', ok: false }
  }
}

export async function unpublishAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()

  try {
    await unpublishExercise(actor, text(formData.get('id')))
  } catch (error) {
    // Нет прав или упражнения — ничего не меняем; экран просто не обновится.
    console.error('[catalog] unpublish', error instanceof Error ? error.message : error)
    return
  }

  revalidatePath('/trainer/exercises')
  revalidatePath('/exercises')
}
