'use client'

import { Sparkles, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExerciseAiReview, ExerciseIssue } from '@/modules/coach-ai'

/**
 * Вкладка «МаксИИм» в правке упражнения (DESIGN.md §8.9): проверка карточки и
 * исправления, которые тренер применяет кнопкой. Замечания считаются без ИИ,
 * поэтому видны даже когда модель недоступна.
 */
export function ExerciseAiPanel({
  loading,
  issues,
  review,
  error,
  onCheck,
  onApply,
}: {
  loading: boolean
  issues: ExerciseIssue[]
  review: ExerciseAiReview | null
  error: string | null
  onCheck: () => void
  onApply: () => void
}) {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const checked = issues.length > 0 || review !== null || error !== null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-text-secondary">
        МаксИИм посмотрит название, тренажёр, мышцы, шаги, ошибки и совет — и предложит, что
        поправить. В карточку ничего не попадёт, пока ты не нажмёшь «Применить».
      </p>

      <Button type="button" variant="outline" onClick={onCheck} disabled={loading} className="w-fit">
        <Sparkles size={16} strokeWidth={1.75} aria-hidden />
        {loading ? 'МаксИИм смотрит карточку…' : checked ? 'Проверить снова' : 'Проверить карточку'}
      </Button>

      {error ? <p className="text-[15px] text-warning">{error}</p> : null}

      {errors.length > 0 ? (
        <section className="flex flex-col gap-1.5 rounded-card border border-danger/30 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[15px] text-danger">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
            Без этого не опубликовать
          </p>
          {errors.map((issue) => (
            <p key={issue.text} className="text-[13px] text-danger">
              {issue.text}
            </p>
          ))}
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="flex flex-col gap-1.5 rounded-card border border-warning/40 px-4 py-3">
          <p className="text-[15px] text-warning">Стоит поправить</p>
          {warnings.map((issue) => (
            <p key={issue.text} className="text-[13px] text-text-secondary">
              {issue.text}
            </p>
          ))}
        </section>
      ) : null}

      {checked && issues.length === 0 && review ? (
        <p className="text-[15px] text-success">Карточка заполнена — замечаний нет</p>
      ) : null}

      {review ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-4 py-3">
          <p className="text-[15px] text-text">{review.summary}</p>

          <ul className="flex flex-col gap-1">
            <li className="text-[13px] text-text-muted">Название: {review.fix.name}</li>
            <li className="text-[13px] text-text-muted">
              Повторения: {review.fix.repMin}–{review.fix.repMax}
            </li>
            <li className="text-[13px] text-text-muted">
              Шагов: {review.fix.steps.length} · ошибок: {review.fix.mistakes.length} · совет:{' '}
              {review.fix.tip ? 'есть' : 'нет'}
            </li>
          </ul>

          <Button type="button" onClick={onApply} className="w-fit">
            Применить исправления
          </Button>
          <p className="text-[13px] text-text-muted">
            Поля заполнятся в форме — проверь их и нажми «Сохранить»
          </p>
        </section>
      ) : null}
    </div>
  )
}
