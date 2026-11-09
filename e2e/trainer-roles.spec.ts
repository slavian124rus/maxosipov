import { expect, test, type Page } from '@playwright/test'
import { queryDb } from './db'
import { signInAs, signOut } from './helpers'

const OWNER = '+79990000001'
const RECEPTION = '+79990000015'
const ROLE = 'Администратор ресепшена'

// Тест меняет роль клиента 5 — возвращаем её, чтобы не ломать другие сценарии.
test.afterEach(async () => {
  await queryDb(
    `update users set role_id = (select id from roles where name = 'Клиент' and is_client = true)
      where phone = $1`,
    [RECEPTION],
  )
})

async function rolePermissions(roleId: string): Promise<string> {
  const rows = await queryDb<{ permissions: unknown }>(
    'select permissions from roles where id = $1',
    [roleId],
  )
  return JSON.stringify(rows[0]?.permissions ?? null)
}

/** В dev форма оживает не сразу — сохраняем и проверяем по БД, повторяя при необходимости. */
async function saveRolePermissions(page: Page, roleId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.waitForTimeout(700)
    await page.getByLabel('Выдавать и продлевать подписки').selectOption('all')
    await page.getByRole('button', { name: 'Сохранить роль' }).click()
    await page.waitForTimeout(700)

    if ((await rolePermissions(roleId)).includes('subscriptions.grant')) return
  }

  throw new Error('право subscriptions.grant не сохранилось')
}

test('владелец создаёт роль, назначает её и видит запрет снять последнего владельца', async ({
  page,
}) => {
  // Повторный прогон без пересоздания базы.
  await queryDb(
    `update users set role_id = (select id from roles where name = 'Клиент' and is_client = true)
      where phone = $1`,
    [RECEPTION],
  )
  await queryDb('delete from roles where name = $1 and is_system = false', [ROLE])

  await signInAs(page, OWNER)
  await page.goto('http://app.localhost:3000/trainer/settings/roles')
  await page.waitForTimeout(700)

  await page.getByLabel('Название новой роли').fill(ROLE)
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByText(ROLE)).toBeVisible({ timeout: 15_000 })

  const [role] = await queryDb<{ id: string }>('select id from roles where name = $1', [ROLE])
  expect(role?.id).toBeTruthy()

  await page.goto(`http://app.localhost:3000/trainer/settings/roles/${role!.id}`)
  await saveRolePermissions(page, role!.id)

  // Назначаем роль клиенту 5.
  await page.goto('http://app.localhost:3000/trainer/settings/people?q=9990000015')
  await page.waitForTimeout(700)
  await page.getByLabel(/^Роль:/).first().selectOption({ label: ROLE })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole('button', { name: 'Сохранить роль' }).first().click()
    await page.waitForTimeout(700)

    const rows = await queryDb<{ role_id: string }>(
      'select role_id from users where phone = $1',
      [RECEPTION],
    )
    if (rows[0]?.role_id === role!.id) break
  }

  const assigned = await queryDb<{ role_id: string }>(
    'select role_id from users where phone = $1',
    [RECEPTION],
  )
  expect(assigned[0]?.role_id).toBe(role!.id)

  // Права могли сброситься повторной отправкой формы — проверяем ещё раз.
  if (!(await rolePermissions(role!.id)).includes('subscriptions.grant')) {
    await page.goto(`http://app.localhost:3000/trainer/settings/roles/${role!.id}`)
    await saveRolePermissions(page, role!.id)
  }

  // Администратор ресепшена видит «Подписки», но не «Программы».
  await signOut(page)
  await signInAs(page, RECEPTION)
  await page.goto('http://app.localhost:3000/trainer/settings')

  await expect(page.getByRole('link', { name: 'Подписки' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'Роли и права' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Программы' })).toHaveCount(0)

  // Владелец не может снять роль у последнего владельца — ошибка видна в интерфейсе.
  await signOut(page)
  await signInAs(page, OWNER)
  await page.goto('http://app.localhost:3000/trainer/settings/people?q=9990000001')
  await page.waitForTimeout(700)

  await page.getByLabel(/^Роль:/).first().selectOption({ label: 'Клиент' })

  let shown = false
  for (let attempt = 0; attempt < 5 && !shown; attempt += 1) {
    await page.getByRole('button', { name: 'Сохранить роль' }).first().click()
    shown = await page
      .getByText('Нельзя снять последнего владельца')
      .isVisible({ timeout: 2_000 })
      .catch(() => false)
    await page.waitForTimeout(500)
  }

  expect(shown).toBe(true)
})