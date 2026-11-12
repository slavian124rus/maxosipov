'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Check, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatScheme } from '@/shared/scheme'
import {
  AUDIENCE_LABELS,
  GOAL_LABELS,
  type ProgramAudience,
  type ProgramGoal,
} from '@/shared/program-labels'
import type { TemplateAiReview, TemplateDraft, TemplateIssue } from '@/modules/coach-ai'
import {
  applyTemplateDraftAction,
  draftTemplateAction,
  reviewTemplateAction,
} from '@/app/(app)/app/trainer/programs/actions'

const GOALS = ['fat_loss', 'mass', 'strength', 'health'] as const
const AUDIENCES = ['any', 'female', 'male'] as const
const LEVELS = [
  { value: 'novice', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Опытный' },
] as const
const DAYS = ['2', '3', '4', '5'] as const

/** Строка чипов: один вариант выбран. */
function Chips<T extends string>({
  values,
  selected,
  onSelect,
  label,
}: {
  values: readonly T[]
  selected: T
  onSelect: (value: T) => void
  label: (value: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-pressed={selected === value}
          className={`min-h-10 rounded-control border px-3 text-[15px] ${
            selected === value
              ? 'border-accent bg-surface-2 text-text'
              : 'border-border bg-surface-1 text-text-secondary'
          }`}
        >
          {label(value)}
        </button>
      ))}
    </div>
  )
}

type Props = {
  templateId: string
  templateTitle: string
  /** Упражнения каталога: по id показываем название в предпросмотре. */
  catalog: { id: string; name: string }[]
  defaultGoal?: ProgramGoal | null
  defaultAudience?: ProgramAudience | null
  hasDays: boolean
}

/**
 * МаксИИм-помощник шаблона (DESIGN.md §8.9): бриф → дни с упражнениями →
 * проверка каждого дня → «Применить». ИИ только предлагает: в шаблон дни
 * попадают после нажатия кнопки.
 */
export function TemplateAssistant({
  templateId,
  templateTitle,
  catalog,
  defaultGoal = null,
  defaultAudience = null,
  hasDays,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState<ProgramGoal>(defaultGoal ?? 'fat_loss')
  const [audience, setAudience] = useState<ProgramAudience>(defaultAudience ?? 'any')
  const [level, setLevel] = useState<(typeof LEVELS)[number]['value']>('novice')
  const [daysPerWeek, setDaysPerWeek] = useState<(typeof DAYS)[number]>('3')
  const [note, setNote] = useState('')

  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const [issues, setIssues] = useState<TemplateIssue[]>([])
  const [review, setReview] = useState<TemplateAiReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const names = new Map(catalog.map((item) => [item.id, item.name]))
  const errors = issues.filter((item) => item.severity === 'error')
  const warnings = issues.filter((item) => item.severity === 'warning')

  function build(): void {
    setError(null)
    startTransition(async () => {
      const result = await draftTemplateAction({
        brief: {
          goal,
          audience,
          level,
          daysPerWeek: Number(daysPerWeek),
          note: note.trim() || null,
        },
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setDraft(result.draft)
      setIssues(result.issues)
      setReview(result.review)
    })
  }

  function check(): void {
    setError(null)
    startTransition(async () => {
      const result = await reviewTemplateAction({ templateId })

      if (result.error) {
        setError(result.error)
        return
      }

      setDraft(null)
      setIssues(result.issues)
      setReview(result.review)
      setOpen(true)
    })
  }

  function apply(): void {
    if (!draft) return

    setError(null)
    startTransition(async () => {
      const result = await applyTemplateDraftAction({ templateId, days: draft.days })

      if (result.error) {
        setError(result.error)
        return
      }

      toast.success('Дни обновлены', {
        description: `${templateTitle}: ${draft.days.length} ${draft.days.length === 1 ? 'день' : 'дней'}`,
      })
      setDraft(null)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setOpen(true)} className="min-h-11">
          <Sparkles size={18} strokeWidth={1.75} aria-hidden />
          Собрать с МаксИИмом
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={check}
          disabled={pending || !hasDays}
          className="min-h-11"
        >
          <Bot size={18} strokeWidth={1.75} aria-hidden />
          Проверить дни
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid max-h-[92dvh] w-full grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader className="pr-8">
            <DialogTitle>МаксИИм собирает шаблон</DialogTitle>
            <DialogDescription>
              Опиши, для кого программа, — МаксИИм предложит дни с упражнениями из каталога зала.
              Проверь и примени: в шаблон попадёт только то, что ты подтвердишь
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-muted">Цель</p>
              <Chips
                values={GOALS}
                selected={goal}
                onSelect={setGoal}
                label={(value) => GOAL_LABELS[value]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-muted">Для кого</p>
              <Chips
                values={AUDIENCES}
                selected={audience}
                onSelect={setAudience}
                label={(value) => AUDIENCE_LABELS[value]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-muted">Уровень</p>
              <Chips
                values={LEVELS.map((item) => item.value)}
                selected={level}
                onSelect={setLevel}
                label={(value) => LEVELS.find((item) => item.value === value)?.label ?? value}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-muted">Дней в неделю</p>
              <Chips values={DAYS} selected={daysPerWeek} onSelect={setDaysPerWeek} label={(v) => v} />
            </div>

            <label className="flex flex-col gap-2 text-[13px] text-text-muted">
              Пожелания
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Например: без становой, акцент на ягодицы"
                className="rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text"
              />
            </label>

            <Button type="button" onClick={build} disabled={pending}>
              {pending ? 'МаксИИм думает…' : draft ? 'Собрать заново' : 'Собрать программу'}
            </Button>

            {error ? (
              <p role="alert" className="text-[15px] text-danger">
                {error}
              </p>
            ) : null}


            {draft ? (
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-3">
                <p className="text-[15px] text-text">{draft.name}</p>

                {draft.days.map((day, dayIndex) => (
                  <div key={`${day.name}-${dayIndex}`} className="flex flex-col gap-1">
                    <p className="text-[15px] text-text">
                      {dayIndex + 1}. {day.name}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {day.exercises.map((item) => (
                        <li key={item.exerciseId} className="text-[13px] text-text-secondary">
                          {names.get(item.exerciseId) ?? 'Упражнение'} ·{' '}
                          {formatScheme(item.sets, item.repMin, item.repMax)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}

            {issues.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-card border border-warning/40 bg-surface-1 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[15px] text-warning">
                  <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
                  Что поправить
                </p>
                {errors.map((item) => (
                  <p key={`${item.day}-${item.text}`} className="text-[13px] text-danger">
                    {item.day}: {item.text}
                  </p>
                ))}
                {warnings.map((item) => (
                  <p key={`${item.day}-${item.text}`} className="text-[13px] text-text-secondary">
                    {item.day}: {item.text}
                  </p>
                ))}
              </div>
            ) : draft || review ? (
              <p className="flex items-center gap-1.5 text-[13px] text-success">
                <Check size={16} strokeWidth={2} aria-hidden />
                Дни выглядят ровно — можно применять
              </p>
            ) : null}

            {review ? (
              <div className="flex flex-col gap-1 rounded-card border border-border bg-surface-2 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                  <Bot size={14} strokeWidth={1.75} aria-hidden />
                  МаксИИм
                </p>
                <p className="text-[15px] text-text-secondary">{review.summary}</p>
                {review.notes.map((item) => (
                  <p key={item.day} className="text-[13px] text-text-muted">
                    {item.day}: {item.note}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
            {draft ? (
              <Button type="button" onClick={apply} disabled={pending}>
                {pending ? 'Применяем…' : `Применить (${draft.days.length})`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

