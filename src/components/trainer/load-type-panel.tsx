'use client'

export type LoadTypeValue = 'external' | 'bodyweight' | 'bodyweight_plus'

const OPTIONS: { value: LoadTypeValue; title: string; hint: string }[] = [
  { value: 'external', title: 'С весом', hint: 'Тренажёр, штанга, гантели: вес записываем в кг' },
  { value: 'bodyweight', title: 'Свой вес', hint: 'Коврик, пресс, альпинист: вес не нужен, только повторения' },
  {
    value: 'bodyweight_plus',
    title: 'Свой вес + отягощение',
    hint: 'Подтягивания, брусья: можно добавить вес, 0 — «свой вес»',
  },
]

/** Тип нагрузки: от него зависит, спрашивать ли вес и считать ли для упражнения килограммы. */
export function LoadTypePanel({
  value,
  onChange,
}: {
  value: LoadTypeValue
  onChange: (value: LoadTypeValue) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[17px] font-semibold">Какой вес у упражнения</h3>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`flex flex-col gap-0.5 rounded-card border px-3 py-2 text-left ${
              value === option.value ? 'border-accent bg-surface-2' : 'border-border bg-surface-1'
            }`}
          >
            <span className="text-[15px]">{option.title}</span>
            <span className="text-[13px] text-text-muted">{option.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
