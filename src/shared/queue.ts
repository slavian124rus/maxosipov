import { PgBoss } from 'pg-boss'
import { QUEUE_TUNING } from '@/modules/media/queues'
import { env } from './env'

let bossPromise: Promise<PgBoss> | null = null
const createdQueues = new Set<string>()

/** Ленивый singleton pg-boss для веб-процесса (постановка задач в очередь). */
function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    const boss = new PgBoss(env.DATABASE_URL)
    boss.on('error', (error) => console.error('[queue] ошибка pg-boss', error))
    bossPromise = boss.start().then(() => boss)
  }
  return bossPromise
}

/** Ставит задачу в очередь. Имена очередей — через точку (`media.process`). */
export async function enqueueJob(name: string, data: object): Promise<void> {
  const boss = await getBoss()

  if (!createdQueues.has(name)) {
    await boss.createQueue(name, QUEUE_TUNING[name])
    createdQueues.add(name)
  }

  await boss.send(name, data)
}
