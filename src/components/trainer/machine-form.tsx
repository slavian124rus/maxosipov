'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveMachineAction, type MachineState } from '@/app/(app)/app/trainer/exercises/actions'

const INITIAL: MachineState = { error: null, ok: false }

export function MachineForm() {
  const [state, formAction, pending] = useActionState(saveMachineAction, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
      <p className="text-[17px]">Новый тренажёр</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="machineName">Название</Label>
        <Input id="machineName" name="name" placeholder="Блочный тренажёр (нижняя тяга)" required />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="zone">Зона</Label>
          <Input id="zone" name="zone" placeholder="Спина" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="weightStepKg">Шаг веса, кг</Label>
          <Input id="weightStepKg" name="weightStepKg" inputMode="decimal" defaultValue="5" />
        </div>
      </div>

      {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-[15px] text-success">Тренажёр добавлен</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Добавить'}
      </Button>
    </form>
  )
}
