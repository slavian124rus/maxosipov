import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

const APP = 'http://app.localhost:3000'

/**
 * ПК-раскладка клиентского приложения (DESIGN.md §8.1): боковое меню вместо нижнего,
 * широкое полотно и двухколоночные экраны. Мобильная версия проверяется остальными спеками.
 */
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

test('ПК: экран входа — бренд слева, форма справа', async ({ page }) => {
  await page.goto(`${APP}/login`)
  await expect(page.getByRole('heading', { name: 'Тренируйся с Максимом' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Войти по номеру телефона' })).toBeVisible()

  const form = await page.locator('main').boundingBox()
  expect(form).not.toBeNull()
  expect(form!.x).toBeGreaterThan(500)
  expect(form!.width).toBeLessThan(700)
})

test('ПК: боковое меню, широкое полотно, нижнего меню нет', async ({ page }) => {
  await signInAs(page, '+79990000011')

  await page.goto(`${APP}/`)
  const sideNav = page.getByRole('navigation', { name: 'Разделы приложения' })
  await expect(sideNav).toBeVisible()
  await expect(sideNav.getByRole('link', { name: /Сегодня/ })).toBeVisible()
  await expect(sideNav.getByRole('link', { name: /МаксИИм/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Основное меню' })).toBeHidden()

  const main = page.locator('main').first()
  const box = await main.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThan(268)
  expect(box!.width).toBeGreaterThan(800)
})

test('ПК: каталог — липкие фильтры слева и сетка в две карточки', async ({ page }) => {
  await signInAs(page, '+79990000011')

  await page.goto(`${APP}/exercises`)
  await expect(page.getByRole('heading', { name: 'Упражнения' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Мышцы' })).toBeVisible()
  await expect(page.getByPlaceholder('Найти упражнение')).toBeVisible()

  const cards = page.locator('a[href^="/exercises/"]')
  const first = await cards.nth(0).boundingBox()
  const second = await cards.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  // Две карточки стоят рядом, а не друг под другом.
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(5)
  expect(second!.x).toBeGreaterThan(first!.x + 100)

  // Сайдбар остаётся на месте и на внутренних экранах.
  await page.goto(`${APP}/progress`)
  await expect(page.getByRole('navigation', { name: 'Разделы приложения' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
})
