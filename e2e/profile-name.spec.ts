import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs } from './helpers'

// Кабинет тренера живёт на admin.* (src/shared/surface.ts).
const APP = 'http://app.localhost:3000'
const ADMIN = 'http://admin.localhost:3000'
const CLIENT = '+79990000011'
const TRAINER = '+79990000002'

test('клиент правит имя в профиле, тренер — в карточке клиента', async ({ page }) => {
  const name = `Иван ${Date.now().toString().slice(-4)}`

  // Клиент: имя в профиле сохраняется и видно в шапке.
  await signInAs(page, CLIENT, APP)
  await page.goto(`${APP}/profile`)
  await page.getByLabel('Имя', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('status').first()).toHaveText('Сохранено')

  const [saved] = await queryDb<{ name: string }>('select name from users where phone = $1', [CLIENT])
  expect(saved?.name).toBe(name)

  // Тренер: видит новое имя и может поправить его прямо в карточке.
  const [client] = await queryDb<{ id: string }>('select id from users where phone = $1', [CLIENT])
  await signInAs(page, TRAINER, ADMIN)
  await page.goto(`${ADMIN}/trainer/clients/${client!.id}?tab=notes`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name)

  await page.getByRole('button', { name: 'Изменить имя клиента' }).click()
  await page.getByLabel('Имя клиента').fill(`${name} из кабинета`)
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('status').first()).toHaveText('Сохранено')

  const [renamed] = await queryDb<{ name: string }>('select name from users where phone = $1', [
    CLIENT,
  ])
  expect(renamed?.name).toBe(`${name} из кабинета`)
})