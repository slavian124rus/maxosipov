/**
 * Скриншоты каталога для отчёта по фото тренажёров (375 px, тёмная тема — единственная).
 *
 * Подготовка: `pnpm catalog:photos`, `pnpm catalog:import --publish`, `pnpm dev`
 * (или docker compose -f docker/compose.local.yml up).
 * Запуск: `pnpm exec tsx scripts/catalog-shots.ts`
 *
 * Кладёт PNG в `docs/reports/assets/`:
 * - `08-catalog-375.png` — список: у упражнений без видео миниатюра-фото и «Видео скоро»;
 * - `08-exercise-card-photo-375.png` — карточка без видео: фото тренажёра вместо плеера;
 * - `08-exercise-card-video-375.png` — карточка с видео: плеер не изменился.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from '@playwright/test'
import { signInAs } from '../e2e/helpers'

const APP_URL = process.env.SHOTS_APP_URL ?? 'http://app.localhost:3000'
const PHONE = process.env.SHOTS_PHONE ?? '+79990000011'

/** Упражнение без видео (фото тренажёра) и контрольное — с видео из сида. */
const PHOTO_EXERCISE = 'gakk-prisedaniya'
const PHOTO_EXERCISE_TITLE = 'Гакк-приседания'
const VIDEO_EXERCISE = 'tyaga-verkhnego-bloka-k-grudi'
const VIDEO_EXERCISE_TITLE = 'Тяга верхнего блока к груди'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'docs', 'reports', 'assets')

const VIEWPORT = { width: 375, height: 812 }
const DEVICE_SCALE_FACTOR = 2

/** Скриншот вьюпорта. `scrollY = null` — не трогаем прокрутку (кадр уже выставлен). */
async function shoot(page: Page, file: string, scrollY: number | null = 0): Promise<void> {
  if (scrollY !== null) {
    await page.evaluate((top) => window.scrollTo(0, top), scrollY)
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT_DIR, file), type: 'png' })
  console.log(`✓ docs/reports/assets/${file}`)
}

/** Список каталога: прокручиваем до строк упражнений, чтобы были видны миниатюры. */
async function shootCatalog(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/exercises`)
  await page.getByRole('heading', { name: 'Упражнения' }).waitFor({ timeout: 60_000 })

  const firstRow = page.getByRole('link', { name: new RegExp(PHOTO_EXERCISE_TITLE) }).first()
  await firstRow.waitFor({ timeout: 60_000 })
  await firstRow.scrollIntoViewIfNeeded()
  // Чуть выше первой строки, чтобы в кадр попал и край фильтра тренажёров.
  await page.evaluate(() => window.scrollBy(0, -90))
  await page.waitForLoadState('networkidle')

  const scrollY = await page.evaluate(() => window.scrollY)
  console.log(`  прокрутка списка: ${scrollY}px`)
  await shoot(page, '08-catalog-375.png', null)
}

async function shootCard(page: Page, slug: string, title: string, file: string): Promise<void> {
  await page.goto(`${APP_URL}/exercises/${slug}`)
  await page.getByRole('heading', { name: title }).waitFor({ timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)
  await shoot(page, file)
}

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
  })
  const page: Page = await context.newPage()
  // Dev-сервер компилирует страницы по запросу — таймауты как в e2e (60 с).
  page.setDefaultTimeout(60_000)
  page.setDefaultNavigationTimeout(60_000)

  try {
    await signInAs(page, PHONE)

    await shootCatalog(page)
    await shootCard(page, PHOTO_EXERCISE, PHOTO_EXERCISE_TITLE, '08-exercise-card-photo-375.png')
    await shootCard(page, VIDEO_EXERCISE, VIDEO_EXERCISE_TITLE, '08-exercise-card-video-375.png')
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
