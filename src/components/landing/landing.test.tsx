// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { LANDING } from '../../../content/landing'
import { About } from './about'
import { Contacts, safeMapEmbedUrl } from './contacts'
import { Hero } from './hero'
import { buildPersonSchema, splitAddress } from './json-ld'
import { Pricing, priceSentence } from './pricing'
import { Reviews } from './reviews'

/** `whileInView` из Motion нуждается в IntersectionObserver — в jsdom его нет. */
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  take(): [] {
    return []
  }
}

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
  return (container.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

const HERO_PROPS = {
  title: LANDING.hero.title,
  subtitle: LANDING.hero.subtitle,
  cta: LANDING.hero.cta,
  ctaHref: 'http://app.localhost:3000/login',
  videoSrc: LANDING.hero.videoSrc,
  poster: LANDING.hero.poster,
  badge: 'Первый месяц бесплатно',
  scrollHint: 'Что внутри',
}

beforeEach(() => {
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof globalThis.IntersectionObserver
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
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

test('текста «Обо мне» нет, но есть фото — показываем только фото', () => {
  const { container } = render(
    <About title="Обо мне" photo="/landing/maxim.webp" paragraphs={null} facts={null} />,
  )

  expect(screen.getByRole('heading', { name: 'Обо мне' })).toBeTruthy()
  expect(screen.getByRole('img')).toBeTruthy()
  // Из текста — только подпись блока, ни абзацев, ни списка достижений.
  expect(Array.from(container.querySelectorAll('p')).map((node) => node.textContent)).toEqual([
    'Тренер',
  ])
  expect(container.querySelectorAll('ul')).toHaveLength(0)
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
      ctaHref={HERO_PROPS.ctaHref}
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
      ctaHref={HERO_PROPS.ctaHref}
    />,
  )

  expect(textOf(container)).toContain('Первый месяц бесплатно, дальше 2 500 ₽ в месяц')
  expect(priceSentence('Первый месяц бесплатно', 2500)).toBe(
    'Первый месяц бесплатно, дальше 2\u00a0500 ₽ в месяц',
  )
})

test('карты и телефона нет — кнопка на поиск в Яндекс Картах, iframe не встраиваем', () => {
  const { container } = render(
    <Contacts address={LANDING.contacts.address} phone={null} mapEmbedUrl={null} />,
  )

  const link = screen.getByRole('link', { name: /Открыть в Яндекс Картах/ })
  const href = link.getAttribute('href') ?? ''
  const prefix = 'https://yandex.ru/maps/?text='
  expect(href.startsWith(prefix)).toBe(true)
  expect(decodeURIComponent(href.slice(prefix.length))).toBe('Красноярск, улица Говорова, Колизей')
  expect(container.querySelector('iframe')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Позвонить' })).toBeNull()
  expect(textOf(container)).toContain('Красноярск, ул. Говорова, зал «Колизей»')
})

test('телефон есть — виден текстом и кнопкой «Позвонить»', () => {
  render(
    <Contacts address={LANDING.contacts.address} phone="+7 (913) 555-00-11" mapEmbedUrl={null} />,
  )

  expect(screen.getByRole('link', { name: 'Позвонить' }).getAttribute('href')).toBe('tel:+79135550011')
  expect(screen.getByText('+7 (913) 555-00-11')).toBeTruthy()
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

  const { container, rerender } = render(
    <Contacts address="Красноярск, ул. Говорова" phone={null} mapEmbedUrl="https://evil.example/widget" />,
  )
  expect(container.querySelector('iframe')).toBeNull()

  rerender(
    <Contacts
      address="Красноярск, ул. Говорова"
      phone={null}
      mapEmbedUrl="https://yandex.ru/map-widget/v1/?z=16"
    />,
  )
  const frame = container.querySelector('iframe')
  expect(frame?.getAttribute('src')).toBe('https://yandex.ru/map-widget/v1/?z=16')
  expect(frame?.getAttribute('title')).toBeTruthy()
})

test('JSON-LD: город и улица без выдуманного номера дома', () => {
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
  expect(schema.address.streetAddress).toBe('ул. Говорова')
  expect(schema.address.addressLocality).toBe('Красноярск')
  expect(schema.worksFor['@type']).toBe('ExerciseGym')
  expect(schema.worksFor.name).toBe('Колизей')
  expect(schema.telephone).toBeUndefined()
})

test('первый экран: постер грузится первым, видео без звука и с постером', () => {
  const { container } = render(<Hero {...HERO_PROPS} />)

  const poster = container.querySelector('img')
  expect(poster?.getAttribute('src')).toBe('/landing/hero.webp')
  expect(poster?.getAttribute('fetchpriority')).toBe('high')
  expect(poster?.getAttribute('alt')).toBe('')

  // В jsdom страница уже «загружена», поэтому ролик добавлен в DOM.
  const video = container.querySelector('video') as HTMLVideoElement | null
  expect(video).not.toBeNull()
  expect(video?.muted).toBe(true)
  expect(video?.loop).toBe(true)
  expect(video?.getAttribute('autoplay')).not.toBeNull()
  expect(video?.getAttribute('playsinline')).not.toBeNull()
  expect(video?.getAttribute('controls')).toBeNull()
  expect(video?.getAttribute('poster')).toBe('/landing/hero.webp')
  expect(video?.getAttribute('aria-hidden')).toBe('true')
})

test('prefers-reduced-motion — остаётся только постер, ролик не грузится', () => {
  stubMatchMedia(true)

  const { container } = render(<Hero {...HERO_PROPS} />)

  expect(container.querySelector('img')).not.toBeNull()
  expect(container.querySelector('video')).toBeNull()
})

test('заголовок и кнопка первого экрана — из контента, кнопка ведёт в приложение', () => {
  render(<Hero {...HERO_PROPS} />)

  expect(screen.getByRole('heading', { level: 1, name: 'Тренируйся с Максимом' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Получить месяц бесплатно/ }).getAttribute('href')).toBe(
    'http://app.localhost:3000/login',
  )
})
