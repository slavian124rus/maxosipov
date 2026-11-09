import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { can, listAudit } from '@/modules/rbac'

// Журнал зависит от сессии и прав.
export const instant = false

const ACTIONS: Record<string, string> = {
  'role.create': 'создал роль',
  'role.update': 'изменил роль',
  'role.delete': 'удалил роль',
  'role.assign': 'сменил роль',
  'trainer.assign': 'назначил тренера',
}

export default async function AuditPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'roles.manage')) notFound()

  const items = await listAudit(actor)

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Журнал</h1>

      {items.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Изменений прав пока не было</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-2">
            <p className="text-[15px] text-text">
              {item.actorName} {ACTIONS[item.action] ?? item.action}
              {item.targetName ? `: ${item.targetName}` : ''}
            </p>
            <p className="text-[13px] text-text-muted">
              {new Intl.DateTimeFormat('ru-RU', {
                timeZone: 'Asia/Krasnoyarsk',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              }).format(item.createdAt)}
            </p>
          </div>
        ))
      )}
    </main>
  )
}