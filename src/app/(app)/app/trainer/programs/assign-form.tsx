'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { assignTemplateAction } from './actions'

export type ClientOption = { id: string; name: string }

/** «Назначить клиентам»: мультивыбор и выдача копии шаблона (DESIGN.md §8.9). */
export function AssignClientsForm({
  templateId,
  clients,
}: {
  templateId: string
  clients: ClientOption[]
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(id: string): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function submit(): void {
    setMessage(null)
    startTransition(async () => {
      const result = await assignTemplateAction({ templateId, clientIds: selected })
      if (result.error) setMessage(result.error)
      else {
        setMessage('Шаблон назначен')
        setSelected([])
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(!open)}>
        {open ? 'Скрыть' : 'Назначить клиентам'}
      </Button>

      {open ? (
        <div className="flex flex-col gap-2">
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {clients.map((client) => (
              <label key={client.id} className="flex min-h-11 items-center gap-2 text-[15px] text-text">
                <input
                  type="checkbox"
                  checked={selected.includes(client.id)}
                  onChange={() => toggle(client.id)}
                  className="h-5 w-5"
                />
                {client.name}
              </label>
            ))}
          </div>
          <Button type="button" disabled={pending || selected.length === 0} onClick={submit}>
            {pending ? 'Назначаем…' : `Назначить (${selected.length})`}
          </Button>
        </div>
      ) : null}

      {message ? <p className="text-[13px] text-text-secondary">{message}</p> : null}
    </div>
  )
}