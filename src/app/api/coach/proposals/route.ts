import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { listProposalCards } from '@/modules/coach-ai'

/** Предложения МаксИИма для карточки «Что изменится». */
export async function GET(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const conversationId = new URL(request.url).searchParams.get('conversationId') ?? undefined

  try {
    const proposals = await listProposalCards(current.user.id, conversationId)
    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('[coach-ai] предложения', error)
    return NextResponse.json({ error: 'Не удалось загрузить предложения' }, { status: 500 })
  }
}