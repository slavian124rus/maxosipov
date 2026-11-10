import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { env } from '@/shared/env'

// Сообщение об ошибке OAuth приходит в адресе.
export const instant = false

const LOGIN_ERRORS: Record<string, string> = {
  oauth: 'Не получилось войти. Попробуй ещё раз или войди по номеру',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const vkReady = Boolean(env.VK_CLIENT_ID && env.VK_CLIENT_SECRET)
  const yandexReady = Boolean(env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET)

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[40px] leading-none font-medium">Тренируйся с Максимом</h1>
        <p className="text-[15px] text-text-secondary">
          Видео упражнений, дневник и ИИ-помощник МаксИИм
        </p>
      </div>

      {error && LOGIN_ERRORS[error] ? (
        <p className="rounded-card border border-border bg-surface-1 px-4 py-3 text-[15px] text-danger">
          {LOGIN_ERRORS[error]}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {vkReady ? (
          <Button asChild>
            <a href="/api/auth/vk/start">Войти через VK ID</a>
          </Button>
        ) : null}

        {yandexReady ? (
          <Button asChild variant="secondary">
            <a href="/api/auth/yandex/start">Войти через Яндекс ID</a>
          </Button>
        ) : null}

        <Link
          href="/login/phone"
          className="text-center text-[15px] text-accent underline-offset-4 hover:underline"
        >
          Войти по номеру телефона
        </Link>
      </div>

      <p className="text-center text-[13px] text-text-muted">
        Продолжая, ты соглашаешься с{' '}
        <Link href="/legal/privacy" className="underline">
          политикой обработки персональных данных
        </Link>
      </p>
    </main>
  )
}
