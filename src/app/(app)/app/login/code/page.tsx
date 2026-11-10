import { redirect } from 'next/navigation'
import { formatPhone, normalizePhone } from '@/modules/auth'
import { CodeForm } from '../forms'

// Экран всегда динамический: номер приходит в адресе.
export const instant = false

export default async function LoginCodePage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; link?: string }>
}) {
  const { phone, link } = await searchParams
  const normalized = phone ? normalizePhone(phone) : null

  if (!normalized) redirect('/login/phone')

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Введи код из СМС</h1>
        <p className="text-[15px] text-text-secondary">Отправили на {formatPhone(normalized)}</p>
      </div>

      <CodeForm target={{ kind: 'phone', phone: normalized }} linkId={link} />
    </main>
  )
}
