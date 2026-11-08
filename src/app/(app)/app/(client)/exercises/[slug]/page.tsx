import { notFound } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { ExerciseCard } from '@/components/exercise/exercise-card'
import { assertClientAccess } from '@/modules/access'
import { getExercise } from '@/modules/catalog'

// Экран зависит от сессии, подписки и упражнения.
export const instant = false

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireClientPage('/exercises')
  await assertClientAccess(user.id)

  const { slug } = await params
  const exercise = await getExercise(slug)
  if (!exercise) notFound()

  return (
    <main className="flex flex-col">
      <ExerciseCard exercise={exercise} />
    </main>
  )
}
