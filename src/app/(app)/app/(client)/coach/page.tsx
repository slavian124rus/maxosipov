import { requireClientPage } from '@/components/app/require-client-page'

// Экран зависит от сессии и подписки.
export const instant = false

export default async function CoachPage() {
  await requireClientPage('/coach')

  return (
    <main className="flex flex-col gap-3 px-4 py-6">
      <h1 className="text-[22px] font-semibold">МаксИИм</h1>
      <p className="text-[15px] text-text-secondary">
        ИИ-помощник Максима появится на этапе «МаксИИм».
      </p>
    </main>
  )
}
