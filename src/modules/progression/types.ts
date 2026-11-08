export type Feeling = 'easy' | 'good' | 'hard'

export type SessionSet = { weightKg: number; reps: number; feeling: Feeling | null }

/** Результат одной тренировки; история передаётся новыми первыми. */
export type SessionResult = { date: Date; sets: SessionSet[] }

export type ProgressionInput = {
  target: { sets: number; repMin: number; repMax: number }
  stepKg: number
  history: SessionResult[]
}

export type ProgressionRules = {
  sessionsToIncrease: number
  fastTrackOnEasy: boolean
  failSessionsToDrop: number
  dropPercent: number
}

export type ReasonCode = 'increase_streak' | 'increase_easy' | 'keep' | 'decrease' | 'none'

export type Recommendation = {
  action: 'increase' | 'keep' | 'decrease' | 'none'
  weightKg: number | null
  reasonCode: ReasonCode
}