'use client'

import { useActionState, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { INITIAL_FORM_STATE } from '@/app/(app)/app/trainer/form-state'
import { renameClientAction } from '@/app/(app)/app/trainer/clients/actions'

/**
 * Имя клиента в карточке тренера: по умолчанию просто текст с карандашом,
 * по касанию — поле и «Сохранить». Клиенты часто регистрируются «без имени».
 */
export function ClientNameEditor({ clientId, name }: { clientId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(renameClientAction, INITIAL_FORM_STATE)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Изменить имя клиента"
        className="flex min-w-0 items-center gap-1.5 text-left"
      >
        <span className="truncate text-[15px] text-text">{name || 'Без имени'}</span>
        <Pencil size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
      </button>
    )
  }

  // После сохранения сервер присылает новое имя, а форма показывает «Сохранено»
  // и кнопку «Готово» — так не нужен эффект, который закрывал бы её сам.
  if (state.saved) {
    return (
      <div className="flex flex-col gap-2">
        <span className="truncate text-[15px] text-text">{name || 'Без имени'}</span>
        <p role="status" className="text-[13px] text-success">
          Сохранено
        </p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-10 w-fit rounded-control border border-border px-3 text-[15px] text-text-secondary"
        >
          Готово
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Input
        name="name"
        defaultValue={name}
        placeholder="Как зовут клиента"
        aria-label="Имя клиента"
        autoFocus
        required
        minLength={2}
        maxLength={60}
        className="h-10"
      />

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 flex-1 rounded-control bg-accent px-3 text-[15px] text-white disabled:opacity-60"
        >
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-10 rounded-control border border-border px-3 text-[15px] text-text-secondary"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}