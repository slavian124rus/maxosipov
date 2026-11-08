import { requireClientPage } from '@/components/app/require-client-page'

// Экран зависит от сессии и подписки.
export const instant = false

export default async function WorkoutsPage() {
  await requireClientPage('/workouts')

  return (
    <main className="flex flex-col gap-3 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Тренировки</h1>
      <p className="text-[15px] text-text-secondary">
        Программы и история тренировок появятся на этапе «Тренировки».
      </p>
    </main>
  )
}
