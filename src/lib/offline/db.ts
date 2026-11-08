import Dexie, { type Table } from 'dexie'

export type OfflineFeeling = 'easy' | 'good' | 'hard'

/** Тренировка на устройстве. Живёт, пока сервер не подтвердит и старт, и завершение. */
export type ActiveSessionRecord = {
  clientUuid: string
  programDayId: string | null
  mode: 'free' | 'guided'
  startedAt: string
  /** Снимок программы на момент старта. */
  programSnapshot: unknown
  /** Сервер узнал о тренировке (`/api/training/start` вернул ok). */
  startSynced: boolean
  /** Клиент нажал «Завершить»; запись удаляется после подтверждения сервером. */
  finishRequestedAt?: string
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

export type OfflineDb = {
  activeSession: Table<ActiveSessionRecord, string>
  sets: Table<OfflineSet, string>
}

class MaxosipovDb extends Dexie implements OfflineDb {
  activeSession!: Table<ActiveSessionRecord, string>
  sets!: Table<OfflineSet, string>

  constructor() {
    super('maxosipov')

    // v1 не индексировала `sessionClientUuid`, из-за чего `where('sessionClientUuid')` падал
    // с SchemaError. v2 добавляет индекс и убирает неиспользуемую таблицу `feelings`
    // (ощущение теперь хранится в самих подходах и уходит вместе с ними).
    this.version(1).stores({
      activeSession: 'clientUuid',
      sets: 'clientUuid, synced',
      feelings: '++id, sessionClientUuid, synced',
    })
    this.version(2)
      .stores({
        activeSession: 'clientUuid',
        sets: 'clientUuid, synced, sessionClientUuid',
        feelings: null,
      })
      .upgrade(async (tx) => {
        // записи v1 не знали про `startSynced`: считаем старт неотправленным — повтор безопасен
        await tx
          .table('activeSession')
          .toCollection()
          .modify((record: Partial<ActiveSessionRecord>) => {
            record.startSynced = record.startSynced ?? false
          })
      })
  }
}

let instance: MaxosipovDb | null = null

/** Лениво создаёт базу: на сервере (SSR) её не трогаем, пока не вызвали из браузера. */
export async function getOfflineDb(): Promise<OfflineDb> {
  instance ??= new MaxosipovDb()
  return instance
}
