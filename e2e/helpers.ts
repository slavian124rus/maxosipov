import { createHash } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { queryDb } from './db'

const PHONE_MASK = /\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}/

/**
 * Вход по телефону через dev-код 1111.
 * Ждёт гидратацию (по работе маски) — до неё React сбрасывает введённое значение.
 */
/**
 * В production-сборке код `1111` для тестовых номеров отключён: подменяем хэш последнего кода
 * в БД на хэш `1111` (только для e2e на `E2E_PROD=1`).
 */
async function forceDevCode(phone: string): Promise<void> {
  const hash = createHash('sha256').update(`${phone}:1111`).digest('hex')
  await queryDb(
    'update otp_codes set code_hash = $1, attempts = 0 where phone = $2 and consumed_at is null',
    [hash, phone],
  )
}

export async function signInAs(
  page: Page,
  phone: string,
  base = 'http://app.localhost:3000',
): Promise<void> {
  if (process.env.E2E_PROD) await queryDb('delete from otp_codes where phone = $1', [phone])
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${base}/login/phone`)

    const input = page.getByLabel('Номер телефона')
    await input.fill(phone)
    // Маска — признак того, что обработчик React уже подключён.
    await expect(input).toHaveValue(PHONE_MASK, { timeout: 10_000 })

    await page.getByRole('button', { name: 'Получить код' }).click()

    try {
      await page.waitForURL(/\/login\/code/, { timeout: 10_000 })
      if (process.env.E2E_PROD) await forceDevCode(phone)
      break
    } catch (error) {
      if (attempt === 2) throw error
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const [index, digit] of ['1', '1', '1', '1'].entries()) {
      await page.getByLabel(`Цифра ${index + 1} из 4`).fill(digit)
    }

    try {
      // Форма отправляется сама, когда все 4 цифры введены.
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 })
      return
    } catch {
      // не ушли — повторим ввод (страница могла ещё не гидрироваться)
    }
  }

  throw new Error('не удалось войти по коду')
}

/** Выход: POST на роут, куки чистятся в общем контексте браузера. */
export async function signOut(page: Page): Promise<void> {
  await page.request.post('http://app.localhost:3000/api/auth/logout')
}
