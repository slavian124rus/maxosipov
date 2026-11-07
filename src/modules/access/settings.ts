import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getGym, gyms } from '@/modules/gym'
import { assertCan, type Actor } from '@/modules/rbac'
import { db } from '@/shared/db'

export const accessSettingsSchema = z.object({
  trialDays: z.number().int().min(0).max(90),
  subscriptionPriceRub: z.number().int().min(0).max(100000).nullable(),
})

export type AccessSettingsInput = z.infer<typeof accessSettingsSchema>

/**
 * Настройки доступа: длительность пробного периода и цена подписки.
 * Требует права `subscriptions.pricing`.
 */
export async function updateAccessSettings(
  actor: Actor,
  input: AccessSettingsInput,
): Promise<void> {
  assertCan(actor, 'subscriptions.pricing')

  const data = accessSettingsSchema.parse(input)
  const gym = await getGym()

  await db
    .update(gyms)
    .set({
      settings: {
        ...gym.settings,
        trialDays: data.trialDays,
        subscriptionPriceRub: data.subscriptionPriceRub,
      },
      updatedAt: new Date(),
    })
    .where(eq(gyms.id, gym.id))
}
