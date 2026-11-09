import { requireClientPage } from '@/components/app/require-client-page'
import { ChatView } from '@/components/coach/chat-view'
import { assertClientAccess } from '@/modules/access'
import { getExercise } from '@/modules/catalog'
import { getChatHistory, listProposalCards } from '@/modules/coach-ai'

// Экран зависит от сессии и подписки.
export const instant = false

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; question?: string }>
}) {
  const { user } = await requireClientPage('/coach')
  await assertClientAccess(user.id)

  const { exercise: slug, question } = await searchParams
  let prefill = question ?? null

  if (slug) {
    const exercise = await getExercise(slug)
    if (exercise) prefill = `Расскажи про упражнение „${exercise.name}“`
  }

  const history = await getChatHistory(user.id)
  const proposals = history.conversationId
    ? await listProposalCards(user.id, history.conversationId)
    : []

  return (
    <ChatView
      initialConversationId={history.conversationId}
      initialMessages={history.messages}
      initialProposals={proposals}
      prefill={prefill}
    />
  )
}
