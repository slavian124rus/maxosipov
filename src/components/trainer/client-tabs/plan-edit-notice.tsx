'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { markPlanSeenAction } from '@/app/(app)/app/trainer/clients/actions'

/** «План менял клиент»: тренер подтверждает, что посмотрел правки (откат — в истории ниже). */
export function PlanEditNotice({
  programId,
  clientId,
  editedAt,
}: {
  programId: string
  clientId: string
  editedAt: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function seen() {
    startTransition(async () => {
      const result = await markPlanSeenAction(programId, clientId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-warning/40 bg-surface-1 px-3 py-3">
      <p className="text-[15px]">План менял клиент</p>
      <p className="text-[13px] text-text-muted">
        {new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Asia/Krasnoyarsk',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(editedAt))}
        . Что именно — в истории изменений ниже; последнюю правку можно откатить.
      </p>
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={seen}>
        Просмотрено
      </Button>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  )
}
