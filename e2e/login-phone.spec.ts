import { expect, test } from '@playwright/test'

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

  await page.getByLabel('Номер телефона').fill(phone)
  await page.getByRole('button', { name: 'Получить код' }).click()

  await expect(page).toHaveURL(/\/login\/code/)

  for (const [index, digit] of ['1', '1', '1', '1'].entries()) {
    await page.getByLabel(`Цифра ${index + 1} из 4`).fill(digit)
  }

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
})
