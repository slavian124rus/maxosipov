import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  try {
    const env = readFileSync('.env', 'utf8')
    const line = env.split('\n').find((row) => row.startsWith('DATABASE_URL='))
    if (line) return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '')
  } catch {
    // нет .env — используем адрес по умолчанию
  }

  return 'postgres://app@127.0.0.1:5433/maxosipov'
}

/** Прямой доступ к БД для проверок e2e (что реально записано на сервере). */
export async function queryDb<T extends object>(sql: string, params: string[] = []): Promise<T[]> {
  const client = postgres(databaseUrl(), { max: 1 })
  try {
    return (await client.unsafe(sql, params)) as unknown as T[]
  } finally {
    await client.end()
  }
}
