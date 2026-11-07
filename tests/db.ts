import { client, db } from '@/shared/db'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { DEFAULT_ROLES } from '@/modules/rbac'
import { roles, type Role } from '@/modules/rbac/schema'

/** Прогоняет миграции по тестовой базе (`TEST_DATABASE_URL`). */
export async function prepareTestDb(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' })
}

/** Очищает все таблицы public-схемы, чтобы тесты не зависели друг от друга. */
export async function resetDb(): Promise<void> {
  const tables = await client<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `
  if (tables.length === 0) return
  const list = tables.map((row) => `"${row.tablename}"`).join(', ')
  await client.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/** Сид ролей по умолчанию. Возвращает роли по имени. */
export async function seedDefaultRoles(): Promise<Record<string, Role>> {
  const inserted = await db.insert(roles).values(DEFAULT_ROLES).returning()
  return Object.fromEntries(inserted.map((role) => [role.name, role]))
}

/** Закрывает соединение с тестовой базой (чтобы vitest не висел). */
export async function closeDb(): Promise<void> {
  await client.end()
}
