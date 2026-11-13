/**
 * Чинит обнулённые рабочие веса в активных программах клиентов (этап A, №2).
 * Для каждой программы вызывает `resolvePlanWeights`: «на следующий раз» → история → анкета.
 * Заданные веса не трогает.
 *
 * Запуск: `pnpm tsx scripts/repair-plan-weights.ts` (показывает, что изменилось бы, ничего не пишет)
 *         `pnpm tsx scripts/repair-plan-weights.ts --apply` (применяет)
 */
import { and, eq, isNotNull } from 'drizzle-orm'
import { client, db } from '@/shared/db'
import { programs, resolvePlanWeights } from '@/modules/training'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')

  const rows = await db
    .select({ id: programs.id, ownerId: programs.ownerId, name: programs.name })
    .from(programs)
    .where(and(eq(programs.status, 'active'), isNotNull(programs.ownerId)))

  let total = 0

  for (const row of rows) {
    if (!row.ownerId) continue

    if (apply) {
      const filled = await resolvePlanWeights(row.id, row.ownerId)
      total += filled
      if (filled > 0) console.log(`✓ ${row.name} (${row.id}): заполнено весов — ${filled}`)
    } else {
      // dry-run: считаем в транзакции и откатываем
      try {
        await db.transaction(async (tx) => {
          const filled = await resolvePlanWeights(row.id, row.ownerId!, {}, tx)
          total += filled
          if (filled > 0) console.log(`• ${row.name} (${row.id}): было бы заполнено — ${filled}`)
          throw new Error('rollback')
        })
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'rollback') throw error
      }
    }
  }

  console.log(`${apply ? 'Заполнено' : 'Было бы заполнено'} весов: ${total}`)
  await client.end()
}

void main()
