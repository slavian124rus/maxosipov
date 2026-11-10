import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { saveContactsAction } from '../actions'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function ContactsSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'settings.brand')) notFound()

  const gym = await getGym()

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Контакты</h1>
      <p className="text-[13px] text-text-muted">
        Телефон показывается клиенту на экране «Подписка закончилась» и в кнопке «Позвонить».
      </p>

      <ActionForm action={saveContactsAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[15px] text-text">
          Телефон Максима
          <input
            name="phone"
            inputMode="tel"
            defaultValue={gym.settings.contacts?.phone ?? ''}
            placeholder="+7 999 000-00-00"
            className="h-12 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
          Сохранить
        </button>
      </ActionForm>
    </main>
  )
}