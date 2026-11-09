'use client'

import { useState } from 'react'

const LIMIT = 2000

/** Большое поле памятки со счётчиком символов (DESIGN.md §8.9). */
export function MemoField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="flex flex-col gap-1">
      <textarea
        name="aiMemo"
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, LIMIT))}
        rows={6}
        placeholder="Например: я за технику, а не за вес; новичкам в первый месяц не повышай больше чем на один шаг"
        aria-label="Памятка МаксИИма"
        className="rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text"
      />
      <p className="self-end text-[13px] text-text-muted">
        {value.length} / {LIMIT}
      </p>
    </div>
  )
}