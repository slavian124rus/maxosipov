import type { SessionResult } from './types'

export type BodyweightRecommendation = {
  action: 'increase' | 'keep' | 'none'
  text: string
}

type Input = {
  target: { sets: number; repMin: number; repMax: number }
  /** Завершённые тренировки, новые первыми. */
  history: SessionResult[]
  /** Совет «как усложнить» из карточки упражнения. */
  tip?: string | null
  /** `bodyweight_plus`: усложнить можно добавив вес. */
  canAddWeight?: boolean
}

function allSetsDone(session: SessionResult, sets: number, repMax: number): boolean {
  return session.sets.length >= sets && session.sets.every((set) => set.reps >= repMax)
}

/**
 * Прогрессия для упражнений «со своим весом»: килограммов нет, считаем только повторения.
 * Две тренировки подряд с `repMax` во всех подходах — пора усложнять; иначе добиваем повторения.
 */
export function recommendBodyweight(input: Input): BodyweightRecommendation {
  const { target, history } = input

  if (history.length === 0) {
    return {
      action: 'none',
      text: `Сделай ${target.repMin}–${target.repMax} раз в каждом подходе, вес не нужен`,
    }
  }

  const streak =
    history.length >= 2 &&
    allSetsDone(history[0]!, target.sets, target.repMax) &&
    allSetsDone(history[1]!, target.sets, target.repMax)

  if (streak) {
    const how = input.tip?.trim()
      ? input.tip.trim()
      : input.canAddWeight
        ? 'добавь небольшое отягощение'
        : 'сделай вариант сложнее или добавь повторения'

    return { action: 'increase', text: `Пора усложнить: ${how}` }
  }

  return { action: 'keep', text: `Добиваем ${target.repMax} повторений во всех подходах` }
}
