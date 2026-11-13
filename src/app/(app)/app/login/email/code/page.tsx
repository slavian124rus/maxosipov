import { redirect } from 'next/navigation'
import { normalizeEmail } from '@/modules/auth'
import { CodeForm } from '../../forms'

// Экран всегда динамический: почта приходит в адресе.
export const instant = false

export default async function LoginEmailCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; link?: string }>
}) {
  const { email, link } = await searchParams
  const normalized = email ? normalizeEmail(email) : null

  if (!normalized) redirect('/login/email')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Введи код из письма</h1>
        <p className="text-[15px] text-text-secondary">
          Отправили на {normalized}. Если письма нет — загляни в «Спам»
        </p>
      </div>

      <CodeForm target={{ kind: 'email', email: normalized }} linkId={link} />
    </main>
  )
}
