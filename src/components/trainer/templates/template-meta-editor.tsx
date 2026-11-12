'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AUDIENCE_LABELS,
  GOAL_LABELS,
  type ProgramAudience,
  type ProgramGoal,
} from '@/shared/program-labels'
import { updateTemplateMetaAction } from '@/app/(app)/app/trainer/programs/actions'

const AUDIENCES: ProgramAudience[] = ['any', 'female', 'male']
const GOALS: ProgramGoal[] = ['fat_loss', 'mass', 'strength', 'health']

/**
 * Правка шаблона из шапки (DESIGN.md §8.9): название, для кого и цель.
 * Номер шаблона («№3») не меняется — он закреплён за залом, это видно в подсказке.
 */
export function TemplateMetaEditor({
  templateId,
  name,
  audience,
  goal,
  number,
}: {
  templateId: string
  name: string
  audience: ProgramAudience | null
  goal: ProgramGoal | null
  number: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draftName, setDraftName] = useState(name)
  const [draftAudience, setDraftAudience] = useState<ProgramAudience | null>(audience)
  const [draftGoal, setDraftGoal] = useState<ProgramGoal | null>(goal)
  const [error, setError] = useState<string | null>(null)

  function openDialog(): void {
    // Каждый раз начинаем с текущих значений, а не с забытых правок.
    setDraftName(name)
    setDraftAudience(audience)
    setDraftGoal(goal)
    setError(null)
    setOpen(true)
  }

  function save(): void {
    const trimmed = draftName.trim()
    if (trimmed.length < 2) {
      setError('Название — от 2 символов')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await updateTemplateMetaAction({
        templateId,
        name: trimmed,
        audience: draftAudience,
        goal: draftGoal,
      })

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      toast.success('Шаблон сохранён', { description: trimmed })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="ghost" onClick={openDialog}>
        <Pencil size={16} strokeWidth={1.75} aria-hidden />
        Изменить
      </Button>

      <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Изменить шаблон</DialogTitle>
          <DialogDescription>
            Название, для кого программа и цель
            {number ? ` · номер №${number} не меняется` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Название</Label>
            <Input
              id="template-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Похудение"
              autoFocus
              maxLength={80}
            />
            <p className="text-[13px] text-text-muted">
              В списке шаблон подписан «название + для кого + номер»
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Для кого</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraftAudience(value)}
                  aria-pressed={draftAudience === value}
                  className={`min-h-10 rounded-control border px-3 text-[15px] ${
                    draftAudience === value
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {AUDIENCE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Цель</Label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraftGoal(value)}
                  aria-pressed={draftGoal === value}
                  className={`min-h-10 rounded-control border px-3 text-[15px] ${
                    draftGoal === value
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {GOAL_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-[15px] text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
