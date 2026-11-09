import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs } from './helpers'

test('МаксИИм: предложение изменения программы и «Принять»', async ({ page }) => {
  // Повторный прогон без пересоздания базы не должен видеть прошлые предложения,
  // а замену из прошлого прогона возвращаем на место.
  await queryDb(
    'delete from ai_proposals where user_id = (select id from users where phone = $1)',
    ['+79990000011'],
  )
  await queryDb(
    `update program_exercises pe
        set exercise_id = (select id from exercises where slug = 'tyaga-gorizontalnogo-bloka')
      where pe.id in (
        select pe2.id
          from program_exercises pe2
          join program_days pd on pd.id = pe2.day_id
          join programs p on p.id = pd.program_id
          join users u on u.id = p.owner_id
          join exercises e on e.id = pe2.exercise_id
         where u.phone = '+79990000011' and p.status = 'active' and e.slug = 'zhim-nogami'
      )`,
  )

  await signInAs(page, '+79990000011')
  await page.goto('http://app.localhost:3000/coach')

  const input = page.getByLabel('Сообщение МаксИИму')
  await input.fill('Замени тягу горизонтального блока на что-нибудь')
  await page.getByRole('button', { name: 'Отправить' }).click()

  await expect(page.getByRole('button', { name: 'Принять' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Принять' }).click()
  await expect(page.getByText('Принято ✓')).toBeVisible({ timeout: 15_000 })

  const exercises = await queryDb<{ slug: string }>(
    `select e.slug
       from program_exercises pe
       join exercises e on e.id = pe.exercise_id
       join program_days pd on pd.id = pe.day_id
       join programs p on p.id = pd.program_id
       join users u on u.id = p.owner_id
      where u.phone = '+79990000011' and p.status = 'active'`,
  )
  expect(exercises.map((row) => row.slug)).toContain('zhim-nogami')

  const changes = await queryDb<{ actor_kind: string }>(
    `select pc.actor_kind
       from program_changes pc
       join programs p on p.id = pc.program_id
       join users u on u.id = p.owner_id
      where u.phone = '+79990000011'
      order by pc.created_at desc
      limit 1`,
  )
  expect(changes[0]?.actor_kind).toBe('ai_proposal_accepted')
})