/**
 * Состояние формы заявки. Живёт отдельно от `actions.ts`: модуль с `'use server'`
 * может экспортировать только асинхронные функции (тот же приём, что в
 * `app/(app)/app/trainer/form-state.ts`).
 */
export type LeadFormState = {
  /** Заявка принята: показываем «Готово!» вместо формы. */
  done: boolean
  error: string | null
  /** Значения возвращаем в поля, чтобы при ошибке человек не вводил их заново. */
  name: string
  phone: string
  consent: boolean
}

export const INITIAL_LEAD_STATE: LeadFormState = {
  done: false,
  error: null,
  name: '',
  phone: '',
  consent: false,
}
