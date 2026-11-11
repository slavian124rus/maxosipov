import Link from 'next/link'
import { requireUser } from '@/modules/auth'
import { can } from '@/modules/rbac'
import { listExercises, type ExerciseListItem } from '@/modules/catalog'
import { muscleName } from '@/shared/muscles'
import { ExerciseTree } from '@/components/trainer/exercise-tree'
import { PageHeader, TrainerPage } from '@/components/trainer/page'
import type { ExerciseTreeItem } from '@/components/trainer/catalog-tree'

// Кабинет зависит от сессии и прав.
export const instant = false

const VIDEO_LABEL: Record<string, string> = {
  uploaded: 'Ждёт обработки',
  processing: 'Обрабатывается…',
  ready: 'Готово',
  failed: 'Ошибка',
}

/** Подпись про видео для строки дерева. */
function videoLabel(item: ExerciseListItem): string {
  if (item.hasVideo) {
    return `видео: ${VIDEO_LABEL[item.videoStatus ?? ''] ?? item.videoStatus ?? 'нет'}`
  }

  return item.thumbUrl ? 'видео нет — в каталоге фото тренажёра' : 'видео нет'
}

export default async function TrainerExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { actor } = await requireUser()
  const { tab } = await searchParams

  const canEdit = can(actor, 'catalog.edit')
  // Один запрос на обе вкладки: дерево, поиск и счётчики вкладок живут в ExerciseTree.
  const items = await listExercises({ status: 'all' })

  const treeItems: ExerciseTreeItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    status: item.status === 'draft' ? 'draft' : 'published',
    machineId: item.machineId,
    machineName: item.machineName,
    machineZone: item.machineZone,
    // Поиск работает и по мышцам — названия берём из справочника.
    muscles: [...new Set([...item.primaryMuscles, ...item.secondaryMuscles])].map(muscleName),
    videoLabel: videoLabel(item),
    hasMuscles: item.hasMuscles,
  }))

  return (
    <TrainerPage>
      <PageHeader
        title="Упражнения"
        description="Каталог зала: зона → тренажёр → упражнение"
        actions={
          canEdit ? (
            <Link
              href="/trainer/exercises/new"
              className="flex min-h-11 items-center rounded-control bg-accent px-4 text-[15px] text-white hover:bg-accent-pressed"
            >
              Добавить
            </Link>
          ) : null
        }
      />

      <ExerciseTree items={treeItems} initialTab={tab === 'draft' ? 'draft' : 'published'} />
    </TrainerPage>
  )
}

