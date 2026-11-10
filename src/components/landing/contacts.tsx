import { ExternalLink, MapPin, Navigation, Phone, Send } from 'lucide-react'
import { LANDING_UI } from '../../../content/landing'
import { MapEmbed } from './map-embed'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  address: string
  phone: string | null
  /** Ник в Telegram с «@» или без; `null` — кнопки нет. */
  telegram?: string | null
  mapEmbedUrl: string | null
}

const MAP_HOSTS = ['yandex.ru', 'yandex.com', 'yandex.by', 'yandex.kz', 'yandex.ua', 'yandex.tr']

/**
 * Карту встраиваем только из доверенного источника: https и домен Яндекс.Карт.
 * Значение приходит из настроек, поэтому проверяем его, а не подставляем как есть
 * (урок ревью этапа 5, F4 — SSRF/инъекции через внешние адреса).
 */
export function safeMapEmbedUrl(url: string | null): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null

    const host = parsed.hostname.toLowerCase()
    const trusted = MAP_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))

    return trusted ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Контакты и карта: адрес, кнопки «Построить маршрут» и «Позвонить», карта по нажатию. */
export function Contacts({ address, phone, telegram = null, mapEmbedUrl }: Props) {
  const embed = safeMapEmbedUrl(mapEmbedUrl)
  const searchHref = `https://yandex.ru/maps/?text=${encodeURIComponent(LANDING_UI.contacts.mapSearch)}`
  const routeHref = `https://yandex.ru/maps/?rtext=~${encodeURIComponent(LANDING_UI.contacts.mapSearch)}&rtt=auto`
  const tgHandle = telegram ? telegram.replace(/^@/, '') : null
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null

  const buttonClass =
    'inline-flex h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-5 text-[15px] font-semibold text-text transition-colors hover:border-muscle-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

  return (
    <Section
      id="contacts"
      eyebrow={LANDING_UI.sections.contacts}
      title={LANDING_UI.contacts.title}
      className="border-t border-border/60 bg-surface-1/40"
    >
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-8">
        <Reveal className="flex flex-col gap-5 rounded-card border border-border bg-surface-1 p-6">
          <div className="flex flex-col gap-2">
            <p className="font-display text-[26px] leading-tight font-medium text-text">
              {LANDING_UI.contacts.gym}
            </p>
            <p className="flex items-start gap-2 text-[16px] leading-relaxed text-text-secondary">
              <MapPin size={18} strokeWidth={1.75} aria-hidden="true" className="mt-1 shrink-0 text-muscle-primary" />
              <span className="min-w-0">{address}</span>
            </p>
          </div>

          {(phone && tel) || tgHandle ? (
            <ul className="flex flex-col gap-2 border-t border-border pt-5 text-[18px] font-semibold text-text">
              {phone && tel ? (
                <li className="flex items-center gap-2">
                  <Phone size={18} strokeWidth={1.75} aria-hidden="true" className="text-muscle-primary" />
                  <a href={tel} className="hover:underline">
                    {phone}
                  </a>
                </li>
              ) : null}
              {tgHandle ? (
                <li className="flex items-center gap-2">
                  <Send size={18} strokeWidth={1.75} aria-hidden="true" className="text-muscle-primary" />
                  <a
                    href={`https://t.me/${tgHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    @{tgHandle}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row lg:flex-col">
            <a href={routeHref} target="_blank" rel="noopener noreferrer" className={buttonClass}>
              <Navigation size={16} strokeWidth={1.75} aria-hidden="true" />
              {LANDING_UI.contacts.route}
            </a>
            {tel ? (
              <a href={tel} className={buttonClass}>
                <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                {LANDING_UI.contacts.call}
              </a>
            ) : null}
            {tgHandle ? (
              <a
                href={`https://t.me/${tgHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass}
              >
                <Send size={16} strokeWidth={1.75} aria-hidden="true" />
                {LANDING_UI.contacts.telegram}
              </a>
            ) : null}
            {!tel ? (
              <a href={searchHref} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                {LANDING_UI.contacts.mapOpen}
              </a>
            ) : null}
          </div>

          <p className="border-t border-border pt-5 text-[13px] leading-relaxed text-text-secondary">
            {LANDING_UI.contacts.appNote}
          </p>
        </Reveal>

        <Reveal delay={0.08} className="min-h-[320px]">
          {embed ? (
            <MapEmbed
              src={embed}
              title={LANDING_UI.contacts.mapTitle}
              address={address}
              showLabel={LANDING_UI.contacts.mapShow}
              note={LANDING_UI.contacts.mapNote}
            />
          ) : (
            <a
              href={searchHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-full min-h-[320px] items-center justify-center rounded-card border border-border bg-surface-1 text-[15px] font-semibold text-text"
            >
              {LANDING_UI.contacts.mapOpen}
            </a>
          )}
        </Reveal>
      </div>
    </Section>
  )
}
