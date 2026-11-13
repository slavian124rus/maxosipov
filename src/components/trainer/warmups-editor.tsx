'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  archiveWarmupAction,
  saveWarmupAction,
} from '@/app/(app)/app/trainer/settings/warmups/actions'
import { warmupSeconds } from '@/shared/warmup-time'
import type { WarmupFocus, WarmupItem } from '@/modules/training'

type Template = { id: string; name: string; focus: WarmupFocus; items: WarmupItem[] }

const FOCUS_LABELS: Record<WarmupFocus, string> = {
  legs: 'Ноги',
  upper: 'Верх',
  full: 'Всё тело',
}

const ZONES: { code: string; label: string }[] = [
  { code: 'back', label: 'Спина' },
  { code: 'knee', label: 'Колено' },
  { code: 'shoulder', label: 'Плечо' },
  { code: 'elbow', label: 'Локоть' },
  { code: 'neck', label: 'Шея' },
  { code: 'wrist', label: 'Запястье' },
  { code: 'hip', label: 'Бедро' },
  { code: 'foot', label: 'Стопа' },
]

const BLANK: WarmupItem = { title: '', exerciseId: null, durationSec: 60, reps: null, note: null, zones: [] }

function TemplateCard({ initial }: { initial: Template }) {
  const [name, setName] = useState(initial.name)
  const [focus, setFocus] = useState<WarmupFocus>(initial.focus)
  const [items, setItems] = useState<WarmupItem[]>(initial.items)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const minutes = warmupSeconds(items) / 60
  const outOfRange = minutes < 5 || minutes > 7

  function patch(index: number, change: Partial<WarmupItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    setItems(next)
  }

  function save() {
    startTransition(async () => {
      const result = await saveWarmupAction({ id: initial.id, name, focus, items })
      setMessage(result.error ?? 'Сохранено')
    })
  }

  function archive() {
    startTransition(async () => {
      const result = await archiveWarmupAction(initial.id)
      setMessage(result.error ?? 'Шаблон убран')
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Название шаблона"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 flex-1 rounded-control border border-border bg-bg px-3 text-[17px]"
        />
        <select
          aria-label="Тип дня"
          value={focus}
          onChange={(event) => setFocus(event.target.value as WarmupFocus)}
          className="h-12 rounded-control border border-border bg-bg px-3 text-[15px]"
        >
          {Object.entries(FOCUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-control border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Название пункта"
                value={item.title}
                placeholder="Что делать"
                onChange={(event) => patch(index, { title: event.target.value })}
                className="h-11 min-w-0 flex-1 rounded-control border border-border bg-bg px-3 text-[15px]"
              />
              <button type="button" aria-label="Выше" onClick={() => move(index, -1)} className="p-2">
                <ArrowUp size={16} />
              </button>
              <button type="button" aria-label="Ниже" onClick={() => move(index, 1)} className="p-2">
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                aria-label="Убрать пункт"
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                className="p-2"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <label className="flex items-center gap-1">
                Секунд
                <input
                  type="number"
                  min={5}
                  max={900}
                  value={item.durationSec ?? ''}
                  onChange={(event) =>
                    patch(index, {
                      durationSec: event.target.value ? Number(event.target.value) : null,
                      reps: event.target.value ? null : item.reps,
                    })
                  }
                  className="h-10 w-20 rounded-control border border-border bg-bg px-2"
                />
              </label>
              <label className="flex items-center gap-1">
                или раз
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={item.reps ?? ''}
                  onChange={(event) =>
                    patch(index, {
                      reps: event.target.value ? Number(event.target.value) : null,
                      durationSec: event.target.value ? null : item.durationSec,
                    })
                  }
                  className="h-10 w-20 rounded-control border border-border bg-bg px-2"
                />
              </label>
            </div>

            <input
              aria-label="Подсказка"
              value={item.note ?? ''}
              placeholder="Подсказка (необязательно)"
              onChange={(event) => patch(index, { note: event.target.value || null })}
              className="h-10 rounded-control border border-border bg-bg px-3 text-[14px]"
            />

            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-text-muted">Нагружает (если зона болит — пункт уберётся)</span>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((zone) => {
                  const on = item.zones.includes(zone.code)
                  return (
                    <button
                      key={zone.code}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        patch(index, {
                          zones: on ? item.zones.filter((z) => z !== zone.code) : [...item.zones, zone.code],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-[13px] ${
                        on ? 'border-accent bg-surface-2' : 'border-border text-text-secondary'
                      }`}
                    >
                      {zone.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setItems([...items, { ...BLANK }])}
        className="flex h-11 items-center justify-center gap-2 rounded-control border border-dashed border-border text-[15px]"
      >
        <Plus size={16} aria-hidden />
        Добавить пункт
      </button>

      <p className={`text-[14px] ${outOfRange ? 'text-warning' : 'text-text-secondary'}`}>
        Всего ≈ {Math.round(minutes * 10) / 10} мин
        {outOfRange ? ' — лучше уложиться в 5–7 минут' : ''}
      </p>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={pending}>
          Сохранить
        </Button>
        <Button type="button" variant="secondary" onClick={archive} disabled={pending}>
          Убрать в архив
        </Button>
      </div>
      {message ? <p className="text-[13px] text-text-secondary">{message}</p> : null}
    </section>
  )
}

export function WarmupsEditor({ templates }: { templates: Template[] }) {
  return (
    <div className="flex flex-col gap-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} initial={template} />
      ))}
    </div>
  )
}
