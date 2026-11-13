import { PhoneForm } from '../forms'

// Экран всегда динамический: параметр `link` приходит в адресе.
export const instant = false

export default async function LoginPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>
}) {
  const { link } = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold">Вход по номеру</h1>
        <p className="text-[15px] text-text-secondary">
          {link
            ? 'Подтверди номер — так мы защитим твой пробный месяц'
            : 'Пришлём код в СМС. Он действует 5 минут'}
        </p>
      </div>

      <PhoneForm linkId={link} />
    </main>
  )
}
