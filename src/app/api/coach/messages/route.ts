import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth'
import { getConversationMessages } from '@/modules/coach-ai'

/** Сохранённые сообщения чата: клиент забирает ответ, который дописался, пока телефон спал. */
export async function GET(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 })

  const conversationId = new URL(request.url).searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })

  const messages = await getConversationMessages(current.user.id, conversationId)
  if (!messages) return NextResponse.json({ error: 'Чат не найден' }, { status: 404 })

  return NextResponse.json({
    messages: messages.map((item) => ({
      role: item.role,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
    })),
  })
}
