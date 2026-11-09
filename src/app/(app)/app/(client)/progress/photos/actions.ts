'use server'

import { revalidatePath } from 'next/cache'
import { requireClientPage } from '@/components/app/require-client-page'
import { addProgressPhoto, deleteProgressPhoto } from '@/modules/body'
import { getGym } from '@/modules/gym'
import { dayKey } from '@/shared/dates'

export type PhotoState = { error: string | null; saved: boolean }

const INITIAL: PhotoState = { error: null, saved: false }

function isPose(value: string): value is 'front' | 'side' | 'back' {
  return value === 'front' || value === 'side' || value === 'back'
}

/** Привязывает загруженное фото к дню и позе. Первым делом — охрана страницы. */
export async function addProgressPhotoAction(
  _prev: PhotoState,
  formData: FormData,
): Promise<PhotoState> {
  const { user, actor } = await requireClientPage('/progress')

  const mediaId = String(formData.get('mediaId') ?? '').trim()
  const pose = String(formData.get('pose') ?? '')
  const gym = await getGym()
  const date = String(formData.get('date') ?? '').trim() || dayKey(new Date(), gym.timezone)

  if (!mediaId) return { error: 'Сначала загрузи фото', saved: false }
  if (!isPose(pose)) return { error: 'Выбери позу', saved: false }

  try {
    await addProgressPhoto(actor, user.id, { date, pose, mediaId })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось добавить фото', saved: false }
  }

  revalidatePath('/progress')
  revalidatePath('/progress/photos')

  return { ...INITIAL, saved: true }
}

export async function deleteProgressPhotoAction(formData: FormData): Promise<void> {
  const { user, actor } = await requireClientPage('/progress')
  await deleteProgressPhoto(actor, user.id, String(formData.get('id') ?? ''))

  revalidatePath('/progress')
  revalidatePath('/progress/photos')
}