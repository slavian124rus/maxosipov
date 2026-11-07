import 'dotenv/config'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { client, db } from '@/shared/db'

/** Применяет миграции из `./drizzle`. Запускается контейнером `web` перед стартом. */
async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Миграции применены')
  await client.end()
}

main().catch((error) => {
  console.error('Миграции не применились', error)
  process.exit(1)
})
