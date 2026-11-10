/**
 * Скриншоты приложения для макетов лендинга + OG-картинка (план этапа 6, задача 2).
 *
 * Подготовка: `pnpm db:seed`, `pnpm dev` (нужен работающий `app.localhost:3000`).
 * Запуск: `pnpm exec tsx scripts/landing-shots.ts`
 *
 * Снимает три экрана в 390×844 при `deviceScaleFactor: 3` и сохраняет в
 * `public/landing/` как WebP шириной 780 и качеством 82. Экран тренировки
 * создаёт сессию в dev-базе — это тестовые данные сида.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from '@playwright/test'
import sharp from 'sharp'
import { signInAs } from '../e2e/helpers'

const APP_URL = process.env.SHOTS_APP_URL ?? 'http://app.localhost:3000'
const PHONE = process.env.SHOTS_PHONE ?? '+79990000011'

const EXERCISE_SLUG = 'tyaga-verkhnego-bloka-k-grudi'
const EXERCISE_TITLE = 'Тяга верхнего блока к груди'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public', 'landing')
const TMP_DIR = path.join(ROOT, 'tmp')

const VIEWPORT = { width: 390, height: 844 }
const DEVICE_SCALE_FACTOR = 3
const WEBP_WIDTH = 780
const WEBP_QUALITY = 82

const OG_WIDTH = 1200
const OG_HEIGHT = 630

/** Скриншот вьюпорта (не всей страницы) → WebP шириной 780, качество 82. */
async function shoot(page: Page, file: string, scrollY = 0): Promise<void> {
  await page.evaluate((top) => window.scrollTo(0, top), scrollY)
  const png = await page.screenshot({ type: 'png' })

  await sharp(png)
    .resize({ width: WEBP_WIDTH })
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(OUT_DIR, file))

  console.log(`✓ public/landing/${file}`)
}

/** Карточка упражнения с включённой подсветкой мышц. */
async function shootExerciseCard(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/exercises/${EXERCISE_SLUG}`)
  await page.getByRole('heading', { name: EXERCISE_TITLE }).waitFor({ timeout: 30_000 })

  const muscles = page.getByRole('button', { name: 'Мышцы' })
  await muscles.waitFor({ timeout: 30_000 })
  if ((await muscles.getAttribute('aria-pressed')) !== 'true') await muscles.click()

  await page.waitForLoadState('networkidle')
  // Кадр с подсветкой: ролику нужно доиграть до фазы усилия.
  await page.waitForTimeout(3000)

  await shoot(page, 'app-exercise.webp')
}

/** Каталог с фигурой мышц и подсвеченными широчайшими. */
async function shootCatalogFigure(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/exercises`)
  await page.getByRole('heading', { name: 'Упражнения' }).waitFor({ timeout: 30_000 })

  // Широчайшие видны со спины.
  await page.getByRole('button', { name: 'Сзади' }).first().click()

  const lats = page.locator('[data-muscle="lats"]').first()
  await lats.waitFor({ timeout: 30_000 })
  await lats.click({ force: true })

  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)

  // В экране каталога между фигурой и списком — пустая зона макета приложения.
  // Склеиваем две области одного экрана (фигура + список), чтобы макет был плотным.
  const top = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 390, height: 550 } })

  await page.evaluate(() => window.scrollTo(0, 260))
  await page.waitForTimeout(400)
  const bottom = await page.screenshot({ type: 'png', clip: { x: 0, y: 490, width: 390, height: 294 } })

  await sharp({
    create: { width: 390 * DEVICE_SCALE_FACTOR, height: 844 * DEVICE_SCALE_FACTOR, channels: 4, background: '#0E0E10' },
  })
    .composite([
      { input: top, top: 0, left: 0 },
      { input: bottom, top: 550 * DEVICE_SCALE_FACTOR, left: 0 },
    ])
    .png()
    .toBuffer()
    .then((composed) =>
      sharp(composed)
        .resize({ width: WEBP_WIDTH })
        .webp({ quality: WEBP_QUALITY })
        .toFile(path.join(OUT_DIR, 'app-figure.webp')),
    )

  console.log('✓ public/landing/app-figure.webp')
}

/** Экран тренировки с раскрытым упражнением: дневник и подсказка веса. */
async function shootWorkout(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/workout`)
  await page.getByRole('button', { name: 'Записать подход 1' }).waitFor({ timeout: 60_000 })

  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  await shoot(page, 'app-workout.webp')
}

/**
 * OG-картинка 1200×630: монограмма, словесный знак и заголовок.
 * Рисуем браузером, потому что шрифты у нас в woff2 — `next/og` (satori) их не понимает.
 */
async function shootOgImage(browser: Browser): Promise<void> {
  const html = path.join(TMP_DIR, 'og.html')
  await writeFile(html, OG_HTML, 'utf8')

  const page = await browser.newPage({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 1,
  })
  await page.goto(`file://${html.replaceAll('\\', '/')}`)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  await page.screenshot({ type: 'jpeg', quality: 88, path: path.join(OUT_DIR, 'og.jpg') })
  await page.close()

  console.log('✓ public/landing/og.jpg')
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(TMP_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  })
  const page = await context.newPage()

  await signInAs(page, PHONE)

  await shootExerciseCard(page)
  await shootCatalogFigure(page)
  await shootWorkout(page)

  await context.close()
  await shootOgImage(browser)
  await browser.close()

  console.log('Готово: public/landing')
}

/** Разметка OG-картинки: шрифты берём свои, локальные (без CDN — CLAUDE.md §6). */
const OG_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Oswald';
    src: url('../src/shared/fonts/oswald-cyrillic-wght-normal.woff2') format('woff2');
    font-weight: 200 700;
    unicode-range: U+0400-052F, U+2116;
  }
  @font-face {
    font-family: 'Oswald';
    src: url('../src/shared/fonts/oswald-latin-wght-normal.woff2') format('woff2');
    font-weight: 200 700;
    unicode-range: U+0000-00FF;
  }
  @font-face {
    font-family: 'Manrope';
    src: url('../src/shared/fonts/manrope-cyrillic-wght-normal.woff2') format('woff2');
    font-weight: 200 800;
    unicode-range: U+0400-052F, U+2116;
  }
  @font-face {
    font-family: 'Manrope';
    src: url('../src/shared/fonts/manrope-latin-wght-normal.woff2') format('woff2');
    font-weight: 200 800;
    unicode-range: U+0000-00FF;
  }

  * { margin: 0; box-sizing: border-box; }

  body {
    width: 1200px; height: 630px;
    background: #0e0e10; color: #f5f5f7;
    font-family: 'Manrope', sans-serif;
    position: relative; overflow: hidden;
  }
  .grid {
    position: absolute; inset: 0; opacity: .5;
    background-image:
      linear-gradient(to right, #17171a 1px, transparent 1px),
      linear-gradient(to bottom, #17171a 1px, transparent 1px);
    background-size: 60px 60px;
  }
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(58% 70% at 82% 18%, rgba(229,50,45,.30), transparent 70%),
      radial-gradient(50% 60% at 8% 100%, rgba(212,166,74,.12), transparent 70%);
  }
  .wrap { position: relative; height: 100%; padding: 72px 80px; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; gap: 20px; }
  .mono {
    width: 68px; height: 68px; border-radius: 18px;
    border: 2px solid rgba(255,59,48,.5); background: rgba(255,59,48,.12);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Oswald', sans-serif; font-size: 28px;
  }
  .wordmark { font-family: 'Oswald', sans-serif; font-size: 26px; letter-spacing: .14em; }
  .note { font-size: 19px; color: #a1a1aa; margin-top: 4px; }
  h1 {
    font-family: 'Oswald', sans-serif; font-weight: 500;
    font-size: 92px; line-height: 1; letter-spacing: -.01em;
    margin-top: auto; max-width: 880px;
  }
  .sub { margin-top: 22px; font-size: 27px; color: #a1a1aa; max-width: 900px; }
  .pill {
    margin-top: 34px; align-self: flex-start;
    display: inline-flex; align-items: center; gap: 12px;
    border: 2px solid rgba(255,59,48,.45); background: rgba(255,59,48,.12);
    border-radius: 999px; padding: 14px 26px; font-size: 24px; font-weight: 700;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #ff3b30; }
  .line { position: absolute; left: 0; bottom: 0; width: 100%; height: 6px; background: #e5322d; }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="wrap">
    <div class="top">
      <div class="mono">МО</div>
      <div>
        <div class="wordmark">МАКСИМ ОСИПОВ</div>
        <div class="note">Персональный тренер · зал «Колизей», Говорова</div>
      </div>
    </div>

    <h1>Тренируйся с Максимом</h1>
    <div class="sub">Программа, видео упражнений зала и ИИ-помощник МаксИИм — в одном приложении</div>
    <div class="pill"><span class="dot"></span>Первый месяц бесплатно</div>
  </div>
  <div class="line"></div>
</body>
</html>
`

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
