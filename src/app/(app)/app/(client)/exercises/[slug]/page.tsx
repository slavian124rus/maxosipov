import { notFound } from 'next/navigation'
import { requireClientPage } from '@/components/app/require-client-page'
import { ExerciseCard } from '@/components/exercise/exercise-card'
import { assertClientAccess } from '@/modules/access'
import Link from 'next/link'
import { getExercise, listAlternatives } from '@/modules/catalog'

// Экран зависит от сессии, подписки и упражнения.
export const instant = false

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireClientPage('/exercises')
  await assertClientAccess(user.id)

  const { slug } = await params
  const exercise = await getExercise(slug)
  if (!exercise) notFound()

  const alternatives = await listAlternatives(exercise.id)

  return (
    <main className="flex flex-col">
      <ExerciseCard exercise={exercise} />

      {alternatives.length > 0 ? (
        <section className="flex flex-col gap-2 px-4 pb-6 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:px-0">
          <h2 className="text-[17px] font-semibold lg:col-span-2">Можно заменить на</h2>
          <p className="text-[13px] text-text-muted lg:col-span-2">
            Если тренажёр занят — Максим советует эти
          </p>
          {alternatives.map((alt) => (
            <Link
              key={alt.id}
              href={`/exercises/${alt.slug}`}
              className="flex min-h-14 flex-col justify-center rounded-control border border-border bg-surface-1 px-3 py-2"
            >
              <span className="text-[15px]">{alt.name}</span>
              {alt.machineName ? (
                <span className="text-[13px] text-text-muted">{alt.machineName}</span>
              ) : null}
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  )
}
