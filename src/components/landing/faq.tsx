import { Plus } from 'lucide-react'
import { Reveal } from './reveal'
import { Section } from './section'

type Item = { q: string; a: string }

type Props = {
  eyebrow: string
  title: string
  items: readonly Item[]
}

/**
 * Частые вопросы. Обычные `<details name="faq">`: работают без JS, открыт один пункт
 * за раз, читаются скринридерами; плюс поворачивается в крестик через CSS.
 */
export function Faq({ eyebrow, title, items }: Props) {
  return (
    <Section id="faq" eyebrow={eyebrow} title={title} narrow>
      <Reveal className="flex flex-col gap-3">
        {items.map((item) => (
          <details
            key={item.q}
            name="faq"
            className="group rounded-card border border-border bg-surface-1 transition-colors open:border-muscle-primary/40"
          >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-[17px] font-semibold text-text marker:hidden focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-[18px] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">{item.q}</span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-text-secondary transition-all group-open:rotate-45 group-open:border-muscle-primary/50 group-open:text-muscle-primary">
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
              </span>
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-text-secondary md:text-[16px]">{item.a}</p>
          </details>
        ))}
      </Reveal>
    </Section>
  )
}
