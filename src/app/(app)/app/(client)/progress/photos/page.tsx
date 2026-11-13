import type { Metadata } from 'next'
import { ClientBackLink } from '@/components/app/back-link'
import { requireClientPage } from '@/components/app/require-client-page'
import { PhotoCompare } from '@/components/progress/photo-compare'
import { PhotosClient } from '@/components/progress/photos-client'
import { getAccessForUser } from '@/modules/access'
import { listProgressPhotos } from '@/modules/body'

// Фото — персональные данные: не индексируем и не кэшируем публично.
export const metadata: Metadata = { robots: { index: false, follow: false } }
export const instant = false

export default async function ProgressPhotosPage() {
  const { user, actor } = await requireClientPage('/progress')
  const access = await getAccessForUser(user.id)
  const photos = await listProgressPhotos(actor, user.id)

  return (
    <main className="flex flex-col gap-4 px-4 py-6 lg:mx-auto lg:w-full lg:max-w-[1000px] lg:px-0 lg:py-0">
      <ClientBackLink href="/progress" label="К прогрессу" />
      <h1 className="text-[22px] font-semibold">Фото прогресса</h1>

      <PhotosClient photos={photos} canWrite={access.hasAccess} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">До / после</h2>
        <PhotoCompare photos={photos} />
      </section>
    </main>
  )
}
