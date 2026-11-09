import { NextResponse } from 'next/server'
import { assertClientAccess } from '@/modules/access'
import { getCurrentUser } from '@/modules/auth'
import { getSessionAiSummary } from '@/modules/coach-ai'
import { ForbiddenError } from '@/modules/rbac'

/** Итог МаксИИма для экрана завершения: опрос раз в 2 секунды. */
export async function GET(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const sessionClientUuid = new URL(request.url).searchParams.get('sessionClientUuid')
  if (!sessionClientUuid) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  try {
    await assertClientAccess(current.user.id)
    const summary = await getSessionAiSummary(current.user.id, sessionClientUuid)
    return NextResponse.json({ summary })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
}