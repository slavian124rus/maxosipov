import type { ReactNode } from 'react'
import Image from 'next/image'
import { getGym } from '@/modules/gym'

/**
 * Экран входа на ПК (DESIGN.md §8.1): слева фото зала и бренд, справа — форма.
 * На телефоне остаётся одна колонка, как раньше.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const gym = await getGym()

  return (
    <div className="min-h-dvh w-full lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-surface-1 lg:block">
        <Image
          src="/landing/hero-wide.webp"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover object-[50%_28%] opacity-70"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,14,16,.35)_0%,rgba(14,14,16,.1)_55%,#0e0e10_100%)]"
        />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <span className="font-display text-[24px] leading-none font-medium tracking-wide">
            {gym.name}
          </span>
          <div className="flex max-w-[520px] flex-col gap-4">
            <p className="font-display text-[48px] leading-none font-medium xl:text-[56px]">
              Сильнее с каждой тренировкой
            </p>
            <p className="max-w-[440px] text-[16px] leading-relaxed text-text-secondary">
              Видео упражнений, дневник тренировок и ИИ-помощник МаксИИм — всё в одном приложении.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-4 py-10 lg:px-10 xl:px-16">
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-8">{children}</div>
      </main>
    </div>
  )
}
