import { LANDING, LANDING_UI } from '../../../content/landing'
import { appUrl } from '@/shared/app-url'
import { About } from '@/components/landing/about'
import { Contacts } from '@/components/landing/contacts'
import { Faq } from '@/components/landing/faq'
import { Coach } from '@/components/landing/coach'
import { Hero } from '@/components/landing/hero'
import { Inside } from '@/components/landing/inside'
import { LeadForm } from '@/components/landing/lead-form'
import { MobileCta } from '@/components/landing/mobile-cta'
import { Pricing } from '@/components/landing/pricing'
import { Reveal } from '@/components/landing/reveal'
import { Reviews } from '@/components/landing/reviews'
import { RevealDriver } from '@/components/landing/reveal-driver'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { Steps } from '@/components/landing/steps'
import { Ticker } from '@/components/landing/ticker'
import { submitLeadAction } from './actions'
import { landingPrice, landingYear } from './price-cache'

/**
 * Лендинг — страница статическая: контент из `content/landing.ts`, цена из настроек
 * зала при сборке и раз в час (`landingPrice` → `cacheLife('hours')`).
 *
 * Отклонение от плана: `export const dynamic = 'force-static'` и `revalidate = 3600`
 * с `nextConfig.cacheComponents` (Next 16) несовместимы — сборка падает с
 * «Route segment config ... is not compatible with `nextConfig.cacheComponents`».
 * Статичность здесь обеспечивает отсутствие некэшированного IO, а час жизни данных —
 * профиль `cacheLife('hours')` у цены (stale 300 / revalidate 3600 / expire 86400).
 */
export default async function LandingPage() {
  const priceRub = await landingPrice()
  const year = await landingYear()
  // Все кнопки «Получить месяц бесплатно» ведут в приложение, адрес — от APP_URL (ревью этапа 1, F4).
  const loginHref = appUrl('/login').toString()

  return (
    <>
      <RevealDriver />
      <SiteHeader
        logo={LANDING_UI.nav.logo}
        brand={LANDING_UI.nav.brand}
        brandNote={LANDING_UI.nav.brandNote}
        links={LANDING_UI.nav.links}
        loginLabel={LANDING_UI.nav.login}
        loginHref={loginHref}
        ctaLabel={LANDING_UI.nav.cta}
        ctaShortLabel={LANDING_UI.nav.ctaShort}
        menuOpenLabel={LANDING_UI.nav.menuOpen}
        menuCloseLabel={LANDING_UI.nav.menuClose}
      />

      <main className="flex flex-1 flex-col">
        <Hero
          title={LANDING.hero.title}
          accent={LANDING.hero.accent}
          subtitle={LANDING.hero.subtitle}
          cta={LANDING.hero.cta}
          ctaSecondary={LANDING.hero.ctaSecondary}
          ctaHref={loginHref}
          imageWide={LANDING.hero.imageWide}
          imageMobile={LANDING.hero.imageMobile}
          imageAlt={LANDING.hero.imageAlt}
          badge={LANDING_UI.hero.badge}
          scrollHint={LANDING_UI.hero.scrollHint}
          stats={LANDING.hero.stats}
        />

        <Ticker items={LANDING_UI.hero.ticker} />

        <Inside
          eyebrow={LANDING_UI.sections.inside}
          title={LANDING.inside.title}
          items={LANDING.inside.items}
          lead={LANDING_UI.inside.lead}
          tabsLabel={LANDING_UI.inside.tabsLabel}
        />

        <Coach title={LANDING.coach.title} text={LANDING.coach.text} />

        <About
          title={LANDING.about.title}
          photo={LANDING.about.photo}
          paragraphs={LANDING.about.paragraphs}
          facts={LANDING.about.facts}
        />

        <Reviews reviews={LANDING.reviews} />

        <Pricing
          title={LANDING.pricing.title}
          firstMonth={LANDING.pricing.firstMonth}
          priceRub={priceRub}
          ctaHref={loginHref}
        />

        <Steps steps={LANDING.steps} ctaHref={loginHref} />

        <Faq eyebrow={LANDING_UI.sections.faq} title={LANDING_UI.faq.title} items={LANDING_UI.faq.items} />

        {/* Форма заявки — под блоком «Как начать» (план, задача 3). */}
        <section className="px-4 pb-16 sm:px-6 md:pb-24">
          <div className="mx-auto w-full max-w-[760px]">
            <Reveal>
              <LeadForm action={submitLeadAction} />
            </Reveal>
          </div>
        </section>

        <Contacts
          address={LANDING.contacts.address}
          phone={LANDING.contacts.phone}
          telegram={LANDING.contacts.telegram}
          mapEmbedUrl={LANDING.contacts.mapEmbedUrl}
        />
      </main>

      <SiteFooter year={year} />
      <MobileCta href={loginHref} label={LANDING_UI.mobileCta.label} closeLabel={LANDING_UI.mobileCta.close} />
    </>
  )
}
