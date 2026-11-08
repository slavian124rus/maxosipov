import { muscleView, type MuscleCode } from '@/modules/catalog'

export type FigureSide = 'front' | 'back'

export type MuscleState = {
  primary: MuscleCode[]
  secondary: MuscleCode[]
}

/** Сторона, где больше основных мышц; при равенстве — спереди. */
export function defaultView(primary: MuscleCode[]): FigureSide {
  let front = 0
  let back = 0

  for (const code of primary) {
    const view = muscleView(code)
    if (view === 'front') front += 1
    if (view === 'back') back += 1
  }

  return back > front ? 'back' : 'front'
}

/**
 * Одно касание — основная мышца, второе — помогающая, третье — убрать.
 * Мышца никогда не бывает одновременно основной и помогающей.
 */
export function cycleMuscle(state: MuscleState, code: MuscleCode): MuscleState {
  const inPrimary = state.primary.includes(code)
  const inSecondary = state.secondary.includes(code)

  if (inPrimary) {
    return {
      primary: state.primary.filter((item) => item !== code),
      secondary: [...state.secondary.filter((item) => item !== code), code],
    }
  }

  if (inSecondary) {
    return {
      primary: state.primary.filter((item) => item !== code),
      secondary: state.secondary.filter((item) => item !== code),
    }
  }

  return {
    primary: [...state.primary, code],
    secondary: state.secondary.filter((item) => item !== code),
  }
}
