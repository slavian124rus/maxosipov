'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Trash2 } from 'lucide-react'
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
import { formatWeight } from '@/modules/progression'
import {
  applyClientWeightsAction,
  assignClientProgramAction,
  previewClientWeightsAction,
  removeClientProgramAction,
  type WeightPreview,
} from '@/app/(app)/app/trainer/clients/program-actions'

export type ProgramTemplateOption = { id: string; title: string; subtitle: string }

type Props = {
  clientId: string
  templates: ProgramTemplateOption[]
  /** Активная программа клиента: `null` — ещё не выдана. */
  program: { id: string; name: string } | null
}

/**
 * Действия с программой клиента (DESIGN.md §8.9): выдать шаблон, сменить, удалить,
 * подобрать веса по анкете (МаксИИм с запасным расчётом). Веса при выдаче шаблона
 * подставляются автоматически — каждому клиенту свои.
 */
export function ProgramActions({ clientId, templates, program }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [picking, setPicking] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [weights, setWeights] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [preview, setPreview] = useState<WeightPreview | null>(null)

  function assign(): void {
    if (!templateId) return

    startTransition(async () => {
      const result = await assignClientProgramAction({ clientId, templateId })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message ?? 'Программа выдана')
      setPicking(false)
      setTemplateId(null)
      router.refresh()
    })
  }

  function remove(): void {
    if (!program) return

    startTransition(async () => {
      const result = await removeClientProgramAction({ clientId, programId: program.id })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Программа удалена', { description: 'История тренировок осталась' })
      setRemoving(false)
      router.refresh()
    })
  }

  function openWeights(): void {
    setWeights(true)
    setPreview(null)

    startTransition(async () => {
      if (!program) return

      const result = await previewClientWeightsAction({ clientId, programId: program.id })
      if (result.error) {
        toast.error(result.error)
        setWeights(false)
        return
      }

      setPreview(result)
    })
  }

  function applyWeights(): void {
    if (!program || !preview) return

    const weightsMap = Object.fromEntries(preview.items.map((item) => [item.exerciseId, item.weightKg]))

    startTransition(async () => {
      const result = await applyClientWeightsAction({ clientId, programId: program.id, weights: weightsMap })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message ?? 'Веса обновлены')
      setWeights(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {program === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[15px] text-text">Активной программы нет</p>
            <p className="text-[13px] text-text-muted">
              Выдай шаблон — веса упражнений подставим по анкете клиента
            </p>
          </div>
          <Button type="button" onClick={() => setPicking(true)} disabled={templates.length === 0}>
            Выдать программу
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setPicking(true)} disabled={templates.length === 0}>
            Сменить программу
          </Button>
          <Button type="button" variant="secondary" onClick={openWeights} disabled={pending}>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden />
            Подобрать веса
          </Button>
          <Button type="button" variant="destructive" onClick={() => setRemoving(true)}>
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            Удалить программу
          </Button>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-[13px] text-text-muted">
          Шаблонов пока нет — собери первый в разделе «Программы»
        </p>
      ) : null}

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{program === null ? 'Выдать программу' : 'Сменить программу'}</DialogTitle>
            <DialogDescription>
              {program === null
                ? 'Шаблон станет активной программой клиента. Веса подставим по анкете'
                : 'Прежняя программа уйдёт в архив вместе с историей. Веса подставим по анкете'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setTemplateId(template.id)}
                aria-pressed={templateId === template.id}
                className={`flex min-h-12 flex-col items-start gap-0.5 rounded-control border px-3 py-2 text-left ${
                  templateId === template.id
                    ? 'border-accent bg-surface-2'
                    : 'border-border bg-surface-1'
                }`}
              >
                <span className="text-[15px] text-text">{template.title}</span>
                <span className="text-[13px] text-text-muted">{template.subtitle}</span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPicking(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={!templateId || pending} onClick={assign}>
              {pending ? 'Выдаём…' : 'Выдать программу'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent className="grid grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>Удалить программу «{program?.name}»?</DialogTitle>
            <DialogDescription>
              Программа уйдёт в архив, клиент останется без плана до новой выдачи. История
              тренировок и записанные веса сохранятся.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRemoving(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
              {pending ? 'Удаляем…' : 'Удалить программу'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={weights} onOpenChange={setWeights}>
        <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Веса по анкете</DialogTitle>
            <DialogDescription>
              {preview?.source === 'ai'
                ? 'МаксИИм посмотрел анкету и упражнения. Проверь и примени'
                : 'Считаем по анкете: пол, возраст, рост, вес, опыт и цель'}
            </DialogDescription>
          </DialogHeader>

          {preview === null ? (
            <p className="text-[15px] text-text-secondary">Подбираем веса…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-text">{preview.summary}</p>

              <div className="flex flex-col gap-1.5">
                {preview.items.map((item) => (
                  <div
                    key={item.exerciseId}
                    className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] text-text">{item.name}</span>
                      <span className="text-[13px] text-text-muted">{item.reason}</span>
                    </div>
                    <span className="shrink-0 font-display text-[17px] tabular-nums">
                      {formatWeight(item.weightKg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setWeights(false)}>
              Закрыть
            </Button>
            <Button
              type="button"
              disabled={pending || preview === null || preview.items.length === 0}
              onClick={applyWeights}
            >
              {pending ? 'Применяем…' : 'Применить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
