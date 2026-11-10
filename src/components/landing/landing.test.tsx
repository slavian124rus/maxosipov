// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { COACH_DEMO, LANDING, LANDING_UI } from '../../../content/landing'
import { About } from './about'
import { CoachDialog } from './coach-dialog'
import { Contacts, safeMapEmbedUrl } from './contacts'
import { Faq } from './faq'
import { Hero } from './hero'
import { InsideTabs } from './inside-tabs'
import { buildPersonSchema, splitAddress } from './json-ld'
import { MapEmbed } from './map-embed'
import { MobileCta } from './mobile-cta'
import { Pricing, priceSentence } from './pricing'
import { Reviews } from './reviews'
import { SiteHeader } from './site-header'

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** Неразрывный пробел в «2 500 ₽» мешал бы сравнению — приводим к обычному. */
function textOf(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

const LOGIN = 'http://app.localhost:3000/login'

const HERO_PROPS = {
  title: LANDING.hero.title,
  accent: LANDING.hero.accent,
  subtitle: LANDING.hero.subtitle,
  cta: LANDING.hero.cta,
  ctaSecondary: LANDING.hero.ctaSecondary,
  ctaHref: LOGIN,
  imageWide: LANDING.hero.imageWide,
  imageMobile: LANDING.hero.imageMobile,
  imageAlt: LANDING.hero.imageAlt,
  badge: 'Первый месяц бесплатно',
  scrollHint: 'Прокрути вниз',
  stats: LANDING.hero.stats,
}

beforeEach(() => {
  stubMatchMedia(false)
  // jsdom не знает IntersectionObserver: вкладкам и шапке он нужен только для автоматики.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('отзывов нет — блока «Результаты клиентов» не существует', () => {
  const { container } = render(<Reviews reviews={null} />)

  expect(container.innerHTML).toBe('')
  expect(screen.queryByRole('heading', { name: 'Результаты клиентов' })).toBeNull()
})

test('отзывы есть — блок выводится, фото не обязано', () => {
  const { container } = render(
    <Reviews
      reviews={[
        { name: 'Иван', text: 'За месяц добавил 5 кг на жиме', photo: null },
        { name: 'Мария', text: 'Перестала болеть поясница', photo: '/landing/review-maria.webp' },
      ]}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Результаты клиентов' })).toBeTruthy()
  expect(screen.getByText('За месяц добавил 5 кг на жиме')).toBeTruthy()
  // Фото отзыва — рядом с именем, поэтому `alt` пустой и роли `img` у него нет.
  expect(container.querySelectorAll('img')).toHaveLength(1)
  expect(container.querySelectorAll('img')[0]?.getAttribute('src')).toBe('/landing/review-maria.webp')
})

test('есть фото и факты — «Обо мне» показывает фото и пронумерованные факты', () => {
  const { container } = render(
    <About
      title="Обо мне"
      photo="/landing/about-max.webp"
      paragraphs={null}
      facts={['10+ лет работаю тренером', 'Тренирую в «Колизее»']}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Обо мне' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Максим Осипов' })).toBeTruthy()
  expect(container.querySelectorAll('li')).toHaveLength(2)
  expect(textOf(container)).toContain('10+ лет работаю тренером')
})

test('текста «Обо мне» нет, но есть фото — абзацев и списка нет', () => {
  const { container } = render(
    <About title="Обо мне" photo="/landing/maxim.webp" paragraphs={null} facts={null} />,
  )

  expect(screen.getByRole('img')).toBeTruthy()
  expect(container.querySelectorAll('li')).toHaveLength(0)
  expect(Array.from(container.querySelectorAll('p')).map((node) => node.textContent)).toEqual([
    'Тренер',
  ])
})

test('ни фото, ни текста, ни достижений — блок «Обо мне» скрыт целиком', () => {
  const { container } = render(<About title="Обо мне" photo={null} paragraphs={null} facts={null} />)

  expect(container.innerHTML).toBe('')
  expect(screen.queryByRole('heading', { name: 'Обо мне' })).toBeNull()
})

test('цена не задана — «Первый месяц бесплатно, дальше — цену скажет Максим»', () => {
  const { container } = render(
    <Pricing
      title={LANDING.pricing.title}
      firstMonth={LANDING.pricing.firstMonth}
      priceRub={null}
      ctaHref={LOGIN}
    />,
  )

  expect(textOf(container)).toContain('Первый месяц бесплатно, дальше — цену скажет Максим')
})

test('цена 2500 — «Первый месяц бесплатно, дальше 2 500 ₽ в месяц»', () => {
  const { container } = render(
    <Pricing
      title={LANDING.pricing.title}
      firstMonth={LANDING.pricing.firstMonth}
      priceRub={2500}
      ctaHref={LOGIN}
    />,
  )

  expect(textOf(container)).toContain('Первый месяц бесплатно, дальше 2 500 ₽ в месяц')
  expect(priceSentence('Первый месяц бесплатно', 2500)).toBe(
    'Первый месяц бесплатно, дальше 2 500 ₽ в месяц',
  )
})

test('контакты: адрес, маршрут и карта; без телефона вместо «Позвонить» — Яндекс Карты', () => {
  const { container } = render(
    <Contacts address={LANDING.contacts.address} phone={null} mapEmbedUrl={LANDING.contacts.mapEmbedUrl} />,
  )

  expect(textOf(container)).toContain('Красноярск, ул. Говорова, 57, Аллея')

  const route = screen.getByRole('link', { name: /Построить маршрут/ })
  expect(route.getAttribute('href')).toContain('https://yandex.ru/maps/?rtext=')
  expect(route.getAttribute('rel')).toContain('noopener')

  const open = screen.getByRole('link', { name: /Открыть в Яндекс Картах/ })
  const prefix = 'https://yandex.ru/maps/?text='
  expect(open.getAttribute('href')?.startsWith(prefix)).toBe(true)
  expect(screen.queryByRole('link', { name: /Позвонить/ })).toBeNull()

  // Карта не грузится, пока человек не нажал кнопку.
  expect(container.querySelector('iframe')).toBeNull()
})

test('телефон есть — виден текстом и кнопкой «Позвонить»', () => {
  render(
    <Contacts address={LANDING.contacts.address} phone="+7 (913) 555-00-11" mapEmbedUrl={null} />,
  )

  expect(screen.getByRole('link', { name: /Позвонить/ }).getAttribute('href')).toBe('tel:+79135550011')
  expect(screen.getByText('+7 (913) 555-00-11')).toBeTruthy()
})

test('карты нет — вместо виджета ссылка на Яндекс Карты', () => {
  const { container } = render(
    <Contacts address={LANDING.contacts.address} phone={null} mapEmbedUrl="https://evil.example/widget" />,
  )

  expect(container.querySelector('iframe')).toBeNull()
  expect(container.querySelector('button')).toBeNull()
})

test('виджет Яндекс Карт загружается только после нажатия «Показать карту»', () => {
  const src = LANDING.contacts.mapEmbedUrl ?? ''
  const { container } = render(
    <MapEmbed src={src} title="Карта" address="Красноярск" showLabel="Показать карту" note="Грузит Яндекс" />,
  )

  expect(container.querySelector('iframe')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /Показать карту/ }))

  const frame = container.querySelector('iframe')
  expect(frame?.getAttribute('src')).toBe(src)
  expect(frame?.getAttribute('title')).toBe('Карта')
})

test('iframe карты — только https и только домен Яндекс.Карт', () => {
  expect(safeMapEmbedUrl('https://yandex.ru/map-widget/v1/?ll=92.9%2C56.0&z=16')).toContain('yandex.ru')
  expect(safeMapEmbedUrl('https://www.yandex.ru/map-widget/v1/')).not.toBeNull()
  expect(safeMapEmbedUrl('http://yandex.ru/map-widget/v1/')).toBeNull()
  expect(safeMapEmbedUrl('https://evil.example/yandex.ru')).toBeNull()
  expect(safeMapEmbedUrl('https://yandex.ru.evil.example/widget')).toBeNull()
  expect(safeMapEmbedUrl('javascript:alert(1)')).toBeNull()
  expect(safeMapEmbedUrl('')).toBeNull()
  expect(safeMapEmbedUrl(null)).toBeNull()
  // Виджет из контента проходит проверку.
  expect(safeMapEmbedUrl(LANDING.contacts.mapEmbedUrl)).not.toBeNull()
})

test('JSON-LD: город, улица с номером дома, зал по умолчанию', () => {
  expect(splitAddress('Красноярск, ул. Говорова, 57, Аллея')).toEqual({
    locality: 'Красноярск',
    street: 'ул. Говорова, 57',
    gym: '',
  })
  // Старый формат без номера дома разбирается по-прежнему.
  expect(splitAddress('Красноярск, ул. Говорова, зал «Колизей»')).toEqual({
    locality: 'Красноярск',
    street: 'ул. Говорова',
    gym: 'Колизей',
  })

  const schema = buildPersonSchema({
    siteUrl: 'https://maxosipov.ru/',
    description: 'Описание',
    address: LANDING.contacts.address,
    phone: null,
  })

  expect(schema['@type']).toBe('Person')
  expect(schema.name).toBe('Максим Осипов')
  expect(schema.jobTitle).toBe('Персональный тренер')
  expect(schema.address.streetAddress).toBe('ул. Говорова, 57')
  expect(schema.address.addressLocality).toBe('Красноярск')
  expect(schema.worksFor['@type']).toBe('ExerciseGym')
  expect(schema.worksFor.name).toBe('Колизей')
  expect(schema.telephone).toBeUndefined()
})

test('первый экран: фото (без видео) грузится первым, для телефона и десктопа', () => {
  const { container } = render(<Hero {...HERO_PROPS} />)

  expect(container.querySelector('video')).toBeNull()

  const photo = container.querySelector('img')
  expect(photo?.getAttribute('src')).toBe('/landing/hero-mobile.webp')
  expect(photo?.getAttribute('fetchpriority')).toBe('high')
  expect(photo?.getAttribute('alt')).toBe(LANDING.hero.imageAlt)
  expect(container.querySelector('source')?.getAttribute('srcset')).toBe('/landing/hero-wide.webp')
})

test('заголовок первого экрана целиком, акцентная часть выделена; кнопка ведёт в приложение', () => {
  render(<Hero {...HERO_PROPS} />)

  const heading = screen.getByRole('heading', { level: 1 })
  expect((heading.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('Тренер рядом на каждом подходе')
  expect(heading.querySelector('span')?.textContent).toBe('на каждом подходе')

  expect(screen.getByRole('link', { name: /Получить месяц бесплатно/ }).getAttribute('href')).toBe(LOGIN)
  expect(screen.getByRole('link', { name: 'Что внутри' }).getAttribute('href')).toBe('#inside')
})

test('первый экран: три факта; заголовок без акцента не ломается', () => {
  const { container } = render(<Hero {...HERO_PROPS} accent="нет такого" />)

  expect(container.querySelectorAll('ul li')).toHaveLength(3)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(LANDING.hero.title)
})

test('шапка: ссылки на блоки, «Войти», красная кнопка и меню телефона открывается и закрывается', () => {
  render(
    <SiteHeader
      logo={LANDING_UI.nav.logo}
      brand={LANDING_UI.nav.brand}
      brandNote={LANDING_UI.nav.brandNote}
      links={LANDING_UI.nav.links}
      loginLabel={LANDING_UI.nav.login}
      loginHref={LOGIN}
      ctaLabel={LANDING_UI.nav.cta}
      ctaShortLabel={LANDING_UI.nav.ctaShort}
      menuOpenLabel={LANDING_UI.nav.menuOpen}
      menuCloseLabel={LANDING_UI.nav.menuClose}
    />,
  )

  expect(screen.getByRole('link', { name: 'Войти' }).getAttribute('href')).toBe(LOGIN)
  expect(screen.getByRole('link', { name: /Месяц бесплатно/ }).getAttribute('href')).toBe(LOGIN)
  // Десктопная навигация присутствует в разметке (скрыта CSS на телефоне).
  expect(screen.getAllByRole('link', { name: 'МаксИИм' })).toHaveLength(1)

  const burger = screen.getByRole('button', { name: LANDING_UI.nav.menuOpen })
  expect(burger.getAttribute('aria-expanded')).toBe('false')

  fireEvent.click(burger)
  expect(screen.getByRole('button', { name: LANDING_UI.nav.menuClose }).getAttribute('aria-expanded')).toBe('true')
  // В открытом меню — вторая копия ссылок для телефона.
  expect(screen.getAllByRole('link', { name: 'МаксИИм' })).toHaveLength(2)

  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.getByRole('button', { name: LANDING_UI.nav.menuOpen }).getAttribute('aria-expanded')).toBe('false')
})

test('«Что внутри»: вкладки переключают экран, стрелки двигают выбор', () => {
  const { container } = render(<InsideTabs items={LANDING.inside.items} label="Экраны приложения" />)

  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(3)
  expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')

  fireEvent.click(tabs[1]!)
  expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
  expect(tabs[0]?.getAttribute('aria-selected')).toBe('false')

  // Виден (с alt) только экран выбранной вкладки; остальные скрыты от скринридеров.
  const visible = Array.from(container.querySelectorAll('img')).filter((img) => img.getAttribute('alt'))
  expect(visible).toHaveLength(1)
  expect(visible[0]?.getAttribute('alt')).toContain(LANDING.inside.items[1]!.title)

  fireEvent.keyDown(tabs[1]!, { key: 'ArrowDown' })
  expect(screen.getAllByRole('tab')[2]?.getAttribute('aria-selected')).toBe('true')
  fireEvent.keyDown(screen.getAllByRole('tab')[2]!, { key: 'ArrowDown' })
  expect(screen.getAllByRole('tab')[0]?.getAttribute('aria-selected')).toBe('true')
})

const COACH_PROPS = {
  scenarios: COACH_DEMO,
  avatar: LANDING_UI.coach.avatar,
  avatarNote: LANDING_UI.coach.avatarNote,
  proposal: LANDING_UI.coach.proposal,
  hint: LANDING_UI.coach.demoHint,
  greeting: LANDING_UI.coach.demoGreeting,
  note: LANDING_UI.coach.demoNote,
  typingLabel: LANDING_UI.coach.typing,
  resetLabel: LANDING_UI.coach.reset,
}

test('МаксИИм-демо: вопрос → «печатает» → ответ; про боль — «Остановись», без предложения', () => {
  vi.useFakeTimers()
  render(<CoachDialog {...COACH_PROPS} />)

  fireEvent.click(screen.getByRole('button', { name: 'Болит плечо при жиме' }))
  expect(screen.getByRole('status').textContent).toContain(LANDING_UI.coach.typing)

  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByText(/Остановись\. Это лучше показать Максиму/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull()
})

test('МаксИИм-демо: предложение по программе принимается и отклоняется, «Сначала» сбрасывает', () => {
  stubMatchMedia(true) // без задержки «печатает»
  render(<CoachDialog {...COACH_PROPS} />)

  fireEvent.click(screen.getByRole('button', { name: 'Собери тренировку на спину' }))
  expect(screen.getByText('Что изменится')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Принять' }))
  expect(screen.getByRole('status').textContent).toBe('Применено')
  expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull()

  // Другой вопрос — предложение заново в исходном состоянии.
  fireEvent.click(screen.getByRole('button', { name: 'Почему сегодня 35 кг?' }))
  expect(screen.queryByText('Что изменится')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Собери тренировку на спину' }))
  fireEvent.click(screen.getByRole('button', { name: 'Не надо' }))
  expect(screen.getByRole('status').textContent).toBe('Отклонено')

  fireEvent.click(screen.getByRole('button', { name: LANDING_UI.coach.reset }))
  expect(screen.queryByText('Что изменится')).toBeNull()
})

test('вопросы и ответы: один `details` на вопрос, ответы в разметке', () => {
  const { container } = render(
    <Faq eyebrow="Вопросы" title="Частые вопросы" items={LANDING_UI.faq.items} />,
  )

  const items = container.querySelectorAll('details')
  expect(items).toHaveLength(LANDING_UI.faq.items.length)
  // Общее имя — раскрыт один пункт за раз.
  expect(new Set(Array.from(items).map((node) => node.getAttribute('name')))).toEqual(new Set(['faq']))
  expect(textOf(container)).toContain('карта не нужна')
})

test('в контенте нет символа «×» в схемах и нет видео в первом экране', () => {
  const all = JSON.stringify([LANDING, LANDING_UI, COACH_DEMO])
  expect(all).not.toContain('×')
  expect(all).not.toContain('.mp4')
})

test('контакты: телефон и Telegram Максима — ссылки tel: и t.me', () => {
  render(
    <Contacts
      address={LANDING.contacts.address}
      phone={LANDING.contacts.phone}
      telegram={LANDING.contacts.telegram}
      mapEmbedUrl={null}
    />,
  )

  expect(screen.getByRole('link', { name: /Позвонить/ }).getAttribute('href')).toBe('tel:+79233705421')
  expect(screen.getByRole('link', { name: '+7 (923) 370-54-21' }).getAttribute('href')).toBe('tel:+79233705421')
  const telegram = screen.getByRole('link', { name: /Написать в Telegram/ })
  expect(telegram.getAttribute('href')).toBe('https://t.me/maksimm_osipovv')
  expect(telegram.getAttribute('rel')).toContain('noopener')
  expect(screen.getByRole('link', { name: '@maksimm_osipovv' })).toBeTruthy()
})

test('плавающая кнопка записи: появляется после первого экрана, закрывается и не возвращается', () => {
  const key = 'mobile-cta-dismissed'
  window.sessionStorage.removeItem(key)
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })

  const { container } = render(
    <MobileCta href={LOGIN} label={LANDING_UI.mobileCta.label} closeLabel={LANDING_UI.mobileCta.close} />,
  )
  const wrapper = container.firstElementChild as HTMLElement
  expect(wrapper.getAttribute('aria-hidden')).toBe('true')

  Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true })
  fireEvent.scroll(window)
  expect(wrapper.getAttribute('aria-hidden')).toBe('false')
  expect(screen.getByRole('link', { name: /Записаться в тестовое приложение/ }).getAttribute('href')).toBe(LOGIN)

  fireEvent.click(screen.getByRole('button', { name: LANDING_UI.mobileCta.close }))
  expect(container.innerHTML).toBe('')
  expect(window.sessionStorage.getItem(key)).toBe('1')

  // Новый показ в том же визите — кнопка остаётся скрытой.
  cleanup()
  const again = render(
    <MobileCta href={LOGIN} label={LANDING_UI.mobileCta.label} closeLabel={LANDING_UI.mobileCta.close} />,
  )
  expect(again.container.innerHTML).toBe('')
  window.sessionStorage.removeItem(key)
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
})
