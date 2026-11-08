import Dexie, { type Table } from 'dexie'

export type OfflineFeeling = 'easy' | 'good' | 'hard'

/** Активная тренировка: одна запись, живёт до завершения. */
export type ActiveSessionRecord = {
  clientUuid: string
  programDayId: string | null
  mode: 'free' | 'guided'
  startedAt: string
  /** Снимок программы на момент старта — по нему рисуем экран без сети. */
  programSnapshot: unknown
}

export type OfflineSet = {
  clientUuid: string
  sessionClientUuid: string
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  feeling?: OfflineFeeling
  startedAt?: string
  finishedAt?: string
  loggedOffline: boolean
  synced: 0 | 1
}

export type OfflineFeelingRecord = {
  id?: number
  sessionClientUuid: string
  exerciseId: string
  feeling: OfflineFeeling
  synced: 0 | 1
}

class OfflineDatabase extends Dexie {
  activeSession!: Table<ActiveSessionRecord, string>
  sets!: Table<OfflineSet, string>
  feelings!: Table<OfflineFeelingRecord, number>

  constructor() {
    super('maxosipov')
    this.version(1).stores({
      activeSession: 'clientUuid',
      sets: 'clientUuid, synced',
      feelings: '++id, sessionClientUuid, synced',
    })
  }
}

export const offlineDb = new OfflineDatabase()