import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { env } from '@/shared/env'

export default function LoginPage() {
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

        <Button variant="secondary" disabled className="justify-between">
          <span>Войти через MAX</span>
          <span className="text-[13px] text-text-muted">скоро</span>
        </Button>

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
