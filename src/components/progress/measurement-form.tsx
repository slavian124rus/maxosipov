'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addMeasurementAction, type MeasurementState } from '@/app/(app)/app/(client)/progress/measurements/actions'

const INITIAL: MeasurementState = { error: null, saved: false }

const FIELDS = [
  { name: 'weightKg', label: 'Вес, кг' },
  { name: 'chestCm', label: 'Грудь, см' },
  { name: 'waistCm', label: 'Талия, см' },
  { name: 'hipsCm', label: 'Бёдра, см' },
  { name: 'bicepsCm', label: 'Бицепс, см' },
  { name: 'thighCm', label: 'Бедро, см' },
] as const

/** Форма замера: дата по умолчанию — сегодня по часовому поясу зала. */
export function MeasurementForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(addMeasurementAction, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
      <p className="text-[17px]">Добавить замер</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Дата</Label>
        <Input id="date" name="date" type="date" defaultValue={today} max={today} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input id={field.name} name={field.name} inputMode="decimal" placeholder="—" />
          </div>
        ))}
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {state.saved ? <p className="text-[15px] text-success">Замер сохранён</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </Button>
    </form>
  )
}