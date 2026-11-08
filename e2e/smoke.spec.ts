import { expect, test } from '@playwright/test'

test('без сессии на app.localhost открывается экран входа', async ({ page }) => {
  await page.goto('http://app.localhost:3000/')
  await expect(page.getByRole('heading', { name: 'Тренируйся с Максимом' })).toBeVisible()
})

test('лендинг на localhost показывает имя тренера', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page.getByText('Максим Осипов')).toBeVisible()
})
