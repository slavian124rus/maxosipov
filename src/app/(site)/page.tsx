import { LANDING, LANDING_UI } from '../../../content/landing'
import { appUrl } from '@/shared/app-url'
import { About } from '@/components/landing/about'
import { Contacts } from '@/components/landing/contacts'
import { Coach } from '@/components/landing/coach'
import { Hero } from '@/components/landing/hero'
import { Inside } from '@/components/landing/inside'
import { LeadForm } from '@/components/landing/lead-form'
import { Pricing } from '@/components/landing/pricing'
import { Reveal } from '@/components/landing/reveal'
import { Reviews } from '@/components/landing/reviews'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { Steps } from '@/components/landing/steps'
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
      <SiteHeader
        monogram={LANDING_UI.nav.monogram}
        brand={LANDING_UI.nav.brand}
        brandNote={LANDING_UI.nav.brandNote}
        loginLabel={LANDING_UI.nav.login}
        loginHref={loginHref}
      />

      <main className="flex flex-1 flex-col">
        <Hero
          title={LANDING.hero.title}
          subtitle={LANDING.hero.subtitle}
          cta={LANDING.hero.cta}
          ctaHref={loginHref}
          videoSrc={LANDING.hero.videoSrc}
          poster={LANDING.hero.poster}
          badge={LANDING_UI.hero.badge}
          scrollHint={LANDING_UI.hero.scrollHint}
        />

        <Inside
          eyebrow={LANDING_UI.sections.inside}
          title={LANDING.inside.title}
          items={LANDING.inside.items}
          lead={LANDING_UI.inside.lead}
        />

        <Coach title={LANDING.coach.title} text={LANDING.coach.text} dialog={LANDING.coach.dialog} />

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
          mapEmbedUrl={LANDING.contacts.mapEmbedUrl}
        />
      </main>

      <SiteFooter year={year} />
    </>
  )
}
