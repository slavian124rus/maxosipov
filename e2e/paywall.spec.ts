import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

test('просроченный клиент: /exercises → /paywall, /progress доступен', async ({ page }) => {
  await signInAs(page, '+79990000015')

  await page.goto('http://app.localhost:3000/exercises')
  await expect(page).toHaveURL(/\/paywall/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Подписка закончилась' })).toBeVisible()

  await page.goto('http://app.localhost:3000/progress')
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
})

test('просроченный клиент не попадает в «Упражнения» переходом из нижнего меню', async ({
  page,
}) => {
  await signInAs(page, '+79990000015')

  await page.goto('http://app.localhost:3000/progress')
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()

  // клиентская навигация: layout не перерисовывается — охраняет сама страница
  await page.getByRole('link', { name: 'Упражнения' }).click()
  await expect(page).toHaveURL(/\/paywall/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Подписка закончилась' })).toBeVisible()
})

test('внутренние пути /app/* на хосте приложения не открываются, заголовок x-pathname не помогает', async ({
  request,
}) => {
  const response = await request.get('http://app.localhost:3000/app/exercises', {
    headers: { 'x-pathname': '/progress' },
    maxRedirects: 0,
  })
  expect(response.status()).toBe(404)
})
