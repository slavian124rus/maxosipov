import { describe, expect, it } from 'vitest'
import { nextNotification, type NotifyExercise } from './workout-notification'

const press: NotifyExercise = {
  exerciseId: 'e1',
  name: 'Жим ногами',
  loadType: 'external',
  sets: 4,
  repMin: 12,
  repMax: 15,
  weightKg: 22.5,
}
const bridge: NotifyExercise = {
  exerciseId: 'e2',
  name: 'Ягодичный мостик',
  loadType: 'bodyweight',
  sets: 3,
  repMin: 15,
  repMax: 20,
  weightKg: 0,
}

describe('nextNotification', () => {
  it('показывает первое упражнение и первый подход', () => {
    const result = nextNotification([press, bridge], {})
    expect(result).toMatchObject({
      exerciseId: 'e1',
      setNumber: 1,
      title: 'Жим ногами · 22,5 кг',
      body: 'Подход 1 из 4 · 12–15 раз',
      actionTitle: '+ Подход 22,5 кг',
      weightKg: 22.5,
      reps: 15,
    })
  })

  it('идёт к следующему подходу по числу сделанных', () => {
    const result = nextNotification([press, bridge], { e1: [{ weightKg: 25, reps: 13 }, { weightKg: 25, reps: 12 }] })
    expect(result).toMatchObject({ setNumber: 3, body: 'Подход 3 из 4 · 12–15 раз' })
  })

  it('берёт вес и повторы последнего подхода', () => {
    const result = nextNotification([press], { e1: [{ weightKg: 25, reps: 13 }] })
    expect(result).toMatchObject({ weightKg: 25, reps: 13, title: 'Жим ногами · 25 кг' })
  })

  it('переходит на следующее упражнение, когда все подходы сделаны', () => {
    const done = Array.from({ length: 4 }, () => ({ weightKg: 22.5, reps: 12 }))
    const result = nextNotification([press, bridge], { e1: done })
    expect(result).toMatchObject({ exerciseId: 'e2', setNumber: 1 })
  })

  it('для своего веса пишет «свой вес» и кнопку без килограммов', () => {
    const result = nextNotification([bridge], {})
    expect(result).toMatchObject({ title: 'Ягодичный мостик · свой вес', actionTitle: '+ Подход', weightKg: 0 })
  })

  it('для упражнения с отягощением своего веса показывает килограммы', () => {
    const dips: NotifyExercise = { ...press, exerciseId: 'e3', name: 'Подтягивания', loadType: 'bodyweight_plus', weightKg: 5 }
    expect(nextNotification([dips], {})).toMatchObject({ title: 'Подтягивания · 5 кг', weightKg: 5 })
  })

  it('возвращает null, когда всё выполнено', () => {
    const done = Array.from({ length: 3 }, () => ({ weightKg: 0, reps: 15 }))
    expect(nextNotification([bridge], { e2: done })).toBeNull()
  })

  it('без упражнений — null', () => {
    expect(nextNotification([], {})).toBeNull()
  })
})
