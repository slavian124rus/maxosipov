'use server'

import { revalidatePath } from 'next/cache'
import { requireClientPage } from '@/components/app/require-client-page'
import { addMeasurement, deleteMeasurement } from '@/modules/body'
import { dayKey } from '@/shared/dates'
import { getGym } from '@/modules/gym'

export type MeasurementState = { error: string | null; saved: boolean }

const INITIAL: MeasurementState = { error: null, saved: false }

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return undefined

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Добавляет замер. Первым делом — охрана страницы и права через сервис. */
export async function addMeasurementAction(
  _prev: MeasurementState,
  formData: FormData,
): Promise<MeasurementState> {
  const { user, actor } = await requireClientPage('/progress')

  const gym = await getGym()
  const date = String(formData.get('date') ?? '').trim() || dayKey(new Date(), gym.timezone)

  try {
    await addMeasurement(actor, user.id, {
      date,
      weightKg: numberOrUndefined(formData.get('weightKg')),
      chestCm: numberOrUndefined(formData.get('chestCm')),
      waistCm: numberOrUndefined(formData.get('waistCm')),
      hipsCm: numberOrUndefined(formData.get('hipsCm')),
      bicepsCm: numberOrUndefined(formData.get('bicepsCm')),
      thighCm: numberOrUndefined(formData.get('thighCm')),
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось сохранить замер', saved: false }
  }

  revalidatePath('/progress')
  revalidatePath('/progress/measurements')

  return { ...INITIAL, saved: true }
}

/** Удаление замера: подтверждение приходит с формы. */
export async function deleteMeasurementAction(formData: FormData): Promise<void> {
  const { user, actor } = await requireClientPage('/progress')
  await deleteMeasurement(actor, user.id, String(formData.get('id') ?? ''))

  revalidatePath('/progress')
  revalidatePath('/progress/measurements')
}