import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { AI_TASKS } from '@/shared/ai-tasks'
import { defaultModelName } from '@/modules/coach-ai'
import { ModelRow, ProviderModels } from '@/components/trainer/settings/model-row'
import { MemoField } from '@/components/trainer/settings/memo-field'
import { ActionForm } from '@/components/trainer/action-form'
import { saveAiSettingsAction } from '../actions'

// Настройки зависят от сессии и прав.
export const instant = false

export default async function AiSettingsPage() {
  const { actor } = await requireUser()
  if (!can(actor, 'settings.ai')) notFound()

  const gym = await getGym()
  const prices = gym.settings.aiPrices ?? {}

  return (
    <SettingsPage title="МаксИИм">
      <ActionForm action={saveAiSettingsAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-text">Памятка МаксИИма</p>
          <p className="text-[13px] text-text-muted">
            Попадает в инструкцию МаксИИма: правила зала, как ты работаешь с клиентами.
          </p>
          <MemoField defaultValue={gym.settings.aiMemo} />
        </div>

        <label className="flex flex-col gap-1 text-[15px] text-text">
          Сообщений клиенту в сутки
          <input
            name="aiDailyLimit"
            type="number"
            min={0}
            max={200}
            defaultValue={gym.settings.aiDailyLimit}
            className="h-12 w-24 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
          />
        </label>

        <section className="flex flex-col gap-3">
          <p className="text-[15px] text-text">Модели и цены за 1 тыс. токенов</p>
          <p className="text-[13px] text-text-muted">
            Пустое поле — модель по умолчанию. «Проверить» делает короткий запрос и показывает, отвечает ли модель.
          </p>
          <ProviderModels listId="provider-models" />
          {AI_TASKS.map(({ task, kind, label, hint }) => {
            const chosen = gym.settings.aiModels?.[task] ?? ''
            const fallbackName = defaultModelName(kind) ?? ''
            const price = prices[chosen || fallbackName || task]

            return (
              <ModelRow
                key={task}
                task={task}
                label={label}
                hint={hint}
                defaultModel={fallbackName}
                value={chosen}
                inPer1k={price?.inPer1k ?? null}
                outPer1k={price?.outPer1k ?? null}
                listId="provider-models"
              />
            )
          })}
        </section>

        <button type="submit" className="h-12 rounded-control bg-accent text-[15px] text-white">
          Сохранить
        </button>
      </ActionForm>

      <a href="/trainer/settings/stats" className="text-[15px] text-accent">
        Расход за месяц
      </a>
    </SettingsPage>
  )
}