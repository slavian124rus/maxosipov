'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/modules/auth'
import {
  updateAiSettings,
  updateBrand,
  updateContacts,
  updateProgressionRules,
  type AiSettingsInput,
} from '@/modules/gym'
import { PERMISSIONS, type Permission, type RolePermission } from '@/modules/rbac'
import { assignRole, createRole, setClientTrainer, updateRole } from '@/modules/rbac'
import { env } from '@/shared/env'
import { formFailure } from '../form-errors'
import { SAVED_FORM_STATE, type FormState } from '../form-state'

const PAGE = '/trainer/settings'

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

function number(formData: FormData, name: string): number {
  const parsed = Number(text(formData, name).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function modelName(kind: 'main' | 'fast' | 'fallback'): string {
  if (kind === 'main') return env.AI_MODEL_MAIN ?? 'main'
  if (kind === 'fast') return env.AI_MODEL_FAST ?? 'fast'
  return env.AI_MODEL_FALLBACK ?? 'fallback'
}

/** Памятка МаксИИма, дневной лимит и цены моделей. */
export async function saveAiSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  const aiPrices: AiSettingsInput['aiPrices'] = {}
  for (const kind of ['main', 'fast', 'fallback'] as const) {
    const inPer1k = number(formData, `in_${kind}`)
    const outPer1k = number(formData, `out_${kind}`)
    if (inPer1k > 0 || outPer1k > 0) aiPrices[modelName(kind)] = { inPer1k, outPer1k }
  }

  try {
    await updateAiSettings(actor, {
      aiMemo: text(formData, 'aiMemo'),
      aiDailyLimit: Math.round(number(formData, 'aiDailyLimit')),
      aiPrices,
    })
  } catch (error) {
    return formFailure(error, 'Не удалось сохранить настройки МаксИИма')
  }

  revalidatePath(PAGE)
  return SAVED_FORM_STATE
}

/** Правила прогрессии весов. */
export async function saveProgressionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  try {
    await updateProgressionRules(actor, {
      sessionsToIncrease: Math.round(number(formData, 'sessionsToIncrease')),
      fastTrackOnEasy: formData.get('fastTrackOnEasy') === 'on',
      failSessionsToDrop: Math.round(number(formData, 'failSessionsToDrop')),
      dropPercent: Math.round(number(formData, 'dropPercent')),
    })
  } catch (error) {
    return formFailure(error, 'Не удалось сохранить правила прогрессии')
  }

  revalidatePath(PAGE)
  return SAVED_FORM_STATE
}

/** Бренд: название, короткое имя, акцентный цвет. */
export async function saveBrandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  try {
    await updateBrand(actor, {
      name: text(formData, 'name'),
      shortName: text(formData, 'shortName'),
      accent: text(formData, 'accent'),
      logoMediaId: null,
    })
  } catch (error) {
    return formFailure(error, 'Не удалось сохранить бренд')
  }

  revalidatePath(PAGE)
  return SAVED_FORM_STATE
}

/** Контакты Максима для экрана «Продли у Максима». */
export async function saveContactsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  try {
    await updateContacts(actor, {
      phone: text(formData, 'phone') || null,
      photoMediaId: null,
    })
  } catch (error) {
    return formFailure(error, 'Не удалось сохранить контакты')
  }

  revalidatePath(PAGE)
  return SAVED_FORM_STATE
}

function permissionsFrom(formData: FormData): RolePermission[] {
  const result: RolePermission[] = []

  for (const code of PERMISSIONS) {
    const value = formData.get(`perm_${code}`)
    if (value === 'all') result.push({ code: code as Permission, scope: 'all' })
    else if (value === 'own') result.push({ code: code as Permission, scope: 'own' })
  }

  return result
}

/** Создание или правка роли (право `roles.manage`). */
export async function saveRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()
  const id = text(formData, 'id')
  const name = text(formData, 'name')
  const permissions = permissionsFrom(formData)

  try {
    if (id) await updateRole(actor, id, { name, permissions })
    else await createRole(actor, { name, permissions })
  } catch (error) {
    return formFailure(error, 'Не удалось сохранить роль')
  }

  revalidatePath('/trainer/settings/roles')
  if (id) revalidatePath(`/trainer/settings/roles/${id}`)
  return SAVED_FORM_STATE
}

/** Смена роли человеку (право `users.assign_roles`). */
export async function assignRoleAction(formData: FormData): Promise<void> {
  const { actor } = await requireUser()

  try {
    await assignRole(actor, text(formData, 'userId'), text(formData, 'roleId'))
  } catch (error) {
    console.error('[settings] роль не назначена', error)
  }

  revalidatePath('/trainer/settings/people')
}

export type AssignState = { error: string | null }

/** То же, но с текстом ошибки в интерфейсе («Нельзя снять последнего владельца»). */
export async function assignRoleFormAction(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const { actor } = await requireUser()

  try {
    await assignRole(actor, text(formData, 'userId'), text(formData, 'roleId'))
  } catch (error) {
    return { error: formFailure(error, 'Не удалось сменить роль').error }
  }

  revalidatePath('/trainer/settings/people')
  return { error: null }
}

/** Привязка клиента к тренеру. */
export async function setTrainerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  try {
    const trainerId = text(formData, 'trainerId')
    await setClientTrainer(actor, text(formData, 'clientId'), trainerId || null)
  } catch (error) {
    return formFailure(error, 'Не удалось назначить тренера')
  }

  revalidatePath('/trainer/settings/people')
  return SAVED_FORM_STATE
}