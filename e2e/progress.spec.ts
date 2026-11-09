import { execSync, spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { queryDb } from './db'
import { signInAs, signOut } from './helpers'

const APP = 'http://app.localhost:3000'

/** Воркер нужен только тесту загрузки фото: запускаем его на время теста. */
let worker: ChildProcess | null = null

function startWorker(): void {
  // На Linux/macOS — отдельная группа процессов, чтобы убить вместе с дочерними tsx/node
  worker = spawn('pnpm worker', { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
}

function stopWorker(): void {
  if (!worker?.pid) return

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${worker.pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(-worker.pid, 'SIGTERM')
    }
  } catch {
    // уже остановлен
  }

  worker = null
}

test.describe('прогресс', () => {
  test('график веса из сида и добавление замера', async ({ page }) => {
    await signInAs(page, '+79990000011')

    // Чистим сегодняшний замер, чтобы значение было предсказуемым при повторных прогонах
    await queryDb(
      "delete from body_measurements where user_id = (select id from users where phone = $1) and date = current_date",
      ['+79990000011'],
    )

    await page.goto(`${APP}/progress`)
    await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
    await expect(page.getByText('Рабочий вес')).toBeVisible()
    await expect(page.getByText('Объём за неделю')).toBeVisible()

    await page.goto(`${APP}/progress/measurements`)
    await page.getByLabel('Вес, кг').fill('77,4')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Замер сохранён')).toBeVisible()

    await page.goto(`${APP}/progress`)
    await expect(page.getByText(/77,4/).first()).toBeVisible()
  })

  test('истёкшая подписка: прогресс и замеры видны, кнопок добавления нет', async ({ page }) => {
    await signInAs(page, '+79990000015')

    await page.goto(`${APP}/progress`)
    await expect(page.getByRole('heading', { name: 'Прогресс' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Добавить замер' })).toHaveCount(0)

    await page.goto(`${APP}/progress/measurements`)
    await expect(page.getByRole('heading', { name: 'Замеры' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0)

    // Отказ сервера на запись без подписки проверяет модульный тест (service.test.ts);
    // здесь убеждаемся, что замеров нет
    const [row] = await queryDb<{ count: string }>(
      'select count(*)::text as count from body_measurements where user_id = (select id from users where phone = $1)',
      ['+79990000015'],
    )
    expect(row?.count).toBe('0')
  })

  test('карточка прошлой тренировки открывается из «Тренировок»', async ({ page }) => {
    await signInAs(page, '+79990000011')

    // Тренировку создаём через API: UI-путь проверяют тесты workout.spec.ts
    const [exercise] = await queryDb<{ id: string }>('select id from exercises order by created_at limit 1')
    expect(exercise?.id).toBeTruthy()

    const clientUuid = `progress-card-${Date.now()}`
    const started = await page.request.post(`${APP}/api/training/start`, {
      data: { clientUuid, mode: 'free' },
    })
    expect(started.ok()).toBe(true)

    const synced = await page.request.post(`${APP}/api/training/sync`, {
      data: {
        items: [
          {
            clientUuid: `${clientUuid}-1`,
            sessionClientUuid: clientUuid,
            exerciseId: exercise!.id,
            setIndex: 1,
            weightKg: 62.3,
            reps: 10,
          },
        ],
      },
    })
    expect(synced.ok()).toBe(true)

    const finished = await page.request.post(`${APP}/api/training/finish`, {
      data: { sessionClientUuid: clientUuid },
    })
    expect(finished.ok()).toBe(true)

    await page.goto(`${APP}/workouts`)
    const entry = page.locator('a[href^="/workouts/"]').first()
    await expect(entry).toBeVisible()
    await entry.click()

    await expect(page).toHaveURL(/\/workouts\/[0-9a-f-]{36}/)
    await expect(page.getByText(/62,3\s*кг\s*·\s*10\s*раз/).first()).toBeVisible()
    await expect(page.getByText('Назад')).toBeVisible()
  })

  test('загрузка фото прогресса: превью готово после обработки', async ({ page }) => {
    test.setTimeout(180_000)
    startWorker()

    try {
      await signInAs(page, '+79990000011')
      await page.goto(`${APP}/progress/photos`)
      await expect(page.getByRole('heading', { name: 'Фото прогресса' })).toBeVisible()

      await page
        .locator('input[type="file"]')
        .setInputFiles(path.resolve('tests/fixtures/photo/sample.jpg'))

      await expect(page.getByRole('button', { name: 'Добавить фото' })).toBeEnabled({ timeout: 60_000 })
      await page.getByRole('button', { name: 'Добавить фото' }).click()
      await expect(page.getByText('Фото добавлено')).toBeVisible({ timeout: 30_000 })

      // Воркер обрабатывает фото; страница сама обновляется раз в 5 с
      await expect(page.locator('img[alt*="Спереди"]').first()).toBeVisible({ timeout: 90_000 })
    } finally {
      stopWorker()
    }
  })

  test('без подписки загрузчик фото скрыт', async ({ page }) => {
    await signOut(page)
    await signInAs(page, '+79990000015')

    await page.goto(`${APP}/progress/photos`)
    await expect(page.getByRole('heading', { name: 'Фото прогресса' })).toBeVisible()
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
  })
})
