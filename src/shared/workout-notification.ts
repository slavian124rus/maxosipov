/**
 * Что показывать в уведомлении на время тренировки (DESIGN.md §8, ARCHITECTURE.md §10).
 * Чистая логика: её используют и экран тренировки, и service worker.
 */
export type NotifyExercise = {
  exerciseId: string
  name: string
  loadType: 'external' | 'bodyweight' | 'bodyweight_plus'
  sets: number
  repMin: number
  repMax: number
  /** Стартовый вес, если подходов ещё не было. */
  weightKg: number
}

export type DoneSet = { weightKg: number; reps: number }

export type NotificationView = {
  exerciseId: string
  /** Номер подхода, который сейчас предстоит сделать (с 1). */
  setNumber: number
  title: string
  body: string
  /** Подпись кнопки «+ Подход …» (Android). */
  actionTitle: string
  weightKg: number
  reps: number
}

function kg(value: number): string {
  return `${String(Number(value.toFixed(2))).replace('.', ',')} кг`
}

export function nextNotification(
  plan: NotifyExercise[],
  done: Record<string, DoneSet[]>,
): NotificationView | null {
  for (const exercise of plan) {
    const sets = done[exercise.exerciseId] ?? []
    if (sets.length >= exercise.sets) continue

    const last = sets[sets.length - 1]
    const bodyweight = exercise.loadType === 'bodyweight'
    const weightKg = bodyweight ? 0 : (last?.weightKg ?? exercise.weightKg)
    const reps = last?.reps ?? exercise.repMax
    const range =
      exercise.repMin === exercise.repMax ? `${exercise.repMax}` : `${exercise.repMin}–${exercise.repMax}`

    return {
      exerciseId: exercise.exerciseId,
      setNumber: sets.length + 1,
      title: `${exercise.name} · ${bodyweight ? 'свой вес' : kg(weightKg)}`,
      body: `Подход ${sets.length + 1} из ${exercise.sets} · ${range} раз`,
      actionTitle: bodyweight ? '+ Подход' : `+ Подход ${kg(weightKg)}`,
      weightKg,
      reps,
    }
  }

  return null
}
