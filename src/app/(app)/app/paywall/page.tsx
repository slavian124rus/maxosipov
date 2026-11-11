import { requireClientPage } from '@/components/app/require-client-page'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getTrainerContacts } from '@/modules/gym'
import { formatPhone } from '@/modules/auth'

// Экран зависит от сессии.
export const instant = false

export default async function PaywallPage() {
  await requireClientPage('/paywall')

  const contacts = await getTrainerContacts()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      {contacts.photoUrl ? (
        <Image
          src={contacts.photoUrl}
          alt="Максим Осипов"
          width={160}
          height={160}
          className="h-40 w-40 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border border-border bg-surface-1 font-display text-[40px] text-text">
          МО
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Подписка закончилась</h1>
        <p className="text-[15px] text-text-secondary">Продли у Максима — и продолжаем</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {contacts.phone ? (
          <>
            <Button asChild>
              <a href={`tel:${contacts.phone}`}>Позвонить</a>
            </Button>
            <p className="text-[15px] text-text-secondary">{formatPhone(contacts.phone)}</p>
          </>
        ) : null}

        <Link
          href="/progress"
          className="text-[15px] text-accent underline-offset-4 hover:underline"
        >
          Посмотреть мой прогресс
        </Link>
      </div>
    </main>
  )
}
