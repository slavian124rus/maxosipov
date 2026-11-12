'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AssignClientsForm } from '@/app/(app)/app/trainer/programs/assign-form'
import { AUDIENCE_LABELS, type ProgramAudience, type TemplateListItem } from '@/shared/program-labels'
import { audienceCounts, filterTemplates } from './templates-filter'
import { CreateTemplateDialog } from './create-template-dialog'
import { DeleteTemplateButton } from './delete-template-button'

type Props = {
  templates: TemplateListItem[]
  clients: { id: string; name: string }[]
}

const FILTERS: (ProgramAudience | 'all')[] = ['all', 'female', 'male', 'any']

function filterLabel(value: ProgramAudience | 'all'): string {
  if (value === 'all') return 'Все'
  if (value === 'female') return 'Женские'
  if (value === 'male') return 'Мужские'
  return 'Для всех'
}

/**
 * Экран «Программы» (DESIGN.md §8.9): поиск по названию, номеру, цели и полу,
 * чипы аудитории, создание в модальном окне и удаление шаблона.
 */
export function TemplatesClient({ templates, clients }: Props) {
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState<ProgramAudience | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => audienceCounts(templates), [templates])
  const visible = useMemo(
    () => filterTemplates(templates, { query, audience }),
    [templates, query, audience],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={18}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, №, цель или «жен»"
            aria-label="Поиск по шаблонам"
            className="pl-10"
          />
        </div>

        <Button type="button" onClick={() => setCreating(true)} className="h-12 shrink-0">
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          Новый шаблон
        </Button>
      </div>

      <div role="group" aria-label="Для кого" className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAudience(value)}
            aria-pressed={audience === value}
            className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${
              audience === value
                ? 'border-accent bg-surface-2 text-text'
                : 'border-border bg-surface-1 text-text-secondary'
            }`}
          >
            {filterLabel(value)}
            <span className="tabular-nums text-text-muted">{counts[value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-[15px] text-text-secondary">
          {templates.length === 0
            ? 'Шаблонов пока нет — создай первый'
            : 'Ничего не нашлось — попробуй другое слово'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => (
            <article
              key={template.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/trainer/programs/${template.id}`}
                    className="text-[17px] leading-tight text-text hover:text-accent"
                  >
                    {template.title}
                  </Link>
                  <p className="text-[13px] text-text-muted">{template.subtitle}</p>
                </div>

                {template.number ? (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] tabular-nums text-text-secondary">
                    №{template.number}
                  </span>
                ) : null}
              </div>

              {template.audience ? (
                <span className="w-fit rounded-full border border-border px-2.5 py-1 text-[12px] text-text-secondary">
                  {AUDIENCE_LABELS[template.audience]}
                </span>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" className="min-h-10">
                  <Link href={`/trainer/programs/${template.id}`}>Открыть</Link>
                </Button>
                <DeleteTemplateButton templateId={template.id} title={template.title} />
              </div>

              <AssignClientsForm templateId={template.id} clients={clients} />
            </article>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
