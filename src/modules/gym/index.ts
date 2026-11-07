import { db } from '@/shared/db'
import {
  gyms,
  type Gym,
  type GymBrand,
  type GymSettings,
  type NewGym,
  type ProgressionRules,
} from './schema'

export { gyms }
export type { Gym, NewGym, GymBrand, GymSettings, ProgressionRules }

/** Первый (пока единственный) зал. Если сид не выполнен — падаем с понятным сообщением. */
export async function getGym(): Promise<Gym> {
  const [gym] = await db.select().from(gyms).limit(1)
  if (!gym) {
    throw new Error('Gym not seeded')
  }
  return gym
}
