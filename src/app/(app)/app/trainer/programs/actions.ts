'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import {
  applyProgramPatchAs,
  assignTemplate,
  createTemplate,
  revertChange,
  saveAsTemplate,
  type ProgramPatch,
} from '@/modules/training'

export type ActionResult = { error: string | null; id?: string }

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
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

/** Новый пустой шаблон (форма на экране «Программы»). */
export async function createTemplateAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return

  try {
    await createTemplate(actor, name, actor.gymId)
  } catch (error) {
    console.error('[trainer] шаблон не создан', error)
  }

  revalidatePath('/trainer/programs')
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