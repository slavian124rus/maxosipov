import { notFound } from 'next/navigation'
import { requireUser } from '@/modules/auth'
import { listExercises } from '@/modules/catalog'
import { getProgramTree, templateTitle } from '@/modules/training'
import { ProgramExerciseEditor } from '@/components/trainer/program-editor/program-exercise'
import type { CatalogItem } from '@/components/trainer/program-editor/program-editor'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import { assertProgramAccess } from '../../../access'

// Страница зависит от сессии и прав.
export const instant = false

/**
 * Упражнение внутри программы отдельной страницей (DESIGN.md §8.9): подходы,
 * повторения, отдых, вес, заметка и замена — здесь, а не в шторке поверх списка.
 */
export default async function ProgramExercisePage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>
}) {
  const { actor } = await requireUser()
  const { id, itemId } = await params

  const program = await getProgramTree(id)
  if (!program) notFound()

  await assertProgramAccess(actor, program)

  const day = program.days.find((entry) => entry.exercises.some((item) => item.id === itemId))
  const item = day?.exercises.find((entry) => entry.id === itemId)
  if (!day || !item) notFound()

  const catalog: CatalogItem[] = (await listExercises({ status: 'published' })).map((entry) => ({
    id: entry.id,
    name: entry.name,
    machineName: entry.machineName,
    zone: entry.machineZone,
    primary: entry.primaryMuscles,
  }))

  const info = catalog.find((entry) => entry.id === item.exerciseId)
  const clientId = program.ownerId
  const backHref = `/trainer/programs/${program.id}`
  const backLabel = clientId === null ? 'К шаблону' : 'К программе'

  const programTitle =
    clientId === null
      ? templateTitle({
          name: program.name,
          audience: program.audience ?? null,
          number: program.templateNumber ?? null,
        })
      : program.name

  return (
    <TrainerPage>
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        eyebrow={`${programTitle} · ${day.name}`}
        title={info?.name ?? 'Упражнение'}
        description={info?.machineName ?? 'Свободные веса'}
      />

      <ProgramExerciseEditor
        programId={program.id}
        clientId={clientId}
        backHref={backHref}
        backLabel={backLabel}
        dayName={day.name}
        item={item}
        exerciseName={info?.name ?? 'Упражнение'}
        catalog={catalog}
      />
    </TrainerPage>
  )
}
