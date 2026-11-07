import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

test('просроченный клиент: /exercises → /paywall, /progress доступен', async ({ page }) => {
  await signInAs(page, '+79990000015')

  await page.goto('http://app.localhost:3000/exercises')
  await expect(page).toHaveURL(/\/paywall/, { timeout: 15_000 })
  await expect(page.getByText('Подписка закончилась')).toBeVisible()

  await page.goto('http://app.localhost:3000/progress')
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
})
