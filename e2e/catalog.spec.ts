import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

test('каталог: фильтр по широчайшим → карточка → переключатель «Мышцы»', async ({ page }) => {
  await signInAs(page, '+79990000011')

  await page.goto('http://app.localhost:3000/exercises')
  await expect(page.getByRole('heading', { name: 'Упражнения' })).toBeVisible()

  // Широчайшие видны сзади
  await page.getByRole('button', { name: 'Сзади' }).first().click()

  // Ряд мышц под фигурой: выбрать мышцу можно и чипом — попасть в него проще, чем в контур.
  const latsChip = page.getByRole('group', { name: 'Мышцы' }).getByRole('button', {
    name: /Широчайшие/,
  })
  await expect(latsChip).toBeVisible()

  await latsChip.click()
  await expect(page.getByText(/Фильтр:\s*Широчайшие/)).toBeVisible()
  await expect(page.getByText('Тяга верхнего блока к груди').first()).toBeVisible({
    timeout: 15_000,
  })

  // Повторное касание чипа снимает фильтр.
  await latsChip.click()
  await expect(page.getByText(/Фильтр:\s*Широчайшие/)).toHaveCount(0)

  const lats = page.locator('[data-muscle="lats"]').first()
  await expect(lats).toBeVisible()
  await lats.click({ force: true })

  await expect(page.getByText('Тяга верхнего блока к груди')).toBeVisible({ timeout: 15_000 })

  await page.getByText('Тяга верхнего блока к груди').first().click()
  await expect(page).toHaveURL(/\/exercises\/tyaga-verkhnego-bloka-k-grudi/, { timeout: 15_000 })

  await expect(page.getByRole('heading', { name: 'Тяга верхнего блока к груди' })).toBeVisible()
  await expect(page.getByText('Как делать')).toBeVisible()

  const toggle = page.getByRole('button', { name: 'Мышцы' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})
