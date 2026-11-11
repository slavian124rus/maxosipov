'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { saveProfileDetails, updateUserName, type ProfileDetailsInput } from '@/modules/auth'
import { copyTemplateToClient } from '@/modules/training'
import { db } from '@/shared/db'
import { users } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'

/** Результат формы профиля: ошибка или «Сохранено». */
export type ProfileFormState = { error: string | null; saved: boolean }

function asNumber(value: FormDataEntryValue | null): number {
  return Number(String(value ?? '').replace(',', '.'))
}

/** Клиент правит имя и анкету в профиле (DESIGN.md §8.1). */
export async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user } = await requireClientPage('/profile')

  const input: ProfileDetailsInput = {
    name: String(formData.get('name') ?? ''),
    sex: String(formData.get('sex') ?? '') as ProfileDetailsInput['sex'],
    birthYear: asNumber(formData.get('birthYear')),
    heightCm: asNumber(formData.get('heightCm')),
    weightKg: asNumber(formData.get('weightKg')),
    goal: String(formData.get('goal') ?? '') as ProfileDetailsInput['goal'],
    experience: String(formData.get('experience') ?? '') as ProfileDetailsInput['experience'],
    sessionsPerWeek: asNumber(formData.get('sessionsPerWeek')),
    limitations: String(formData.get('limitations') ?? '').trim() || null,
    healthConsent: formData.get('healthConsent') === 'on',
  }

  try {
    // Анкета необязательна: человек может поправить только имя, не заполняя остальное.
    const filled = input.birthYear > 0 && input.heightCm > 0 && input.weightKg > 0

    if (filled) {
      await saveProfileDetails(user.id, input)
    } else {
      await updateUserName(user.id, input.name)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Показываем только понятные русские тексты, остальное — общей фразой.
    return {
      error: /[а-яё]/i.test(message) ? message.split('\n')[0]! : 'Проверь данные — что-то заполнено неверно',
      saved: false,
    }
  }

  revalidatePath('/profile')
  revalidatePath('/trainer/clients')
  revalidatePath(`/trainer/clients/${user.id}`)
  return { error: null, saved: true }
}

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