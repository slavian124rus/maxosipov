'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { AUDIENCE_LABELS, GOAL_LABELS } from '@/shared/program-labels'
import {
  createTemplateAction,
  type CreateTemplateState,
} from '@/app/(app)/app/trainer/programs/actions'

const INITIAL: CreateTemplateState = { error: null, id: null }

const AUDIENCES = ['any', 'female', 'male'] as const
const GOALS = ['fat_loss', 'mass', 'strength', 'health'] as const
const DAY_CHOICES = ['0', '2', '3', '4', '5'] as const

/** Чип-выбор: одна строка вариантов, выбранный подсвечен. */
function ChoiceRow<T extends string>({
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
          className={`min-h-11 rounded-control border px-3 text-[15px] ${
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

/**
 * Новый шаблон: название, для кого, цель и сколько дней создать сразу.
 * Номер шаблона («№3») выдаёт сервер — здесь его не показываем.
 */
export function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createTemplateAction, INITIAL)
  const [name, setName] = useState('')
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('any')
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('fat_loss')
  const [days, setDays] = useState<(typeof DAY_CHOICES)[number]>('3')

  useEffect(() => {
    if (!state.id) return

    toast.success('Шаблон создан', { description: 'Добавь упражнения в дни' })
    onOpenChange(false)
    router.push(`/trainer/programs/${state.id}`)
  }, [state.id, onOpenChange, router])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый шаблон</DialogTitle>
          <DialogDescription>
            Название, для кого программа и цель. Номер шаблона добавим сами
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Название</Label>
            <Input
              id="template-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Похудение"
              required
              minLength={2}
              maxLength={80}
            />
            <p className="text-[13px] text-text-muted">
              Например «Похудение» — получится «Похудение для женщин №1»
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Для кого</Label>
            <ChoiceRow
              values={AUDIENCES}
              selected={audience}
              onSelect={setAudience}
              label={(value) => AUDIENCE_LABELS[value]}
            />
            <input type="hidden" name="audience" value={audience} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Цель</Label>
            <ChoiceRow
              values={GOALS}
              selected={goal}
              onSelect={setGoal}
              label={(value) => GOAL_LABELS[value]}
            />
            <input type="hidden" name="goal" value={goal} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Сколько дней сразу</Label>
            <ChoiceRow
              values={DAY_CHOICES}
              selected={days}
              onSelect={setDays}
              label={(value) => (value === '0' ? 'Пустой' : value)}
            />
            <input type="hidden" name="days" value={days} />
            <p className="text-[13px] text-text-muted">
              Дни можно добавить позже — руками или через МаксИИма
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="text-[15px] text-danger">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Создаём…' : 'Создать шаблон'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
