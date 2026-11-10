import type { InsideItem } from '../../../content/landing'
import { PhoneFrame } from './phone-frame'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  eyebrow: string
  title: string
  items: InsideItem[]
  lead: string
}

/**
 * «Что внутри приложения» (DESIGN.md §10.2): три телефона-макета со скриншотами.
 * Средний макет приподнят и подсвечен — композиция не выглядит плоской.
 */
export function Inside({ eyebrow, title, items, lead }: Props) {
  return (
    <Section id="inside" eyebrow={eyebrow} title={title} lead={lead}>
      <div className="grid gap-12 md:grid-cols-3 md:gap-6 md:pt-4">
        {items.map((item, index) => (
          <Reveal
            key={item.title}
            delay={index * 0.08}
            className="flex flex-col items-center gap-6 md:items-start"
          >
            <div className={`flex w-full justify-center ${index === 1 ? 'md:-translate-y-8' : ''}`}>
              <PhoneFrame
                src={item.image}
                alt={`${item.title} — экран приложения`}
                glow={index === 1}
              />
            </div>

            <div className="flex max-w-[340px] flex-col gap-2 text-center md:text-left">
              <h3 className="font-display text-[20px] leading-tight font-medium text-text md:text-[22px]">
                {item.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-text-secondary">{item.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
