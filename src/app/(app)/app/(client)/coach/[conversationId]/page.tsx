import { notFound } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { ChatView } from '@/components/coach/chat-view'
import { assertClientAccess } from '@/modules/access'
import {
  getConversationMessages,
  getConversationTitle,
  listProposalCards,
} from '@/modules/coach-ai'

// Экран зависит от сессии и подписки.
export const instant = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CoachChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { user } = await requireClientPage('/coach')
  await assertClientAccess(user.id)

  const { conversationId } = await params
  if (!UUID.test(conversationId)) notFound()

  const messages = await getConversationMessages(user.id, conversationId)
  if (!messages) notFound()

  const [title, proposals] = await Promise.all([
    getConversationTitle(user.id, conversationId),
    listProposalCards(user.id, conversationId),
  ])

  return (
    <ChatView
      initialConversationId={conversationId}
      initialTitle={title}
      initialMessages={messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      }))}
      initialProposals={proposals}
      prefill={null}
    />
  )
}
