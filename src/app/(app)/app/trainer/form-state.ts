/** Результат серверного действия формы: ошибка показывается под формой, а не теряется в логе. */
export type FormState = { error: string | null; saved: boolean }

export const INITIAL_FORM_STATE: FormState = { error: null, saved: false }

export const SAVED_FORM_STATE: FormState = { error: null, saved: true }
