import { expect, test, type Page } from '@playwright/test'
import { queryDb } from './db'
import { signInAs } from './helpers'

const APP = 'http://app.localhost:3000'

async function setMode(page: Page, label: 'Свободный' | 'Пошаговый'): Promise<void> {
  await page.goto(`${APP}/profile`)
  await page.getByRole('button', { name: label }).click()
  await page.waitForLoadState('networkidle')
}

async function userId(phone: string): Promise<string> {
  const [row] = await queryDb<{ id: string }>('select id from users where phone = $1', [phone])
  return row!.id
}

async function sessionsOf(id: string) {
  return queryDb<{ id: string; finished_at: Date | null; sets: number }>(
    `select s.id, s.finished_at, (select count(*)::int from set_logs l where l.session_id = s.id) as sets
       from workout_sessions s where s.user_id = $1 order by s.started_at desc`,
    [id],
  )
}

/** Записывает подходы первого упражнения, пока не появится «Как прошло упражнение?». Возвращает их число. */
async function logAllSets(page: Page, limit = 6): Promise<number> {
  for (let number = 1; number <= limit; number += 1) {
    await page.getByRole('button', { name: `Записать подход ${number}` }).click()

    // подход появляется после записи в IndexedDB: ждём либо его чип, либо переход к «Как прошло…»
    const chip = page.getByText(new RegExp(`${number}: [\\d.]+ кг · \\d+ раз`))
    const picker = page.getByText('Как прошло упражнение?')
    await expect(chip.or(picker)).toBeVisible()
    if (await picker.isVisible()) return number
  }
  throw new Error('упражнение не завершилось за разумное число подходов')
}

/** Записывает ровно `count` подходов (меньше схемы упражнения). */
async function logSets(page: Page, count: number): Promise<void> {
  for (let number = 1; number <= count; number += 1) {
    await page.getByRole('button', { name: `Записать подход ${number}` }).click()
    await expect(page.getByText(new RegExp(`${number}: [\\d.]+ кг · \\d+ раз`))).toBeVisible()
  }
}

test('свободный режим: подходы видны, «Легко» → «В следующий раз», завершение попадает на сервер', async ({
  page,
}) => {
  const phone = '+79990000011'
  await signInAs(page, phone)
  await setMode(page, 'Свободный')

  const before = (await sessionsOf(await userId(phone))).length

  await page.goto(`${APP}/workout`)
  const total = await logAllSets(page)

  await expect(page.getByText('Как прошло упражнение?')).toBeVisible()
  await page.getByRole('button', { name: 'Легко' }).click()
  await expect(page.getByText(/В следующий раз:/)).toBeVisible()
  await page.getByRole('button', { name: 'Принять' }).click()

  await page.getByRole('button', { name: 'Завершить тренировку' }).click()
  await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible()

  await expect
    .poll(async () => (await sessionsOf(await userId(phone)))[0], { timeout: 20_000 })
    .toMatchObject({ sets: total, finished_at: expect.any(Date) })

  const sessions = await sessionsOf(await userId(phone))
  expect(sessions.length).toBe(before + 1)

  const [feeling] = await queryDb<{ feeling: string | null }>(
    'select distinct l.feeling from set_logs l where l.session_id = $1',
    [sessions[0]!.id],
  )
  expect(feeling?.feeling).toBe('easy')
})

test('офлайн: подходы пишутся, после перезагрузки тренировка продолжается, при возврате сети уходят на сервер', async ({
  page,
  context,
}) => {
  // Service Worker работает только в production-сборке: `pnpm build && E2E_PROD=1 pnpm test:e2e`
  test.skip(!process.env.E2E_PROD, 'нужна production-сборка (E2E_PROD=1)')

  const phone = '+79990000012'
  await signInAs(page, phone)
  await setMode(page, 'Свободный')

  await page.goto(`${APP}/workout`)
  await expect(page.getByRole('button', { name: 'Записать подход 1' })).toBeVisible()
  // старт ушёл на сервер
  await expect
    .poll(async () => (await sessionsOf(await userId(phone))).length, { timeout: 15_000 })
    .toBeGreaterThan(0)
  const sessionsBefore = (await sessionsOf(await userId(phone))).length

  // Service Worker должен взять страницу под контроль и положить её в кэш до обрыва сети
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Записать подход 1' })).toBeVisible()
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await logSets(page, 2)

  // закрыли и снова открыли приложение без сети: сессия та же, подходы на месте
  await page.reload()
  await expect(page.getByText(/1: [\d.]+ кг · \d+ раз/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/2: [\d.]+ кг · \d+ раз/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Записать подход 3' })).toBeVisible()
  await expect(page.getByText(/Не отправлено: 2/)).toBeVisible()

  await context.setOffline(false)

  await expect
    .poll(async () => (await sessionsOf(await userId(phone)))[0]?.sets, { timeout: 30_000 })
    .toBe(2)
  // перезагрузка не создала вторую сессию
  expect((await sessionsOf(await userId(phone))).length).toBe(sessionsBefore)
})

test('старт тренировки без сети: подходы и завершение доходят, когда сеть вернулась', async ({
  page,
  context,
}) => {
  const phone = '+79990000013'
  await signInAs(page, phone)
  await setMode(page, 'Свободный')

  const before = (await sessionsOf(await userId(phone))).length

  // страница уже закэширована/загружена онлайн; обрываем сеть до старта сессии на клиенте
  await page.route('**/api/training/start', (route) => route.abort())
  await page.goto(`${APP}/workout`)
  const total = await logAllSets(page)
  await page.getByRole('button', { name: 'Завершить тренировку' }).click()
  await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible()

  // сервер о тренировке не знает
  expect((await sessionsOf(await userId(phone))).length).toBe(before)

  await page.unroute('**/api/training/start')
  await context.setOffline(false)
  await page.goto(`${APP}/`)

  await expect
    .poll(async () => (await sessionsOf(await userId(phone)))[0], { timeout: 40_000 })
    .toMatchObject({ sets: total, finished_at: expect.any(Date) })
  expect((await sessionsOf(await userId(phone))).length).toBe(before + 1)
})

test('после входа браузер остаётся на хосте приложения', async ({ page }) => {
  await signInAs(page, '+79990000014')
  await page.goto(`${APP}/`)
  expect(new URL(page.url()).host).toBe('app.localhost:3000')
})
