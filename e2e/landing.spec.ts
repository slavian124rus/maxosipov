import { expect, test } from '@playwright/test'
import { queryDb } from './db'

const SITE = 'http://localhost:3000'
const APP = 'http://app.localhost:3000'
const LOGIN = `${APP}/login`

/** Случайный номер, чтобы не упираться в дедупликацию «тот же телефон за 10 минут». */
function randomPhone(): string {
  return `+79991${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`
}

test.beforeEach(async () => {
  // Лимит — 5 заявок с IP в час; e2e ходит с локального адреса, чистим его следы.
  await queryDb(`delete from leads where ip in ('127.0.0.1', '::1', 'unknown')`)
})

test('лендинг открывается: первый экран, блоки и цена без выдуманных цифр', async ({ page }) => {
  await page.goto(`${SITE}/`)

  await expect(page.getByRole('heading', { level: 1, name: 'Тренируйся с Максимом' })).toBeVisible()
  await expect(page.getByText('Персональный тренер · 10+ лет · Колизей, Говорова')).toBeVisible()

  // Блоки из DESIGN.md §10 — по порядку.
  await expect(page.getByRole('heading', { name: 'Что внутри приложения' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'МаксИИм — помощник в зале' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Сколько стоит' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Как начать' })).toBeVisible()
  await expect(page.getByText('Первый месяц бесплатно, дальше — цену скажет Максим')).toBeVisible()

  // Отзывов от владельца нет — блока быть не должно (Review Focus 2).
  await expect(page.getByRole('heading', { name: 'Результаты клиентов' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Обо мне' })).toHaveCount(0)

  // Видео первого экрана не грузится до `load` и не грузится вовсе без движения.
  await expect(page.locator('video')).toHaveCount(0)
})

test('кнопка «Получить месяц бесплатно» ведёт на app.localhost:3000/login', async ({ page }) => {
  await page.goto(`${SITE}/`)

  const cta = page.getByRole('link', { name: /Получить месяц бесплатно/ }).first()
  await expect(cta).toHaveAttribute('href', LOGIN)

  await cta.click()
  await page.waitForURL(/\/login/)
  expect(page.url().startsWith(LOGIN)).toBe(true)
})

test('внутренние пути приложения на сайте не открываются — 404', async ({ page }) => {
  const response = await page.goto(`${SITE}/app/exercises`)

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Что внутри приложения' })).toHaveCount(0)
})

test('заявка с лендинга: одна запись, двойное нажатие не дублирует', async ({ page }) => {
  const phone = randomPhone()

  await page.goto(`${SITE}/`)
  await page.getByLabel('Имя').fill('Иван')
  await page.getByLabel('Телефон').fill(phone)
  await page.getByLabel(/Согласен на обработку персональных данных/).check()

  const submit = page.getByRole('button', { name: 'Отправить' })
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page.getByText('Готово! Максим свяжется с тобой')).toBeVisible()
  // Формы больше нет — нажать «Отправить» второй раз не получится.
  await expect(page.getByRole('button', { name: 'Отправить' })).toHaveCount(0)

  const rows = await queryDb<{ name: string; phone: string; ip: string }>(
    'select name, phone, ip from leads where phone = $1',
    [`+7${phone.slice(2)}`],
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]?.name).toBe('Иван')
})

test('заявка без согласия не уходит, кривой номер — понятная ошибка', async ({ page }) => {
  const count = async (): Promise<number> => {
    const rows = await queryDb<{ total: number }>('select count(*)::int as total from leads')
    return rows[0]?.total ?? 0
  }

  await page.goto(`${SITE}/`)
  await page.getByLabel('Имя').fill('Пётр')
  await page.getByLabel('Телефон').fill(randomPhone())

  const submit = page.getByRole('button', { name: 'Отправить' })
  const before = await count()

  // Галочки нет: браузер не отправляет форму (`required`), заявка не появляется.
  await submit.click()
  expect(await count()).toBe(before)

  // Серверная защита не зависит от разметки: согласие есть, номер кривой.
  await page.getByLabel(/Согласен на обработку персональных данных/).check()
  await page.getByLabel('Телефон').fill('123')
  await submit.click()

  await expect(page.getByRole('alert')).toContainText('Проверь номер')
  expect(await count()).toBe(before)
})

test('robots.txt: сайт индексируется, приложение — нет', async ({ request }) => {
  const site = await request.get(`${SITE}/robots.txt`)
  const siteText = await site.text()
  expect(site.status()).toBe(200)
  expect(siteText).toContain('Disallow: /app')
  expect(siteText).toContain('Sitemap:')

  const app = await request.get(`${APP}/robots.txt`)
  const appText = await app.text()
  expect(app.status()).toBe(200)
  expect(appText).toContain('Disallow: /')
  expect(appText).not.toContain('Sitemap:')
})

test('sitemap.xml — только главная и юридические страницы', async ({ request }) => {
  const response = await request.get(`${SITE}/sitemap.xml`)
  const xml = await response.text()

  expect(response.status()).toBe(200)
  expect(xml).toContain('<loc>http://localhost:3000/</loc>')
  expect(xml).toContain('/legal/privacy')
  expect(xml).toContain('/legal/consent')
  expect(xml).not.toContain('/app')
})

test('юридические страницы сайта открываются и ведут назад на лендинг', async ({ page }) => {
  await page.goto(`${SITE}/legal/privacy`)
  await expect(
    page.getByRole('heading', { name: 'Политика обработки персональных данных' }),
  ).toBeVisible()

  await page.goto(`${SITE}/legal/consent`)
  await expect(
    page.getByRole('heading', { name: 'Согласие на обработку персональных данных' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Назад' }).click()
  await page.waitForURL(`${SITE}/`)
  await expect(page.getByRole('heading', { level: 1, name: 'Тренируйся с Максимом' })).toBeVisible()
})
