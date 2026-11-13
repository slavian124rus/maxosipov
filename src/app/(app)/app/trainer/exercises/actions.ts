'use server'

import { revalidatePath } from 'next/cache'
import {
  archiveExercise,
  createExercise,
  createMachine,
  deleteMachine,
  getExercise,
  listAlternatives,
  listExercises,
  listMachines,
  publishExercise,
  setAlternatives,
  suggestAlternatives,
  unpublishExercise,
  updateExercise,
  updateMachine,
  type AlternativeItem,
  type ExerciseDetail,
  type ExerciseInput,
  type Machine,
} from '@/modules/catalog'
import { requireUser } from '@/modules/auth'
import { draftExerciseText, reviewExercise, reviewExerciseWithAi, type ExerciseAiReview, type ExerciseDraft, type ExerciseIssue } from '@/modules/coach-ai'
import { parseWeightStep } from '@/components/trainer/machine-values'
import { setProcessingOptions } from '@/modules/media'
import { assertCan } from '@/modules/rbac'
import type { MuscleCode } from '@/shared/muscles'
import { readableError } from '@/shared/form-error'

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
    // Пустое поле + keepVideo: видео не трогали, оставляем привязанное (`undefined`).
    videoMediaId:
      text(formData.get('videoMediaId')) ||
      (text(formData.get('id')) && text(formData.get('keepVideo')) === '1' ? undefined : null),
    steps: jsonList(formData.get('steps')),
    mistakes: jsonList(formData.get('mistakes')),
    tips: text(formData.get('tips')) || null,
    defaultRepMin: Number(text(formData.get('repMin')) || 8),
    defaultRepMax: Number(text(formData.get('repMax')) || 12),
    overlayProfile: (text(formData.get('overlayProfile')) ||
      'none') as ExerciseInput['overlayProfile'],
    loadType: (text(formData.get('loadType')) || 'external') as ExerciseInput['loadType'],
  }

  const id = text(formData.get('id'))
  const publish = text(formData.get('publish')) === '1'
  const cropX = Number(text(formData.get('cropX')) || 0.5)

  try {
    if (input.videoMediaId) {
      await setProcessingOptions(actor, input.videoMediaId, {
        cropX: Math.min(Math.max(cropX, 0), 1),
      })
    }

    const before = id ? await getExercise(id, { includeDrafts: true }) : null

    const exercise = id
      ? await updateExercise(actor, id, input)
      : await createExercise(actor, input)

    // «Можно заменить на» едет вместе с общим сохранением, отдельной кнопки у списка нет.
    if (id && formData.has('alternatives')) {
      await setAlternatives(actor, exercise.id, jsonList(formData.get('alternatives')), {
        mirror: text(formData.get('alternativesMirror')) === '1',
      })
    }

    if (publish) {
      await publishExercise(actor, exercise.id)
    }

    revalidatePath('/trainer/exercises')
    revalidatePath('/exercises')

    const returnedToDraft =
      before?.status === 'published' && exercise.status === 'draft' && !publish

    return {
      error: null,
      id: exercise.id,
      notice: returnedToDraft
        ? 'Упражнение вернулось в черновики: после правки его нельзя показывать клиентам. Опубликуй его снова, когда видео обработается.'
        : null,
    }
  } catch (error) {
    return { error: readableError(error, 'Не удалось сохранить'), id: null }
  }
}

export type DraftExerciseState = { draft: ExerciseDraft | null; error: string | null }

/** В окне правки нужны только id, название и тренажёр. */
type AlternativeChoice = {
  id: string
  name: string
  machineName: string | null
  machineId?: string | null
  machineZone?: string | null
}

function toAlternativeItem(item: AlternativeChoice): AlternativeChoice {
  return {
    id: item.id,
    name: item.name,
    machineName: item.machineName,
    machineId: item.machineId ?? null,
    machineZone: item.machineZone ?? null,
  }
}

export type ExerciseLoadState = {
  exercise: ExerciseDetail | null
  machines: Pick<Machine, 'id' | 'name' | 'zone'>[]
  /** Запасные упражнения (`null` — не загрузились) и каталог для добавления. */
  alternatives?: AlternativeChoice[]
  catalog?: AlternativeChoice[]
  error: string | null
}

/**
 * Данные для вкладочного окна правки: упражнение (с черновиками) и список тренажёров.
 * Грузим по требованию, чтобы дерево не тащило в браузер видео и тексты всех упражнений.
 */
export async function loadExerciseAction(id: string): Promise<ExerciseLoadState> {
  const { actor } = await requireUser()

  try {
    assertCan(actor, 'catalog.edit')
  } catch {
    return { exercise: null, machines: [], error: 'Недостаточно прав' }
  }

  try {
    const [exercise, machines, alternatives, published] = await Promise.all([
      getExercise(id, { includeDrafts: true }),
      listMachines(),
      listAlternatives(id),
      listExercises(),
    ])

    if (!exercise) return { exercise: null, machines: [], error: 'Упражнение не найдено' }

    return {
      exercise,
      machines: machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        zone: machine.zone,
      })),
      alternatives: alternatives.map(toAlternativeItem),
      catalog: published.map(toAlternativeItem),
      error: null,
    }
  } catch (error) {
    return {
      exercise: null,
      machines: [],
      error: error instanceof Error ? error.message : 'Не удалось загрузить упражнение',
    }
  }
}
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
    const draft = await draftExerciseText(
      {
        name: input.name.trim(),
        machine: input.machine,
        primary: input.primary,
        secondary: input.secondary,
      },
      { userId: actor.id },
    )
    return { draft, error: null }
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : 'Не удалось получить черновик',
    }
  }
}

export type MachineState = { error: string | null; ok: boolean; id: string | null }

/** Создаёт тренажёр или обновляет существующий (имя, зона, шаг веса, фото). */
export async function saveMachineAction(
  _prev: MachineState,
  formData: FormData,
): Promise<MachineState> {
  const { actor } = await requireUser()

  try {
    const input = {
      name: text(formData.get('name')),
      zone: text(formData.get('zone')) || null,
      weightStepKg: parseWeightStep(text(formData.get('weightStepKg'))),
      photoMediaId: text(formData.get('photoMediaId')) || null,
    }

    const id = text(formData.get('id'))
    const machine = id
      ? await updateMachine(actor, id, input)
      : await createMachine(actor, input)

    revalidatePath('/trainer/machines')
    revalidatePath('/trainer/exercises')
    // Фото тренажёра показывается в каталоге клиента вместо видео.
    revalidatePath('/exercises')

    return { error: null, ok: true, id: machine.id }
  } catch (error) {
    return {
      error: readableError(error, 'Не удалось сохранить тренажёр'),
      ok: false,
      id: null,
    }
  }
}

/** Удаляет тренажёр, занесённый по ошибке (вместе с фото). */
export async function deleteMachineAction(
  _prev: MachineState,
  formData: FormData,
): Promise<MachineState> {
  const { actor } = await requireUser()
  const id = text(formData.get('id'))

  if (!id) return { error: 'Не выбран тренажёр', ok: false, id: null }

  try {
    await deleteMachine(actor, id)
  } catch (error) {
    return {
      error: readableError(error, 'Тренажёр не удалён'),
      ok: false,
      id: null,
    }
  }

  revalidatePath('/trainer/machines')
  revalidatePath('/trainer/exercises')
  // Упражнения без тренажёра показываются в каталоге клиента по фото тренажёра.
  revalidatePath('/exercises')

  return { error: null, ok: true, id }
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

export type ReviewExerciseState = {
  error: string | null
  /** Детерминированные замечания — есть всегда, даже без ИИ. */
  issues: ExerciseIssue[]
  /** Резюме и исправленные поля от МаксИИма; `null` — модель недоступна. */
  review: ExerciseAiReview | null
}

/**
 * Вкладка «МаксИИм» в правке упражнения (DESIGN.md §8.9): проверяет, как заполнена
 * карточка, и предлагает исправления. Ничего не сохраняет — тренер жмёт «Применить»,
 * а потом «Сохранить», так что случайная правка не уйдёт в каталог.
 */
export async function reviewExerciseAction(input: {
  name: string
  machine: string | null
  primary: string[]
  secondary: string[]
  steps: string[]
  mistakes: string[]
  tip: string | null
  repMin: number
  repMax: number
  hasVideo: boolean
  hasPhoto: boolean
}): Promise<ReviewExerciseState> {
  const { actor } = await requireUser()

  try {
    assertCan(actor, 'catalog.edit')
  } catch {
    return { error: 'Недостаточно прав', issues: [], review: null }
  }

  const issues = reviewExercise(input)

  try {
    const review = await reviewExerciseWithAi(input, { userId: actor.id })
    return { error: null, issues, review }
  } catch (error) {
    // Модель недоступна — замечания всё равно полезны, честно говорим об этом.
    console.error('[trainer] МаксИИм не проверил упражнение', error)

    return {
      error: 'МаксИИм сейчас недоступен — ниже замечания, которые проверяются без него',
      issues,
      review: null,
    }
  }
}

export type ArchiveExerciseState = { error: string | null; archived: boolean }
/**
 * Убирает упражнение из каталога в архив (CLAUDE.md, правило 6): история подходов остаётся,
 * вернуть можно только запросом в БД — поэтому в интерфейсе это «удалить».
 */
export async function archiveExerciseAction(
  _prev: ArchiveExerciseState,
  formData: FormData,
): Promise<ArchiveExerciseState> {
  const { actor } = await requireUser()
  const id = text(formData.get('id'))

  if (!id) return { error: 'Не выбрано упражнение', archived: false }

  try {
    await archiveExercise(actor, id)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      error: /[а-яё]/i.test(message) ? message : 'Не удалось удалить упражнение',
      archived: false,
    }
  }

  revalidatePath('/trainer/exercises')
  revalidatePath('/exercises')

  return { error: null, archived: true }
}

/** Подбор по тем же основным мышцам на других тренажёрах. */
export async function suggestAlternativesAction(exerciseId: string): Promise<AlternativeItem[]> {
  const { actor } = await requireUser()
  assertCan(actor, 'catalog.edit')
  return suggestAlternatives(exerciseId, 6)
}
