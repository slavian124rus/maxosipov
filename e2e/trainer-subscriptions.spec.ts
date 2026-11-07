import { expect, test } from '@playwright/test'
import { signInAs, signOut } from './helpers'

test('Максим продлевает подписку клиенту, клиент получает доступ', async ({ page }) => {
  // 1. Максим выдаёт клиенту 5 месяц подписки.
  await signInAs(page, '+79990000002')
  await page.goto('http://app.localhost:3000/trainer/subscriptions')
  await expect(page.getByRole('heading', { name: 'Подписки' })).toBeVisible()

  await page.getByPlaceholder('Имя или телефон').fill('+79990000015')
  await page.getByRole('button', { name: 'Найти' }).click()
  await page.getByRole('button', { name: /Сергей Волков/ }).click()

  await page.getByRole('button', { name: '+1 мес' }).click()
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: /Сергей Волков/ })).toContainText('Подписка', {
    timeout: 15_000,
  })

  // 2. Клиент 5 теперь открывает упражнения.
  await signOut(page)
  await signInAs(page, '+79990000015')

  await page.goto('http://app.localhost:3000/exercises')
  await expect(page.getByRole('heading', { name: 'Упражнения' })).toBeVisible({ timeout: 15_000 })

  // 3. Возвращаем клиента в состояние «нет доступа», чтобы тесты не зависели от порядка.
  await signOut(page)
  await signInAs(page, '+79990000002')
  await page.goto('http://app.localhost:3000/trainer/subscriptions')
  await page.getByPlaceholder('Имя или телефон').fill('+79990000015')
  await page.getByRole('button', { name: 'Найти' }).click()
  await page.getByRole('button', { name: /Сергей Волков/ }).click()
  await page.getByRole('button', { name: 'Отключить' }).click()
  await page.getByRole('button', { name: 'Отключить', exact: true }).last().click()
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: /Сергей Волков/ })).toContainText('Отключена', {
    timeout: 15_000,
  })
})
