import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { db } from '@/shared/db'
import { programChanges, programs } from '@/modules/training'

/** Версия программы для опроса изменений: хэш `updated_at` и числа правок. */
export async function GET(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const programId = new URL(request.url).searchParams.get('programId')
  if (!programId) return NextResponse.json({ error: 'Нужен programId' }, { status: 400 })

  const [program] = await db
    .select({ ownerId: programs.ownerId, updatedAt: programs.updatedAt })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1)

  if (!program) return NextResponse.json({ error: 'Программа не найдена' }, { status: 404 })
  if (program.ownerId !== current.user.id) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  const changes = await db
    .select({ id: programChanges.id })
    .from(programChanges)
    .where(and(eq(programChanges.programId, programId)))

  const version = createHash('sha256')
    .update(`${program.updatedAt.toISOString()}:${changes.length}`)
    .digest('hex')
    .slice(0, 16)

  return NextResponse.json({ version })
}