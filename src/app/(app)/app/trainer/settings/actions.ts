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
import { AI_TASKS } from '@/shared/ai-tasks'
import { defaultModelName, listProviderModels, pingModel } from '@/modules/coach-ai'
import { assertCan } from '@/modules/rbac'
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


/** Памятка МаксИИма, дневной лимит и цены моделей. */
export async function saveAiSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor } = await requireUser()

  // Модель каждой задачи: выбранная в админке или, если поле пустое, по умолчанию.
  const aiModels: NonNullable<AiSettingsInput['aiModels']> = {}
  const aiPrices: AiSettingsInput['aiPrices'] = {}
  for (const { task, kind } of AI_TASKS) {
    const chosen = text(formData, `model_${task}`)
    aiModels[task] = chosen

    const inPer1k = number(formData, `in_${task}`)
    const outPer1k = number(formData, `out_${task}`)
    const effective = chosen || defaultModelName(kind) || task
    if (inPer1k > 0 || outPer1k > 0) aiPrices[effective] = { inPer1k, outPer1k }
  }

  try {
    await updateAiSettings(actor, {
      aiMemo: text(formData, 'aiMemo'),
      aiDailyLimit: Math.round(number(formData, 'aiDailyLimit')),
      aiPrices,
      aiModels,
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
/** «Проверить»: короткий вызов модели — ответ и время или причина ошибки. */
export async function testModelAction(
  modelId: string,
): Promise<{ ok: true; ms: number; text: string } | { ok: false; ms: number; error: string }> {
  const { actor } = await requireUser()
  assertCan(actor, 'settings.ai')

  const id = modelId.trim()
  if (!id) return { ok: false, ms: 0, error: 'Укажи id модели' }
  return pingModel(id)
}

/** «Модели провайдера»: список id, если провайдер его отдаёт. */
export async function listModelsAction(): Promise<{ models: string[]; error: string | null }> {
  const { actor } = await requireUser()
  assertCan(actor, 'settings.ai')

  try {
    return { models: await listProviderModels(), error: null }
  } catch (error) {
    return {
      models: [],
      error: error instanceof Error ? error.message : 'Не удалось получить список. Впиши id вручную',
    }
  }
}
