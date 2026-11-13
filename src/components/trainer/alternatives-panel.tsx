'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CatalogPickerTree } from '@/components/trainer/catalog-picker-tree'
import { suggestAlternativesAction } from '@/app/(app)/app/trainer/exercises/actions'

export type AlternativeOption = {
  id: string
  name: string
  machineName: string | null
  machineId?: string | null
  machineZone?: string | null
}

/**
 * «Можно заменить на»: тренер сам решает, что клиенту предлагать, когда тренажёр занят.
 * Список живёт в редакторе упражнения и сохраняется общей кнопкой «Сохранить» внизу окна.
 * «Подобрать» показывает кандидатов по тем же мышцам на других тренажёрах.
 */
export function AlternativesPanel({
  exerciseId,
  items,
  onItems,
  mirror,
  onMirror,
  catalog,
}: {
  exerciseId: string
  items: AlternativeOption[]
  onItems: (items: AlternativeOption[]) => void
  mirror: boolean
  onMirror: (value: boolean) => void
  /** Все опубликованные упражнения для ручного добавления. */
  catalog: AlternativeOption[]
}) {
  const [suggested, setSuggested] = useState<AlternativeOption[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [pending, startTransition] = useTransition()

  const chosen = new Set(items.map((item) => item.id))
  const pickable = catalog.filter((item) => item.id !== exerciseId)

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onItems(next)
  }

  function add(option: AlternativeOption) {
    if (chosen.has(option.id)) return
    onItems([...items, option])
    setSuggested((current) => current.filter((item) => item.id !== option.id))
  }

  function suggest() {
    startTransition(async () => {
      const found = await suggestAlternativesAction(exerciseId)
      setSuggested(found.filter((item) => !chosen.has(item.id)))
      setMessage(found.length === 0 ? 'Подходящих упражнений на других тренажёрах не нашлось' : null)
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] font-semibold">Можно заменить на</h3>
        <p className="text-[13px] text-text-muted">
          Эти упражнения клиент увидит первыми, когда тренажёр занят. Список сохраняется кнопкой «Сохранить» внизу.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Пока пусто</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-control border border-border bg-surface-2/40 px-3 py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px]">{item.name}</span>
                {item.machineName ? (
                  <span className="truncate text-[13px] text-text-muted">{item.machineName}</span>
                ) : null}
              </span>
              <button type="button" aria-label="Выше" onClick={() => move(index, -1)} className="p-2">
                <ArrowUp size={16} />
              </button>
              <button type="button" aria-label="Ниже" onClick={() => move(index, 1)} className="p-2">
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                aria-label="Убрать"
                onClick={() => onItems(items.filter((current) => current.id !== item.id))}
                className="p-2"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggested.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-text-muted">Подходят по мышцам</p>
          {suggested.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => add(item)}
              className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-left"
            >
              <Plus size={16} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">{item.name}</span>
                {item.machineName ? (
                  <span className="truncate text-[13px] text-text-muted">{item.machineName}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={suggest} disabled={pending}>
          <Sparkles size={16} aria-hidden />
          Подобрать
        </Button>
        <Button type="button" variant="secondary" onClick={() => setPicking((value) => !value)}>
          {picking ? 'Скрыть каталог' : 'Добавить из каталога'}
        </Button>
      </div>

      {picking ? <CatalogPickerTree items={pickable} chosenIds={chosen} onPick={add} /> : null}

      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={mirror} onChange={(event) => onMirror(event.target.checked)} />
        Предлагать и в обратную сторону
      </label>

      {message ? <p className="text-[13px] text-text-secondary">{message}</p> : null}
    </section>
  )
}
