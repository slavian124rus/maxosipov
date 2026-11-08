import { expect, test } from '@playwright/test'
import path from 'node:path'
import { signInAs } from './helpers'

test('мастер: видео → тренажёр → мышцы → описание → черновик', async ({ page }) => {
  await signInAs(page, '+79990000002')

  const uniqueName = `Тяга нижнего блока ${Date.now().toString().slice(-5)}`

  await page.goto('http://app.localhost:3000/trainer/exercises/new')
  await expect(page.getByRole('heading', { name: 'Видео' })).toBeVisible()

  // Шаг 1: видео из фикстуры
  await page.locator('input[type="file"]').setInputFiles(
    path.resolve('tests/fixtures/video/vertical.mp4'),
  )
  await expect(page.getByText('Видео загружено')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 2: тренажёр
  await expect(page.getByRole('heading', { name: 'Тренажёр' })).toBeVisible()
  await page.getByRole('button', { name: 'Блочный тренажёр (верхняя тяга)' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 3: мышцы — широчайшие сзади
  await expect(page.getByRole('heading', { name: 'Мышцы' })).toBeVisible()
  await page.getByRole('button', { name: 'Сзади' }).first().click()
  await page.locator('[data-muscle="lats"]').first().click({ force: true })
  await expect(page.getByText(/Основные: Широчайшие/)).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 4: описание
  await expect(page.getByRole('heading', { name: 'Описание' })).toBeVisible()
  await page.getByLabel('Название').fill(uniqueName)
  await page.getByPlaceholder('Сядь и зафиксируй колени').fill('Сядь ровно')
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 5: проверка и черновик
  await expect(page.getByRole('heading', { name: 'Проверка' })).toBeVisible()
  await page.getByRole('button', { name: 'Черновик' }).click()
  await expect(page.getByText('Сохранено')).toBeVisible({ timeout: 20_000 })

  // Черновик виден тренеру
  await page.goto('http://app.localhost:3000/trainer/exercises?tab=draft')
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 15_000 })
})
