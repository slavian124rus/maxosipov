import { SettingsPage } from '@/components/trainer/page'
import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { getGym } from '@/modules/gym'
import { can } from '@/modules/rbac'
import { env } from '@/shared/env'
import { MemoField } from '@/components/trainer/settings/memo-field'
import { ActionForm } from '@/components/trainer/action-form'
import { saveAiSettingsAction } from '../actions'

// Настройки зависят от сессии и прав.
export const instant = false

const MODELS = [
  { kind: 'main' as const, label: 'Основная модель', name: env.AI_MODEL_MAIN },
  { kind: 'fast' as const, label: 'Быстрая модель (итоги, голос)', name: env.AI_MODEL_FAST },
  { kind: 'fallback' as const, label: 'Запасная модель', name: env.AI_MODEL_FALLBACK },
]

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
          <p className="text-[15px] text-text">Цены за 1 тыс. токенов, ₽</p>
          {MODELS.map((model) => {
            const price = prices[model.name ?? model.kind]

            return (
              <div key={model.kind} className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-2">
                <p className="text-[15px] text-text">{model.label}</p>
                <p className="text-[13px] text-text-muted">{model.name ?? 'модель не задана в .env'}</p>
                <div className="flex gap-2">
                  <label className="flex flex-col gap-1 text-[13px] text-text-muted">
                    Вход
                    <input
                      name={`in_${model.kind}`}
                      inputMode="decimal"
                      defaultValue={price?.inPer1k ?? ''}
                      className="h-11 w-24 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] text-text-muted">
                    Выход
                    <input
                      name={`out_${model.kind}`}
                      inputMode="decimal"
                      defaultValue={price?.outPer1k ?? ''}
                      className="h-11 w-24 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
                    />
                  </label>
                </div>
              </div>
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