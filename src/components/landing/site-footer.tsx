import { LANDING_UI } from '../../../content/landing'

type Props = {
  /** Год в строке копирайта: страница пересобирается раз в час, значение не устаревает. */
  year: number
}

/** Подвал: логотип, ссылки на разделы, политика ПДн, согласие, © год. */
export function SiteFooter({ year }: Props) {
  return (
    <footer className="border-t border-border px-4 pt-12 pb-28 sm:px-6 md:pb-10">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип из public/ */}
            <img src={LANDING_UI.nav.logo} alt="" width={56} height={56} loading="lazy" className="size-14" />
            <div className="flex flex-col">
              <span className="font-display text-[20px] leading-tight font-medium tracking-[0.04em] text-text uppercase">
                {LANDING_UI.nav.brand}
              </span>
              <span className="text-[14px] text-text-secondary">{LANDING_UI.footer.rights}</span>
            </div>
          </div>

          <nav aria-label="Разделы страницы" className="grid grid-cols-2 gap-x-10 gap-y-2 text-[15px] md:grid-cols-3">
            {LANDING_UI.nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="py-1 text-text-secondary underline-offset-4 transition-colors hover:text-text hover:underline"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 text-[13px] md:flex-row md:items-center md:justify-between">
          <p className="text-text-secondary">© {year}</p>
          <nav aria-label="Юридические документы" className="flex flex-col gap-2 md:flex-row md:gap-6">
            <a
              href="/legal/privacy"
              className="text-text-secondary underline-offset-4 hover:text-text hover:underline"
            >
              {LANDING_UI.footer.privacy}
            </a>
            <a
              href="/legal/consent"
              className="text-text-secondary underline-offset-4 hover:text-text hover:underline"
            >
              {LANDING_UI.footer.consent}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
