import { LANDING_UI } from '../../../content/landing'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  title: string
  photo: string | null
  paragraphs: string[] | null
  facts: string[] | null
}

/**
 * «Обо мне» (DESIGN.md §10.4). Только реальные факты от владельца: пока нет ни фото,
 * ни текста, ни достижений — блок не выводится вовсе (план, Global Constraints).
 */
export function About({ title, photo, paragraphs, facts }: Props) {
  const hasText = paragraphs !== null && paragraphs.length > 0
  const hasFacts = facts !== null && facts.length > 0

  if (!photo && !hasText && !hasFacts) return null

  return (
    <Section id="about" eyebrow={LANDING_UI.sections.about} title={title} narrow>
      <div className="grid gap-8 md:grid-cols-[260px_1fr] md:gap-12">
        {photo ? (
          <Reveal className="flex justify-center md:justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- фото тренера из public/, размер задан владельцем */}
            <img
              src={photo}
              alt="Максим Осипов"
              width={520}
              height={650}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full max-w-[260px] rounded-card border border-border object-cover"
            />
          </Reveal>
        ) : null}

        {hasText || hasFacts ? (
          <Reveal delay={0.08} className="flex flex-col gap-4">
            {paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-[15px] leading-relaxed text-text-secondary md:text-[17px]">
                {paragraph}
              </p>
            ))}

            {facts ? (
              <ul className="mt-1 flex flex-col gap-2 border-t border-border pt-4">
                {facts.map((fact) => (
                  <li key={fact} className="flex items-start gap-3 text-[15px] text-text md:text-[17px]">
                    <span aria-hidden="true" className="mt-2.5 h-px w-5 shrink-0 bg-muscle-primary/70" />
                    {fact}
                  </li>
                ))}
              </ul>
            ) : null}
          </Reveal>
        ) : null}
      </div>
    </Section>
  )
}
