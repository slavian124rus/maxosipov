import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/app/auth-shell'
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
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Введи код из СМС</h1>
        <p className="text-[15px] text-text-secondary">Отправили на {formatPhone(normalized)}</p>
      </div>

      <CodeForm target={{ kind: 'phone', phone: normalized }} linkId={link} />
    </AuthShell>
  )
}
