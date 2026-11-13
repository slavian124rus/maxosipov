import { AuthShell } from '@/components/app/auth-shell'
import { EmailForm } from '../forms'

// Экран всегда динамический: параметр `link` приходит в адресе.
export const instant = false

export default async function LoginEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>
}) {
  const { link } = await searchParams

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Вход по почте</h1>
        <p className="text-[15px] text-text-secondary">
          {link
            ? 'Подтверди почту — так мы защитим твой пробный месяц'
            : 'Пришлём код на почту. Он действует 10 минут'}
        </p>
      </div>

      <EmailForm linkId={link} />
    </AuthShell>
  )
}
