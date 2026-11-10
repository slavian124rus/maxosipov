'use client'

const CHIPS = [
  { label: 'Собери тренировку', text: 'Собери тренировку' },
  { label: 'Чем заменить…', text: 'Чем заменить ' },
  { label: 'Разбор недели', text: 'Разбор недели' },
  { label: 'Почему такой вес?', text: 'Почему такой вес?' },
]

/** Быстрые кнопки над полем ввода (DESIGN.md §8.6). */
export function QuickChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CHIPS.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onPick(chip.text)}
          className="shrink-0 rounded-full border border-border px-3.5 py-2 text-[14px] text-text-secondary"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}