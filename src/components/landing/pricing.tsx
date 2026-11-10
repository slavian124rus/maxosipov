import { Check } from 'lucide-react'
import { LANDING_UI } from '../../../content/landing'
import { CtaLink } from './cta'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  title: string
  firstMonth: string
  /** Цена из настроек зала (`gyms.settings.subscriptionPriceRub`); `null` — не задана. */
  priceRub: number | null
  ctaHref: string
}

/** «2 500 ₽» — разделитель тысяч и знак рубля (DESIGN.md §9.2). */
export function formatRub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
}

/**
 * Строка тарифа. Цены нет в админке — не выдумываем её, а отправляем к Максиму
 * (план, Review Focus 3).
 */
export function priceSentence(firstMonth: string, priceRub: number | null): string {
  if (priceRub === null) return `${firstMonth}, ${LANDING_UI.pricing.noPrice}`
  return `${firstMonth}, дальше ${formatRub(priceRub)} в месяц`
}

/** Тариф (DESIGN.md §10.6): первый месяц бесплатно, дальше — цена из настроек. */
export function Pricing({ title, firstMonth, priceRub, ctaHref }: Props) {
  return (
    <Section id="pricing" eyebrow={LANDING_UI.sections.pricing} title={title}>
      <Reveal>
        <div className="relative overflow-hidden rounded-sheet border border-border bg-surface-1 p-6 md:p-10">
          <div
            aria-hidden="true"
            className="absolute -top-28 -right-20 size-80 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(229,50,45,.22),transparent_70%)] blur-2xl"
          />

          <div className="relative grid gap-8 md:grid-cols-[1.05fr_.95fr] md:items-center md:gap-12">
            <div className="flex flex-col gap-5">
              <p className="font-display text-[26px] leading-tight font-medium text-balance text-text md:text-[36px]">
                {priceSentence(firstMonth, priceRub)}
              </p>

              <p className="max-w-[420px] text-[15px] leading-relaxed text-text-secondary">
                {LANDING_UI.pricing.trial}
              </p>

              <CtaLink href={ctaHref}>{LANDING_UI.pricing.cta}</CtaLink>
            </div>

            <div className="flex flex-col gap-3 rounded-card border border-border bg-bg/60 p-5">
              <p className="text-[15px] font-semibold text-text">{LANDING_UI.pricing.includedTitle}</p>

              <ul className="flex flex-col gap-2.5">
                {LANDING_UI.pricing.included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-text-secondary">
                    {/* Золото — один элемент на экран (DESIGN.md §3). */}
                    <Check size={16} strokeWidth={2} aria-hidden="true" className="mt-1 shrink-0 text-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
