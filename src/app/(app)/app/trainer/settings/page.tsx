import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { PageHeader, Panel, TrainerPage } from '@/components/trainer/page'
import { PushOptIn } from '@/components/app/push-opt-in'
import { settingsGroups } from '@/components/trainer/nav-items'
import { settingsNavItems } from '@/components/trainer/nav-config'
import { env } from '@/shared/env'

// Меню «Ещё» зависит от сессии и прав.
export const instant = false

export default async function TrainerSettingsPage() {
  const { user, actor } = await requireUser()

  const groups = settingsGroups(settingsNavItems(actor))

  return (
    <TrainerPage>
      <PageHeader
        title="Ещё"
        description="Настройки зала, доступ и люди — всё, что не на первом экране"
      />

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="text-[13px] tracking-wide text-text-muted uppercase">{group.title}</h2>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-16 flex-col justify-center gap-0.5 rounded-card border border-border bg-surface-1 px-4 py-3 hover:border-accent/60 hover:bg-surface-2/40"
                >
                  <span className="text-[15px] text-text">{item.label}</span>
                  <span className="text-[13px] text-text-muted">{item.description}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <Panel title="Приложение клиента">
          <p className="text-[13px] text-text-muted">
            Твой собственный дневник — там же, где у клиентов: {user.name}.
          </p>
          <a
            href={env.APP_URL}
            className="flex min-h-11 w-fit items-center rounded-control border border-dashed border-border px-4 text-[15px] text-text-secondary hover:text-text"
          >
            Мои тренировки
          </a>
        </Panel>

        <div className="lg:max-w-[560px]">
          <PushOptIn vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null} />
        </div>
      </div>
    </TrainerPage>
  )
}
