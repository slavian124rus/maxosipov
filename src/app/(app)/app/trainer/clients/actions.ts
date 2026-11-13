'use server'

import { revalidatePath } from 'next/cache'
import { addMeasurement } from '@/modules/body'
import { requireUser } from '@/modules/auth'
import { resolveFlag } from '@/modules/coach-ai'
import { addNote, updateClientName } from '@/modules/trainer'
import { markClientEditSeen } from '@/modules/training'
import { formFailure } from '../form-errors'
import { SAVED_FORM_STATE, type FormState } from '../form-state'

/**
 * Тренер или владелец правит имя клиента в карточке (DESIGN.md §8.9):
 * в списке клиентов видно имя, а не «Без имени».
 */
export async function renameClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()
  const clientId = String(formData.get('clientId') ?? '')
  const name = String(formData.get('name') ?? '')

  if (!clientId) return { error: 'Не выбран клиент', saved: false }

  try {
    await updateClientName(actor, clientId, name)
  } catch (error) {
    return formFailure(error, 'Имя не сохранено')
  }

  revalidatePath(`/trainer/clients/${clientId}`)
  revalidatePath('/trainer/clients')
  revalidatePath('/trainer')
  return SAVED_FORM_STATE
}

/** Заметка тренера о клиенте; «показать клиенту» — галочка в форме. */
export async function addNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()
  const clientId = String(formData.get('clientId') ?? '')
  const text = String(formData.get('text') ?? '')
  const visibleToClient = formData.get('visible') === 'on'

  if (!clientId) return { error: 'Не выбран клиент', saved: false }

  try {
    await addNote(actor, clientId, { text, visibleToClient })
  } catch (error) {
    return formFailure(error, 'Заметка не сохранена')
  }

  revalidatePath(`/trainer/clients/${clientId}`)
  return SAVED_FORM_STATE
}

/** «Разобрался» на карточке клиента: жалоба уходит из ленты и из вкладки. */
export async function resolveClientFlagAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const messageId = String(formData.get('id') ?? '')
  const clientId = String(formData.get('clientId') ?? '')
  if (!messageId) return

  try {
    await resolveFlag(actor, messageId, String(formData.get('note') ?? ''))
  } catch (error) {
    console.error('[trainer] не удалось разобрать жалобу', error)
  }

  revalidatePath('/trainer')
  if (clientId) revalidatePath(`/trainer/clients/${clientId}`)
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/** Замер, который тренер вносит за клиента (право `clients.measurements`). */
export async function addTrainerMeasurementAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()
  const clientId = String(formData.get('clientId') ?? '')
  const date = String(formData.get('date') ?? '')

  if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return

  try {
    await addMeasurement(actor, clientId, {
      date,
      weightKg: optionalNumber(formData.get('weightKg')),
      waistCm: optionalNumber(formData.get('waistCm')),
    })
  } catch (error) {
    console.error('[trainer] замер не сохранён', error)
  }

  revalidatePath(`/trainer/clients/${clientId}`)
}
/** «Просмотрено»: тренер увидел, что клиент поменял свой план. */
export async function markPlanSeenAction(programId: string, clientId: string): Promise<{ error: string | null }> {
  const { actor } = await requireUser()

  try {
    await markClientEditSeen(actor, programId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось отметить' }
  }

  revalidatePath(`/trainer/clients/${clientId}`)
  revalidatePath('/trainer/clients')
  return { error: null }
}
