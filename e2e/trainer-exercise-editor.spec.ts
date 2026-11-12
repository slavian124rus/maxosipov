import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs } from './helpers'

// Кабинет тренера живёт на admin.* (src/shared/surface.ts).
const ADMIN = 'http://admin.localhost:3000'
const TRAINER = '+79990000002'

test('правка упражнения из дерева: окно с вкладками, без мастера по шагам', async ({ page }) => {
  await signInAs(page, TRAINER, ADMIN)

  const [draft] = await queryDb<{ id: string; name: string }>(
    `select id, name from exercises
      where status = 'draft' and archived_at is null
      order by name limit 1`,
  )
  expect(draft).toBeTruthy()
  const name = draft!.name

  await page.goto(`${ADMIN}/trainer/exercises?tab=draft`)
  await page.getByLabel('Поиск по упражнениям').fill(name)

  // Касание строки открывает окно на месте, адрес не меняется.
  await page.getByRole('button', { name: new RegExp(name) }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/tab=draft/)

  // Все пять разделов на месте, по умолчанию открыто «Описание» с заполненным названием.
  for (const label of ['Описание', 'Видео', 'Тренажёр', 'Мышцы', 'Публикация']) {
    await expect(page.getByRole('tab', { name: label })).toBeVisible()
  }
  await expect(page.getByLabel('Название')).toHaveValue(name)

  // Правка и сохранение прямо из окна.
  const updated = `${name} (проверка)`
  await page.getByLabel('Название').fill(updated)
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(dialog.getByText('Сохранено')).toBeVisible({ timeout: 20_000 })

  const [saved] = await queryDb<{ name: string }>('select name from exercises where id = $1', [
    draft!.id,
  ])
  expect(saved?.name).toBe(updated)

  // Возвращаем название, чтобы прогон можно было повторять.
  await queryDb('update exercises set name = $1 where id = $2', [name, draft!.id])
})