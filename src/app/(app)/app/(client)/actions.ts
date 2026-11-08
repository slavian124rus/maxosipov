'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { copyTemplateToClient } from '@/modules/training'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'

/** Клиент берёт шаблон себе (DESIGN.md §8.1: «Выбрать шаблон»). */
export async function copyTemplateAction(formData: FormData): Promise<void> {
  const { user, actor } = await requireClientPage('/')
  const templateId = String(formData.get('templateId') ?? '')

  if (!templateId) return

  await copyTemplateToClient(actor, templateId, user.id, user.gymId)
  revalidatePath('/')
  redirect('/workout')
}

/** Переключатель режима тренировки в профиле. */
export async function setWorkoutModeAction(formData: FormData): Promise<void> {
  const { user } = await requireClientPage('/profile')
  const mode = String(formData.get('mode') ?? '')

  if (mode !== 'free' && mode !== 'guided') return

  await db.update(users).set({ workoutMode: mode, updatedAt: new Date() }).where(eq(users.id, user.id))
  revalidatePath('/profile')
}