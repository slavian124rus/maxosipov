import { ExternalLink, MapPin, Phone } from 'lucide-react'
import { LANDING_UI } from '../../../content/landing'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  address: string
  phone: string | null
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

/** Контакты и карта (DESIGN.md §10.8). Телефона и ссылки на карту пока нет — их даст владелец. */
export function Contacts({ address, phone, mapEmbedUrl }: Props) {
  const embed = safeMapEmbedUrl(mapEmbedUrl)
  const mapHref = embed ?? `https://yandex.ru/maps/?text=${encodeURIComponent(LANDING_UI.contacts.mapSearch)}`

  return (
    <Section
      id="contacts"
      eyebrow={LANDING_UI.sections.contacts}
      title={LANDING_UI.contacts.title}
      className="border-t border-border/60 bg-surface-1/40"
    >
      <div className="grid gap-6 md:grid-cols-[.9fr_1.1fr] md:gap-8">
        <Reveal className="flex flex-col gap-5 rounded-card border border-border bg-surface-1 p-6">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[22px] leading-tight font-medium text-text">
              {LANDING_UI.contacts.gym}
            </p>
            <p className="flex items-start gap-2 text-[15px] leading-relaxed text-text-secondary">
              <MapPin size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-muscle-primary" />
              {address}
            </p>
          </div>

          {phone ? (
            <div className="flex flex-col gap-3 border-t border-border pt-5">
              <p className="flex items-center gap-2 text-[17px] font-semibold text-text">
                <Phone size={18} strokeWidth={1.75} aria-hidden="true" className="text-muscle-primary" />
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:underline">
                  {phone}
                </a>
              </p>
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex h-12 w-fit items-center justify-center rounded-control border border-border bg-surface-2 px-6 text-[15px] font-semibold text-text transition-colors hover:border-muscle-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {LANDING_UI.contacts.call}
              </a>
            </div>
          ) : null}

          <p className="border-t border-border pt-5 text-[13px] leading-relaxed text-text-secondary">
            {LANDING_UI.contacts.appNote}
          </p>
        </Reveal>

        <Reveal delay={0.08} className="min-h-[280px]">
          {embed ? (
            <iframe
              src={embed}
              title="Яндекс Карты — как добраться до зала «Колизей»"
              loading="lazy"
              className="size-full min-h-[280px] rounded-card border border-border"
              style={{ border: 0 }}
              allowFullScreen
            />
          ) : (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex size-full min-h-[280px] flex-col items-center justify-center gap-3 overflow-hidden rounded-card border border-border bg-surface-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/* Стилизованная карта: кварталы Говорова, пока владелец не дал ссылку на виджет. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,#202024_1px,transparent_1px),linear-gradient(to_bottom,#202024_1px,transparent_1px)] [background-size:44px_44px]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 [background-image:linear-gradient(to_right,#2a2a2f_3px,transparent_3px),linear-gradient(to_bottom,#2a2a2f_3px,transparent_3px)] [background-size:176px_176px]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(45%_45%_at_50%_45%,rgba(229,50,45,.22),transparent_70%)]"
              />

              <span className="relative flex flex-col items-center gap-3 px-6 text-center">
                <span className="grid size-12 place-items-center rounded-full border border-muscle-primary/50 bg-bg/80 motion-safe:animate-pulse">
                  <MapPin size={22} strokeWidth={1.75} className="text-muscle-primary" />
                </span>
                <span className="text-[15px] leading-snug text-text-secondary">{address}</span>
                <span className="inline-flex h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-5 text-[15px] font-semibold text-text transition-colors group-hover:border-muscle-primary/60">
                  {LANDING_UI.contacts.mapOpen}
                  <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </span>
            </a>
          )}
        </Reveal>
      </div>
    </Section>
  )
}
