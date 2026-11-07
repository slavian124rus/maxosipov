import { expect, test } from '@playwright/test'

test('приложение на app.localhost показывает заглушку', async ({ page }) => {
  await page.goto('http://app.localhost:3000/')
  await expect(page.getByText('Приложение МаксИИм — скоро')).toBeVisible()
})

test('лендинг на localhost показывает имя тренера', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page.getByText('Максим Осипов')).toBeVisible()
})
