import { expect, test } from '@playwright/test'

/** Вход тестовым клиентом через dev-код 1111. */
async function signInAs(page: import('@playwright/test').Page, phone: string): Promise<void> {
  await page.goto('http://app.localhost:3000/login/phone')
  await page.getByLabel('Номер телефона').fill(phone)
  await page.getByRole('button', { name: 'Получить код' }).click()
  await expect(page).toHaveURL(/\/login\/code/)

  for (const [index, digit] of ['1', '1', '1', '1'].entries()) {
    await page.getByLabel(`Цифра ${index + 1} из 4`).fill(digit)
  }
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 })
}

test('просроченный клиент: /exercises → /paywall, /progress доступен', async ({ page }) => {
  await signInAs(page, '+79990000015')

  await page.goto('http://app.localhost:3000/exercises')
  await expect(page).toHaveURL(/\/paywall/, { timeout: 15_000 })
  await expect(page.getByText('Подписка закончилась')).toBeVisible()

  await page.goto('http://app.localhost:3000/progress')
  await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
})
