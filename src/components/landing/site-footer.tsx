import { LANDING_UI } from '../../../content/landing'

type Props = {
  /** Год в строке копирайта: страница пересобирается раз в час, значение не устаревает. */
  year: number
}

/** Подвал (план, задача 1, шаг 3): политика ПДн, согласие, © год. */
export function SiteFooter({ year }: Props) {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-control border border-muscle-primary/40 bg-muscle-primary/10 font-display text-[14px] text-text"
            >
              {LANDING_UI.nav.monogram}
            </span>
            <span className="text-[15px] text-text-secondary">{LANDING_UI.footer.rights}</span>
          </div>

          <nav aria-label="Юридические документы" className="flex flex-col gap-2 text-[13px] md:flex-row md:gap-6">
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

        <p className="border-t border-border pt-6 text-[13px] text-text-secondary">© {year}</p>
      </div>
    </footer>
  )
}
