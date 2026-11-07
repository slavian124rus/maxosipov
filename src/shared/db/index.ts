import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/shared/env'
import * as schema from './schema'

/**
 * В тестах работаем с отдельной базой (`TEST_DATABASE_URL`), чтобы не затирать dev-данные.
 */
const connectionString =
  env.NODE_ENV === 'test' && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql }

export const client: postgres.Sql = globalForDb.pgClient ?? postgres(connectionString, { max: 10 })

if (env.NODE_ENV !== 'production') {
  globalForDb.pgClient = client
}

export const db = drizzle(client, { schema })

export { schema }
