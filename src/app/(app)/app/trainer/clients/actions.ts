'use server'

import { revalidatePath } from 'next/cache'
import { addMeasurement } from '@/modules/body'
import { requireUser } from '@/modules/auth'
import { resolveFlag } from '@/modules/coach-ai'
import { addNote } from '@/modules/trainer'
import { formFailure } from '../form-errors'
import { SAVED_FORM_STATE, type FormState } from '../form-state'

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
    await resolveFlag(actor, messageId)
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