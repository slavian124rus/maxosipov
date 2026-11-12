'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import {
  draftProgramTemplate,
  reviewTemplate,
  reviewTemplateWithAi,
  type TemplateAiReview,
  type TemplateBrief,
  type TemplateCatalogItem,
  type TemplateDraft,
  type TemplateIssue,
  type ReviewDay,
} from '@/modules/coach-ai'
import {
  applyProgramPatchAs,
  archiveTemplate,
  assignTemplate,
  createTemplate,
  getProgramTree,
  replaceTemplateDays,
  revertChange,
  saveAsTemplate,
  updateTemplateMeta,
  type ProgramAudience,
  type ProgramGoal,
  type ProgramPatch,
} from '@/modules/training'
import { readableError } from '@/shared/form-error'

export type ActionResult = { error: string | null; id?: string }

function message(error: unknown, fallback: string): string {
  return readableError(error, fallback)
}

/**
 * Одно действие редактора — один патч (DESIGN.md §8.9). Кнопки «Сохранить» нет:
 * каждое изменение сразу уходит в программу и в историю.
 */
export async function patchProgramAction(input: {
  programId: string
  patch: ProgramPatch
  clientId?: string | null
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await applyProgramPatchAs(actor, input.programId, input.patch, 'trainer')
  } catch (error) {
    return { error: message(error, 'Не удалось сохранить') }
  }

  revalidatePath('/trainer/programs')
  revalidatePath(`/trainer/programs/${input.programId}`)
  if (input.clientId) revalidatePath(`/trainer/clients/${input.clientId}`)

  return { error: null }
}

/** «Откатить» изменение МаксИИма: только последнее изменение программы. */
export async function revertChangeAction(input: {
  changeId: string
  clientId?: string | null
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await revertChange(actor, input.changeId)
  } catch (error) {
    return { error: message(error, 'Не удалось откатить') }
  }

  if (input.clientId) revalidatePath(`/trainer/clients/${input.clientId}`)
  return { error: null }
}

/** «Сохранить как шаблон» из редактора. */
export async function saveAsTemplateAction(input: {
  programId: string
  name: string
  clientId?: string | null
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    const id = await saveAsTemplate(actor, input.programId, input.name)
    revalidatePath('/trainer/programs')
    if (input.clientId) revalidatePath(`/trainer/clients/${input.clientId}`)
    return { error: null, id }
  } catch (error) {
    return { error: message(error, 'Не удалось сохранить шаблон') }
  }
}

/** Новый шаблон из модального окна: имя, для кого, цель и сколько дней сразу. */
export type CreateTemplateState = { error: string | null; id: string | null }

export async function createTemplateAction(
  _prev: CreateTemplateState,
  formData: FormData,
): Promise<CreateTemplateState> {
  const { actor } = await requireUser()

  const audienceRaw = String(formData.get('audience') ?? '')
  const goalRaw = String(formData.get('goal') ?? '')
  const daysRaw = Number(String(formData.get('days') ?? '0'))

  try {
    const id = await createTemplate(actor, {
      name: String(formData.get('name') ?? ''),
      audience: audienceRaw ? (audienceRaw as ProgramAudience) : null,
      goal: goalRaw ? (goalRaw as ProgramGoal) : null,
      days: Number.isFinite(daysRaw) ? daysRaw : 0,
    })

    revalidatePath('/trainer/programs')
    return { error: null, id }
  } catch (error) {
    return { error: message(error, 'Шаблон не создан'), id: null }
  }
}

/** Правка названия, аудитории и цели шаблона из карточки. */
export async function updateTemplateMetaAction(input: {
  templateId: string
  name: string
  audience: ProgramAudience | null
  goal: ProgramGoal | null
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await updateTemplateMeta(actor, input.templateId, {
      name: input.name,
      audience: input.audience,
      goal: input.goal,
    })
  } catch (error) {
    return { error: message(error, 'Шаблон не сохранён') }
  }

  revalidatePath('/trainer/programs')
  revalidatePath(`/trainer/programs/${input.templateId}`)
  return { error: null }
}

/** Удаление шаблона: уходит в архив, выданные клиентам копии остаются. */
export async function archiveTemplateAction(templateId: string): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await archiveTemplate(actor, templateId)
  } catch (error) {
    return { error: message(error, 'Шаблон не удалён') }
  }

  revalidatePath('/trainer/programs')
  return { error: null }
}

/** Каталог для помощника: только опубликованные упражнения с зоной и мышцами. */
async function templateCatalog(): Promise<TemplateCatalogItem[]> {
  const items = await listExercises({ status: 'published' })

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    zone: item.machineZone,
    machine: item.machineName,
    primary: item.primaryMuscles,
  }))
}

export type DraftTemplateState = {
  error: string | null
  draft: TemplateDraft | null
  issues: TemplateIssue[]
  review: TemplateAiReview | null
}

/** МаксИИм собирает шаблон по брифу: дни и упражнения из каталога зала. */
export async function draftTemplateAction(input: {
  brief: TemplateBrief
}): Promise<DraftTemplateState> {
  const { actor } = await requireUser()

  try {
    const catalog = await templateCatalog()
    const draft = await draftProgramTemplate(input.brief, catalog, { userId: actor.id })
    const issues = reviewTemplate(draft.days, catalog)

    // Словесный разбор — приятный бонус: без модели показываем только замечания.
    const review = await reviewTemplateWithAi(draft.days, catalog, { userId: actor.id }).catch(
      () => null,
    )

    return { error: null, draft, issues, review }
  } catch (error) {
    return { error: message(error, 'МаксИИм не смог собрать шаблон'), draft: null, issues: [], review: null }
  }
}

/** Проверка уже сохранённого шаблона: замечания по дням и разбор словами. */
export async function reviewTemplateAction(input: {
  templateId: string
}): Promise<DraftTemplateState> {
  const { actor } = await requireUser()

  try {
    const tree = await getProgramTree(input.templateId)
    if (!tree) throw new Error('Шаблон не найден')

    const catalog = await templateCatalog()
    const days: ReviewDay[] = tree.days.map((day) => ({
      name: day.name,
      exercises: day.exercises.map((item) => ({
        exerciseId: item.exerciseId,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        restSec: item.restSec,
      })),
    }))

    const issues = reviewTemplate(days, catalog)
    const review = await reviewTemplateWithAi(days, catalog, { userId: actor.id }).catch(() => null)

    return { error: null, draft: null, issues, review }
  } catch (error) {
    return { error: message(error, 'Не удалось проверить шаблон'), draft: null, issues: [], review: null }
  }
}

/** Применяет собранный МаксИИмом шаблон: дни заменяются целиком. */
export async function applyTemplateDraftAction(input: {
  templateId: string
  days: TemplateDraft['days']
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await replaceTemplateDays(actor, input.templateId, input.days)
  } catch (error) {
    return { error: message(error, 'Шаблон не обновлён') }
  }

  revalidatePath('/trainer/programs')
  revalidatePath(`/trainer/programs/${input.templateId}`)
  return { error: null }
}

/** «Назначить клиентам»: каждому — активная копия шаблона. */
export async function assignTemplateAction(input: {
  templateId: string
  clientIds: string[]
}): Promise<ActionResult> {
  const { actor } = await requireUser()

  try {
    await assignTemplate(actor, input.templateId, input.clientIds)
  } catch (error) {
    return { error: message(error, 'Не удалось назначить шаблон') }
  }

  revalidatePath('/trainer/programs')
  return { error: null }
}