import { Quote } from 'lucide-react'
import type { Review } from '../../../content/landing'
import { LANDING_UI } from '../../../content/landing'
import { Reveal } from './reveal'
import { Section } from './section'

/**
 * «Результаты клиентов» (DESIGN.md §10.5): только реальные отзывы и фото с письменного
 * согласия. Пока их нет — блока не существует, разметка без пустых мест.
 */
export function Reviews({ reviews }: { reviews: Review[] | null }) {
  if (!reviews || reviews.length === 0) return null

  return (
    <Section
      id="reviews"
      eyebrow={LANDING_UI.sections.reviews}
      title={LANDING_UI.sections.reviews}
      className="border-y border-border/60 bg-surface-1/40"
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review, index) => (
          <Reveal
            key={`${review.name}-${index}`}
            delay={index * 0.06}
            className="flex h-full flex-col gap-4 rounded-card border border-border bg-surface-1 p-5"
          >
            <Quote size={22} strokeWidth={1.75} aria-hidden="true" className="text-muscle-primary" />

            <p className="flex-1 text-[15px] leading-relaxed text-text-secondary">{review.text}</p>

            <div className="flex items-center gap-3 border-t border-border pt-4">
              {review.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element -- фото клиента из public/ по согласию */
                <img
                  src={review.photo}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="size-10 rounded-full border border-border object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full border border-border bg-surface-2 font-display text-[14px] text-text-secondary"
                >
                  {review.name.slice(0, 1)}
                </span>
              )}
              <span className="text-[15px] font-semibold text-text">{review.name}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
