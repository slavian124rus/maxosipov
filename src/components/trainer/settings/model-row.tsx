'use client'

import { useState, useTransition } from 'react'
import {
  listModelsAction,
  testModelAction,
} from '@/app/(app)/app/trainer/settings/actions'

type Props = {
  task: string
  label: string
  hint: string
  /** Модель по умолчанию — показывается подсказкой, пока поле пустое. */
  defaultModel: string
  value: string
  inPer1k: number | null
  outPer1k: number | null
  /** id для <datalist> со списком моделей провайдера. */
  listId: string
}

type TestResult = { ok: true; ms: number; text: string } | { ok: false; ms: number; error: string }

/** Одна задача ИИ: модель, «Проверить», цены за 1 тыс. токенов. */
export function ModelRow({ task, label, hint, defaultModel, value, inPer1k, outPer1k, listId }: Props) {
  const [model, setModel] = useState(value)
  const [priceIn, setPriceIn] = useState(inPer1k ? String(inPer1k) : '')
  const [priceOut, setPriceOut] = useState(outPer1k ? String(outPer1k) : '')
  const [result, setResult] = useState<TestResult | null>(null)
  const [pending, start] = useTransition()

  const effective = model.trim() || defaultModel
  const hasPrice = Number(priceIn.replace(',', '.')) > 0 || Number(priceOut.replace(',', '.')) > 0

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3">
      <p className="text-[15px] text-text">{label}</p>
      <p className="text-[13px] text-text-muted">{hint}</p>

      <input
        name={`model_${task}`}
        list={listId}
        value={model}
        onChange={(event) => {
          setModel(event.target.value)
          setResult(null)
        }}
        placeholder={defaultModel || 'id модели'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={`Модель: ${label}`}
        className="h-12 rounded-control border border-border bg-bg px-3 text-[15px] text-text"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !effective}
          onClick={() =>
            start(async () => {
              setResult(await testModelAction(effective))
            })
          }
          className="h-11 rounded-control border border-border px-4 text-[15px] text-text disabled:opacity-50"
        >
          {pending ? 'Проверяю…' : 'Проверить'}
        </button>
        {result?.ok ? (
          <p role="status" className="text-[13px] text-success">
            Работает · {(result.ms / 1000).toFixed(1)} с
          </p>
        ) : result ? (
          <p role="alert" className="text-[13px] text-danger">
            {result.error}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <label className="flex flex-col gap-1 text-[13px] text-text-muted">
          Вход, ₽
          <input
            name={`in_${task}`}
            inputMode="decimal"
            value={priceIn}
            onChange={(event) => setPriceIn(event.target.value)}
            className="h-11 w-24 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-text-muted">
          Выход, ₽
          <input
            name={`out_${task}`}
            inputMode="decimal"
            value={priceOut}
            onChange={(event) => setPriceOut(event.target.value)}
            className="h-11 w-24 rounded-control border border-border bg-bg px-2 text-[15px] text-text"
          />
        </label>
      </div>

      {!hasPrice && effective ? (
        <p className="text-[13px] text-warning">
          Для «{effective}» не задана цена — расход в статистике будет нулевым.
        </p>
      ) : null}
    </div>
  )
}

/** «Модели провайдера»: подгружает список id в <datalist> для подсказок в полях. */
export function ProviderModels({ listId }: { listId: string }) {
  const [models, setModels] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await listModelsAction()
            setModels(result.models)
            setError(result.error)
          })
        }
        className="h-11 self-start rounded-control border border-border px-4 text-[15px] text-text disabled:opacity-50"
      >
        {pending ? 'Загружаю…' : 'Модели провайдера'}
      </button>
      {models.length > 0 ? (
        <p className="text-[13px] text-text-muted">Нашлось {models.length}: начни вводить id в поле — появятся подсказки.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <datalist id={listId}>
        {models.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
    </div>
  )
}
