import { afterAll, beforeAll, expect, test } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { closeDb, prepareTestDb } from './db'

beforeAll(async () => {
  await prepareTestDb()
})

afterAll(async () => {
  await closeDb()
})

// Связь users.role_id → roles.id дописана в миграцию 0001 вручную (граница модулей
// не даёт объявить её в Drizzle). При пересоздании миграций её легко потерять.
test('внешний ключ users.role_id → roles.id существует', async () => {
  const rows = await db.execute(
    sql`select constraint_name from information_schema.table_constraints
        where table_name = 'users' and constraint_type = 'FOREIGN KEY'
          and constraint_name = 'users_role_id_roles_id_fk'`,
  )
  expect(rows.length).toBe(1)
})
