import { requireClientPage } from '@/components/app/require-client-page'
import { ChatView } from '@/components/coach/chat-view'
import { assertClientAccess } from '@/modules/access'
import { getExercise } from '@/modules/catalog'

// Экран зависит от сессии и подписки.
export const instant = false

/** Новый чат: создаётся при первом сообщении, вопрос из ссылки подставляется в поле ввода. */
export default async function NewCoachChatPage({
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

  return (
    <ChatView
      initialConversationId={null}
      initialTitle={null}
      initialMessages={[]}
      initialProposals={[]}
      prefill={prefill}
    />
  )
}
