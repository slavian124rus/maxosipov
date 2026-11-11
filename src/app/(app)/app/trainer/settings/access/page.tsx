import { SettingsPage } from '@/components/trainer/page'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { updateAccessSettings } from '@/modules/access'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'

// Настройки зависят от сессии.
export const instant = false

async function save(formData: FormData): Promise<void> {
  'use server'

  const { actor } = await requireUser()
  const trialDays = Number(String(formData.get('trialDays') ?? ''))
  const priceRaw = String(formData.get('subscriptionPriceRub') ?? '').trim()

  await updateAccessSettings(actor, {
    trialDays,
    subscriptionPriceRub: priceRaw ? Number(priceRaw) : null,
  })

  revalidatePath('/trainer/settings/access')
  redirect('/trainer/settings/access')
}

export default async function AccessSettingsPage() {
  const gym = await getGym()

  return (
    <SettingsPage title="Настройки доступа">
      <form action={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-[15px] text-text-secondary">
          Пробный период, дней
          <input
            name="trialDays"
            type="number"
            min={0}
            max={90}
            defaultValue={gym.settings.trialDays}
            className="h-12 rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
          />
        </label>

        <label className="flex flex-col gap-2 text-[15px] text-text-secondary">
          Цена подписки в месяц, ₽
          <input
            name="subscriptionPriceRub"
            type="number"
            min={0}
            max={100000}
            defaultValue={gym.settings.subscriptionPriceRub ?? ''}
            className="h-12 rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent"
          />
        </label>

        <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
          Сохранить
        </button>
      </form>

      <a
        href="/trainer/subscriptions"
        className="text-[15px] text-accent underline-offset-4 hover:underline"
      >
        К подпискам
      </a>
    </SettingsPage>
  )
}
