import { redirect } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { ConversationList } from '@/components/coach/conversation-list'
import { assertClientAccess } from '@/modules/access'
import { listConversations } from '@/modules/coach-ai'

// Экран зависит от сессии и подписки.
export const instant = false

/** Список чатов с МаксИИмом (DESIGN.md §8.6). Старые ссылки «?question=» открывают новый чат. */
export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; question?: string }>
}) {
  const { user } = await requireClientPage('/coach')
  await assertClientAccess(user.id)

  const { exercise, question } = await searchParams
  if (exercise || question) {
    const query = new URLSearchParams()
    if (exercise) query.set('exercise', exercise)
    if (question) query.set('question', question)
    redirect(`/coach/new?${query.toString()}`)
  }

  const conversations = await listConversations(user.id)

  return (
    <ConversationList
      items={conversations.map((item) => ({
        id: item.id,
        title: item.title,
        lastText: item.lastText,
        lastAt: item.lastAt.toISOString(),
        hasPending: item.hasPending,
      }))}
    />
  )
}
