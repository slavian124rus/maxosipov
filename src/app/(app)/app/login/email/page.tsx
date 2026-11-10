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
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Вход по почте</h1>
        <p className="text-[15px] text-text-secondary">
          {link
            ? 'Подтверди почту — так мы защитим твой пробный месяц'
            : 'Пришлём код на почту. Он действует 10 минут'}
        </p>
      </div>

      <EmailForm linkId={link} />
    </main>
  )
}
