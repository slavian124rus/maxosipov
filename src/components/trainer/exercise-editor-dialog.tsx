'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExerciseEditor } from '@/components/trainer/exercise-editor'
import {
  loadExerciseAction,
  type ExerciseLoadState,
} from '@/app/(app)/app/trainer/exercises/actions'

/**
 * Окно правки упражнения (DESIGN.md §8.9): открывается касанием строки в дереве,
 * внутри — вкладки «Описание», «Видео», «Тренажёр», «Мышцы», «Публикация».
 * Данные грузим по требованию, дерево после сохранения обновляем через router.refresh().
 */
export function ExerciseEditorDialog({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null
  onClose: () => void
}) {
  const router = useRouter()

  function afterSave(): void {
    // Название и статус в дереве приходят с сервера — перерисовываем его.
    router.refresh()
  }

  return (
    <Dialog open={exerciseId !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[92dvh] w-full overflow-y-auto p-0 sm:max-w-[860px]">
        {exerciseId ? (
          // Ключ по id: при открытии другого упражнения состояние формы сбрасывается само.
          <ExerciseLoader key={exerciseId} exerciseId={exerciseId} onSaved={afterSave} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Загрузка данных упражнения и рендер вкладок; состояние сбрасывается через `key`. */
function ExerciseLoader({
  exerciseId,
  onSaved,
}: {
  exerciseId: string
  onSaved: () => void
}) {
  const [data, setData] = useState<ExerciseLoadState | null>(null)

  useEffect(() => {
    let cancelled = false

    loadExerciseAction(exerciseId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) {
          setData({ exercise: null, machines: [], error: 'Не удалось загрузить упражнение' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [exerciseId])

  return (
    <>
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className="text-[17px]">
          {data?.exercise ? data.exercise.name : 'Упражнение'}
        </DialogTitle>
        <DialogDescription>
          Правь любой раздел и сохраняй — проходить мастер заново не нужно
        </DialogDescription>
      </DialogHeader>

      <div className="px-5 pt-4 pb-5">
        {data === null ? (
          <p className="text-[15px] text-text-secondary">Загружаем…</p>
        ) : data.error || !data.exercise ? (
          <p className="text-[15px] text-danger">{data.error ?? 'Упражнение не найдено'}</p>
        ) : (
          <ExerciseEditor exercise={data.exercise} machines={data.machines} onSaved={onSaved} />
        )}
      </div>
    </>
  )
}
