import { LANDING_UI } from '../../../content/landing'
import { CtaLink } from './cta'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  steps: readonly [string, string, string]
  ctaHref: string
}

/**
 * «Как начать» (DESIGN.md §10.7): три шага с крупными красными цифрами Oswald.
 * Ниже — форма заявки для тех, кто не хочет регистрироваться сразу.
 */
export function Steps({ steps, ctaHref }: Props) {
  return (
    <Section
      id="steps"
      eyebrow={LANDING_UI.sections.steps}
      title={LANDING_UI.steps.title}
      className="border-t border-border/60"
    >
      <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
        {steps.map((step, index) => (
          <li key={step} className="relative">
            <Reveal
              delay={index * 0.08}
              className="flex h-full flex-col gap-3 rounded-card border border-border bg-surface-1 p-5 transition-colors hover:border-muscle-primary/50 md:p-6"
            >
              <span
                aria-hidden="true"
                className="font-display text-[56px] leading-none font-medium text-accent md:text-[72px]"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="sr-only">{`Шаг ${index + 1}`}</span>
              <p className="text-[17px] leading-snug text-text md:text-[20px]">{step}</p>
            </Reveal>
          </li>
        ))}
      </ol>

      <Reveal delay={0.12} className="flex flex-col items-center gap-3 pt-2">
        <CtaLink href={ctaHref}>{LANDING_UI.steps.cta}</CtaLink>
      </Reveal>
    </Section>
  )
}
