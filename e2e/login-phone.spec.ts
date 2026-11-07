import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

/** Случайный dev-номер: код всегда 1111, СМС не уходит. */
function devPhone(): string {
  return `+7999000${String(1000 + Math.floor(Math.random() * 9000))}`
}

test('вход по номеру телефона ведёт на анкету', async ({ page }) => {
  const phone = devPhone()

  await page.goto('http://app.localhost:3000/login')
  await expect(page.getByText('Тренируйся с Максимом')).toBeVisible()

  await page.getByRole('link', { name: 'Войти по номеру телефона' }).click()
  await expect(page).toHaveURL(/\/login\/phone/)

  await signInAs(page, phone)

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
})
