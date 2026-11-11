import path from 'node:path'
import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs } from './helpers'

// Кабинет тренера живёт на admin.* (src/shared/surface.ts).
const ADMIN = 'http://admin.localhost:3000'
const TRAINER = '+79990000002'

test('тренажёры: создание с фото, шаг веса и правка названия', async ({ page }) => {
  await signInAs(page, TRAINER, ADMIN)

  const uniqueName = `Тренажёр ${Date.now().toString().slice(-5)}`

  await page.goto(`${ADMIN}/trainer/machines`)
  await expect(page.getByRole('heading', { name: 'Тренажёры' })).toBeVisible()

  // Создание: название, зона, шаг веса и фото из фикстуры.
  await page.getByRole('button', { name: 'Добавить тренажёр' }).first().click()
  await page.getByLabel('Название').fill(uniqueName)
  await page.getByLabel('Зона').fill('Проверка')
  await page.getByRole('button', { name: '2,5', exact: true }).click()
  await page.locator('#machine-photo').setInputFiles(path.resolve('tests/fixtures/photo/sample.jpg'))

  // Превью выбранного файла появляется сразу, ещё до обработки на сервере.
  await expect(page.locator('form img').first()).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Добавить тренажёр' }).last().click()
  await expect(page.getByLabel('Название')).toHaveCount(0, { timeout: 20_000 })

  // Тренажёр появился в дереве вместе с фото и шагом веса.
  await page.getByLabel('Поиск по тренажёрам').fill(uniqueName)
  const row = page.getByRole('button', { name: new RegExp(uniqueName) })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText('шаг 2,5 кг')
  await expect(row.locator('img')).toHaveCount(1)

  // Правка: название, зона и шаг веса.
  await row.click()
  await page.getByLabel('Название').fill(`${uniqueName} (правка)`)
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByLabel('Зона').fill('Ноги')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

  await expect(page.getByLabel('Название')).toHaveCount(0, { timeout: 20_000 })

  const [saved] = await queryDb<{ name: string; zone: string; weight_step_kg: number }>(
    'select name, zone, weight_step_kg from machines where name = $1',
    [`${uniqueName} (правка)`],
  )
  expect(saved?.zone).toBe('Ноги')
  expect(Number(saved?.weight_step_kg)).toBe(5)

  // Убираем тестовый тренажёр, чтобы прогон можно было повторять.
  await queryDb('delete from machines where name like $1', [`${uniqueName}%`])
})
