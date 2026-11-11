import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { ActionForm } from '@/components/trainer/action-form'
import { saveBrandAction } from '../actions'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function BrandSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'settings.brand')) notFound()

  const gym = await getGym()

  return (
    <SettingsPage title="Бренд">
      <p className="text-[13px] text-text-muted">
        Название и цвет берутся из настроек — при смене бренда код менять не нужно.
      </p>

      <ActionForm action={saveBrandAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[15px] text-text">
          Название
          <input
            name="name"
            defaultValue={gym.brand.name}
            className="h-12 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-[15px] text-text">
          Короткое имя
          <input
            name="shortName"
            defaultValue={gym.brand.shortName}
            className="h-12 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-[15px] text-text">
          Акцентный цвет
          <input
            name="accent"
            defaultValue={gym.brand.colors.accent}
            pattern="^#[0-9a-fA-F]{6}$"
            className="h-12 w-40 rounded-control border border-border bg-bg px-3 font-display text-[15px] text-text"
          />
        </label>

        <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
          Сохранить
        </button>
      </ActionForm>
    </SettingsPage>
  )
}