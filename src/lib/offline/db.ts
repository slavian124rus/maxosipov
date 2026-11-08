import type { Table } from 'dexie'

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

export type OfflineDb = {
  activeSession: Table<ActiveSessionRecord, string>
  sets: Table<OfflineSet, string>
  feelings: Table<OfflineFeelingRecord, number>
}

let instancePromise: Promise<OfflineDb> | null = null

type Row = Record<string, unknown>

/** Резервное хранилище в памяти: если IndexedDB/Dexie недоступны, тренировка не ломается. */
function createMemoryDb(): OfflineDb {
  const tables = {
    activeSession: new Map<unknown, Row>(),
    sets: new Map<unknown, Row>(),
    feelings: new Map<unknown, Row>(),
  }

  function tableApi(map: Map<unknown, Row>) {
    const matches = (row: Row, key: string, value: unknown): boolean => row[key] === value

    const query = (key: string, value: unknown) => ({
      toArray: async () => [...map.values()].filter((row) => matches(row, key, value)),
      count: async () => [...map.values()].filter((row) => matches(row, key, value)).length,
      limit: (count: number) => ({
        toArray: async () =>
          [...map.values()].filter((row) => matches(row, key, value)).slice(0, count),
      }),
      modify: async (patch: Row) => {
        for (const [id, row] of map) {
          if (matches(row, key, value)) map.set(id, { ...row, ...patch })
        }
      },
      anyOf: (values: unknown[]) => ({
        modify: async (patch: Row) => {
          for (const [id, row] of map) {
            if (values.includes(row[key])) map.set(id, { ...row, ...patch })
          }
        },
      }),
      and: (predicate: (row: Row) => boolean) => ({
        modify: async (patch: Row) => {
          for (const [id, row] of map) {
            if (matches(row, key, value) && predicate(row)) map.set(id, { ...row, ...patch })
          }
        },
      }),
    })

    return {
      put: async (row: Row) => void map.set(String(row.clientUuid ?? map.size), row),
      add: async (row: Row) => void map.set(map.size, row),
      clear: async () => map.clear(),
      where: (key: string) => ({
        equals: (value: unknown) => query(key, value),
        anyOf: (values: unknown[]) => query('clientUuid', values[0]),
      }),
      toCollection: () => ({
        first: async () => [...map.values()][0],
      }),
    }
  }

  return {
    activeSession: tableApi(tables.activeSession) as unknown as OfflineDb['activeSession'],
    sets: tableApi(tables.sets) as unknown as OfflineDb['sets'],
    feelings: tableApi(tables.feelings) as unknown as OfflineDb['feelings'],
  }
}

/**
 * Dexie подключается динамическим импортом: модуль попадает и в серверный бандл
 * (SSR клиентского компонента), где IndexedDB нет. Если Dexie всё же недоступен,
 * работаем на хранилище в памяти — подходы не потеряются до перезагрузки.
 */
export function getOfflineDb(): Promise<OfflineDb> {
  if (!instancePromise) {
    instancePromise = (async () => {
      try {
        const { default: Dexie } = await import('dexie')
        const db = new Dexie('maxosipov')
        db.version(1).stores({
          activeSession: 'clientUuid',
          sets: 'clientUuid, synced',
          feelings: '++id, sessionClientUuid, synced',
        })
        return db as unknown as OfflineDb
      } catch (error) {
        console.error('[offline] IndexedDB недоступен, работаем в памяти', error)
        return createMemoryDb()
      }
    })()
  }

  return instancePromise
}