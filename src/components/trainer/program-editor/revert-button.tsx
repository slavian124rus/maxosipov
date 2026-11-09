'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { revertChangeAction } from '@/app/(app)/app/trainer/programs/actions'

/** «Откатить» изменение МаксИИма: работает только для последнего изменения. */
export function RevertButton({
  changeId,
  clientId,
}: {
  changeId: string
  clientId?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function revert(): void {
    setError(null)
    startTransition(async () => {
      const result = await revertChangeAction({ changeId, clientId })
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={revert}>
        {pending ? 'Откатываем…' : 'Откатить'}
      </Button>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  )
}