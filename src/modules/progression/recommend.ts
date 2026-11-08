import type {
  ProgressionInput,
  ProgressionRules,
  Recommendation,
  SessionResult,
} from './types'

const EPSILON = 1e-9

type SessionSummary = {
  weightKg: number
  workingSets: { reps: number; feeling: 'easy' | 'good' | 'hard' | null }[]
  feeling: 'easy' | 'good' | 'hard' | null
}

/** Максимальный вес сессии — рабочий; разминочные подходы в расчёт не идут. */
function summarize(session: SessionResult): SessionSummary {
  const weightKg = Math.max(...session.sets.map((set) => set.weightKg))
  const workingSets = session.sets
    .filter((set) => set.weightKg === weightKg)
    .map((set) => ({ reps: set.reps, feeling: set.feeling }))

  const hard = workingSets.some((set) => set.feeling === 'hard')
  const lastFeeling = workingSets.at(-1)?.feeling ?? null

  return { weightKg, workingSets, feeling: hard ? 'hard' : lastFeeling }
}

function floorStep(value: number, step: number): number {
  return Math.floor(value / step + EPSILON) * step
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Детерминированная рекомендация веса (ARCHITECTURE.md §10).
 * Правила: повышение по серии или сразу после «легко», снижение после провалов.
 */
export function recommend(input: ProgressionInput, rules: ProgressionRules): Recommendation {
  const { target, stepKg, history } = input

  if (history.length === 0 || stepKg <= 0) {
    return { action: 'none', weightKg: null, reasonCode: 'none' }
  }

  const sessions = history.map(summarize)
  const current = sessions[0]!
  const weight = current.weightKg

  const completedAllSets = (session: SessionSummary): boolean =>
    session.workingSets.length >= target.sets &&
    session.workingSets.every((set) => set.reps >= target.repMax)

  const isEasy = (session: SessionSummary): boolean =>
    session.workingSets.every((set) => set.feeling === 'easy')

  // 4. Повышение сразу: одна тренировка, все подходы «легко» и выполнены повторения.
  if (rules.fastTrackOnEasy && completedAllSets(current) && isEasy(current)) {
    return { action: 'increase', weightKg: round(weight + stepKg), reasonCode: 'increase_easy' }
  }

  // 5. Повышение по серии: последние N тренировок на том же весе сделаны полностью.
  const streak = sessions.slice(0, rules.sessionsToIncrease)
  if (
    streak.length === rules.sessionsToIncrease &&
    streak.every(
      (session) => session.weightKg === weight && completedAllSets(session) && session.feeling !== 'hard',
    )
  ) {
    return { action: 'increase', weightKg: round(weight + stepKg), reasonCode: 'increase_streak' }
  }

  // 6. Снижение: N тренировок подряд, где больше половины подходов ниже минимума.
  const failures = sessions.slice(0, rules.failSessionsToDrop)
  if (
    failures.length === rules.failSessionsToDrop &&
    failures.every((session) => {
      if (session.weightKg !== weight) return false
      const below = session.workingSets.filter((set) => set.reps < target.repMin).length
      return below * 2 > session.workingSets.length
    })
  ) {
    const dropped = floorStep(weight * (1 - rules.dropPercent / 100), stepKg)
    return {
      action: 'decrease',
      weightKg: round(Math.max(0, Math.min(dropped, weight - stepKg))),
      reasonCode: 'decrease',
    }
  }

  return { action: 'keep', weightKg: weight, reasonCode: 'keep' }
}