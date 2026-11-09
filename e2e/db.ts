import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  try {
    const env = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '')
    const line = env.split('\n').find((row) => row.trim().startsWith('DATABASE_URL='))
    if (line) {
      return line
        .trim()
        .slice('DATABASE_URL='.length)
        .trim()
        .replace(/^"|"$/g, '')
    }
  } catch {
    // нет .env — используем адрес по умолчанию
  }

  return 'postgres://app@127.0.0.1:5433/maxosipov'
}

/**
 * Прямой доступ к БД для проверок e2e (что реально записано на сервере).
 * `localhost` заменяем на `127.0.0.1`: на Windows Docker слушает IPv4,
 * а `localhost` может уйти в IPv6 и дать CONNECT_TIMEOUT.
 * Первое подключение после пересоздания базы иногда не успевает — одна повторная попытка.
 */
export async function queryDb<T extends object>(sql: string, params: string[] = []): Promise<T[]> {
  try {
    return await runQuery<T>(sql, params)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/CONNECT_TIMEOUT|ECONNREFUSED|Connection terminated/i.test(message)) throw error

    await new Promise((resolve) => setTimeout(resolve, 1000))
    return runQuery<T>(sql, params)
  }
}

async function runQuery<T extends object>(sql: string, params: string[]): Promise<T[]> {
  const client = postgres(databaseUrl().replace('@localhost:', '@127.0.0.1:'), {
    max: 1,
    connect_timeout: 15,
    idle_timeout: 5,
  })
  try {
    return (await client.unsafe(sql, params)) as unknown as T[]
  } finally {
    await client.end()
  }
}
