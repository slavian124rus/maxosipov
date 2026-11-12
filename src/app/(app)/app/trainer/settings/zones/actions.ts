'use server'

import { revalidatePath } from 'next/cache'
import { createZone, deleteZone, renameZone } from '@/modules/catalog'
import { requireUser } from '@/modules/auth'
import { readableError } from '@/shared/form-error'

const PAGE = '/trainer/settings/zones'

export type ZoneState = { error: string | null; saved: boolean }

const INITIAL: ZoneState = { error: null, saved: false }

/** Обновляем и настройки зон, и дерево тренажёров: зона — часть группировки. */
function revalidateZones(): void {
  revalidatePath(PAGE)
  revalidatePath('/trainer/machines')
  revalidatePath('/trainer/exercises')
}

/** Новая зона тренажёров (DESIGN.md §8.9, «Зоны»). */
export async function createZoneAction(_prev: ZoneState, formData: FormData): Promise<ZoneState> {
  const { actor } = await requireUser()
  const name = String(formData.get('name') ?? '')

  try {
    await createZone(actor, name)
  } catch (error) {
    return { error: readableError(error, 'Зона не создана'), saved: false }
  }

  revalidateZones()
  return { error: null, saved: true }
}

/** Переименование зоны: обновляет и тренажёры этой зоны. */
export async function renameZoneAction(_prev: ZoneState, formData: FormData): Promise<ZoneState> {
  const { actor } = await requireUser()
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '')

  if (!id) return { ...INITIAL, error: 'Зона не выбрана' }

  try {
    await renameZone(actor, id, name)
  } catch (error) {
    return { error: readableError(error, 'Зона не переименована'), saved: false }
  }

  revalidateZones()
  return { error: null, saved: true }
}

/** Удаление пустой зоны; зону с тренажёрами удалить нельзя. */
export async function deleteZoneAction(_prev: ZoneState, formData: FormData): Promise<ZoneState> {
  const { actor } = await requireUser()
  const id = String(formData.get('id') ?? '')

  if (!id) return { ...INITIAL, error: 'Зона не выбрана' }

  try {
    await deleteZone(actor, id)
  } catch (error) {
    return { error: readableError(error, 'Зона не удалена'), saved: false }
  }

  revalidateZones()
  return { error: null, saved: true }
}
