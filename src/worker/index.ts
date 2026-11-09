import 'dotenv/config'
import { PgBoss } from 'pg-boss'
import { env, missingAiEnv } from '@/shared/env'
import { registerJobs } from './jobs'

/** Точка входа фоновых задач: очередь pg-boss на той же PostgreSQL. */
export async function startWorker(): Promise<void> {
  const boss = new PgBoss(env.DATABASE_URL)

  boss.on('error', (error) => {
    console.error('[worker] ошибка pg-boss', error)
  })

  await boss.start()
  await registerJobs(boss)
  console.log('[worker] запущен')

  if (env.NODE_ENV === 'production') {
    const missing = missingAiEnv(env)
    if (missing.length > 0) {
      console.warn(`[worker] МаксИИм не настроен, не заполнено: ${missing.join(', ')}`)
    }
  }

  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`[worker] получен ${signal}, останавливаюсь`)
    await boss.stop({ graceful: true, timeout: 30_000 })
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

startWorker().catch((error) => {
  console.error('[worker] не запустился', error)
  process.exit(1)
})
