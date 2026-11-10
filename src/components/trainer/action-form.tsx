'use client'

import { useActionState, type ReactNode } from 'react'
import {
  INITIAL_FORM_STATE,
  type FormState,
} from '@/app/(app)/app/trainer/form-state'

type Props = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>
  className?: string
  children: ReactNode
}

/**
 * Форма кабинета с обратной связью: «Сохранено» или текст ошибки под полями.
 * Серверные действия возвращают `FormState`, а не молча пишут ошибку в лог.
 */
export function ActionForm({ action, className, children }: Props) {
  const [state, formAction] = useActionState(action, INITIAL_FORM_STATE)

  return (
    <form action={formAction} className={className}>
      {children}

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : state.saved ? (
        <p role="status" className="text-[13px] text-success">
          Сохранено
        </p>
      ) : null}
    </form>
  )
}
