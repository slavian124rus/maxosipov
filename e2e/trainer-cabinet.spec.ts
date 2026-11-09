import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs, signOut } from './helpers'

const TRAINER = '+79990000002'
const CLIENT = '+79990000011'

test.describe('кабинет тренера', () => {
  test.beforeEach(async () => {
    // Прогон без пересоздания базы: убираем прошлые заметки и возвращаем схему 3·10–12.
    await queryDb(
      `delete from trainer_notes where client_id = (select id from users where phone = $1)`,
      [CLIENT],
    )
    await queryDb(
      `update program_exercises pe
          set sets = 3, rep_min = 10, rep_max = 12
        where pe.id in (
          select pe2.id from program_exercises pe2
            join program_days pd on pd.id = pe2.day_id
            join programs p on p.id = pd.program_id
            join users u on u.id = p.owner_id
           where u.phone = $1 and p.status = 'active'
        )`,
      [CLIENT],
    )
  })

  test('тренер пишет заметку, клиент видит её в профиле', async ({ page }) => {
    await signInAs(page, TRAINER)
    await page.goto('http://app.localhost:3000/trainer/clients')

    await page.getByRole('link').filter({ hasText: 'Иван Петров' }).first().click()
    await page.getByRole('link', { name: 'Заметки' }).click()

    await page.getByLabel('Текст заметки').fill('Следи за спиной на тяге')
    await page.getByRole('checkbox', { name: 'Показать клиенту' }).check()
    await page.getByRole('button', { name: 'Сохранить заметку' }).click()

    await expect(page.getByText('Следи за спиной на тяге')).toBeVisible()

    await signOut(page)
    await signInAs(page, CLIENT)
    await page.goto('http://app.localhost:3000/profile')

    await expect(page.getByText('Заметки Максима')).toBeVisible()
    await expect(page.getByText('Следи за спиной на тяге')).toBeVisible()
  })

  test('Максим меняет схему упражнения — клиент видит новую', async ({ page }) => {
    await signInAs(page, TRAINER)
    await page.goto('http://app.localhost:3000/trainer/clients')
    await page.getByRole('link').filter({ hasText: 'Иван Петров' }).first().click()
    await page.getByRole('link', { name: 'Программа' }).click()

    await page.getByRole('button', { name: '3 подхода · 10–12 раз' }).first().click()
    await page.getByRole('button', { name: 'Подходы больше' }).click()
    await page.getByRole('button', { name: 'Готово' }).click()

    await expect(page.getByRole('button', { name: '4 подхода · 10–12 раз' }).first()).toBeVisible({
      timeout: 15_000,
    })

    const sets = await queryDb<{ sets: number }>(
      `select pe.sets
         from program_exercises pe
         join program_days pd on pd.id = pe.day_id
         join programs p on p.id = pd.program_id
         join users u on u.id = p.owner_id
        where u.phone = $1 and p.status = 'active'
        order by pe."order"
        limit 1`,
      [CLIENT],
    )
    expect(sets[0]?.sets).toBe(4)

    await signOut(page)
    await signInAs(page, CLIENT)
    await page.goto('http://app.localhost:3000/workout')

    await expect(page.getByText('4 подхода · 10–12 раз').first()).toBeVisible({ timeout: 15_000 })
  })
})