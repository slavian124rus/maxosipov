import { LANDING_UI } from '../../../content/landing'
import { Eyebrow } from './section'
import { Reveal } from './reveal'

type Props = {
  title: string
  photo: string | null
  paragraphs: string[] | null
  facts: string[] | null
}

/**
 * «Обо мне». Только реальные факты от владельца: пока нет ни фото, ни текста, ни
 * достижений — блок не выводится вовсе (план, Global Constraints).
 * Слева фото с красной рамкой-смещением, справа — абзацы и факты карточками.
 */
export function About({ title, photo, paragraphs, facts }: Props) {
  const hasText = paragraphs !== null && paragraphs.length > 0
  const hasFacts = facts !== null && facts.length > 0

  if (!photo && !hasText && !hasFacts) return null

  return (
    <section id="about" className="relative scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-20">
        {photo ? (
          <Reveal className="relative mx-auto w-full max-w-[420px] lg:mx-0">
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-x-3 translate-y-3 rounded-sheet border-2 border-accent/70 md:translate-x-4 md:translate-y-4"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- фото тренера из public/, размер задан владельцем */}
            <img
              src={photo}
              alt="Максим Осипов"
              width={800}
              height={1000}
              loading="lazy"
              decoding="async"
              className="relative aspect-[4/5] w-full rounded-sheet border border-border object-cover object-[50%_30%]"
            />
          </Reveal>
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          <Reveal className="flex flex-col gap-3">
            <Eyebrow>{LANDING_UI.sections.about}</Eyebrow>
            <h2 className="font-display text-[34px] leading-[1.04] font-medium text-text md:text-[48px]">
              {title}
            </h2>
          </Reveal>

          {hasText ? (
            <Reveal delay={0.06} className="flex flex-col gap-4">
              {paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-[16px] leading-relaxed text-text-secondary md:text-[18px]">
                  {paragraph}
                </p>
              ))}
            </Reveal>
          ) : null}

          {hasFacts ? (
            <Reveal delay={0.1}>
              <ul className="grid gap-3">
                {facts?.map((fact, index) => (
                  <li
                    key={fact}
                    className="group flex items-center gap-4 rounded-card border border-border bg-surface-1 p-4 transition-colors hover:border-muscle-primary/50 md:p-5"
                  >
                    <span
                      aria-hidden="true"
                      className="font-display text-[28px] leading-none font-medium text-accent md:text-[34px]"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 text-[16px] leading-snug text-text md:text-[18px]">{fact}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  )
}
