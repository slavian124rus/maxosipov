import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  // e2e меняют одни и те же данные сида — гоняем по одному файлу
  workers: 1,
  // dev-сервер компилирует страницы на лету — 30 с не хватает
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    // Фейковый ИИ-провайдер для e2e: настоящая модель не нужна (AI_BASE_URL ниже).
    {
      command: 'pnpm exec tsx e2e/fake-ai-server.ts',
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // E2E_PROD=1: проверка Service Worker и офлайн-режима на production-сборке (`pnpm build` заранее)
      command: process.env.E2E_PROD
        ? 'node node_modules/next/dist/bin/next start'
        : 'node node_modules/next/dist/bin/next dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        AI_BASE_URL: 'http://127.0.0.1:4010/v1',
        AI_API_KEY: 'e2e-fake-key',
        AI_MODEL_MAIN: 'fake-main',
        AI_MODEL_FAST: 'fake-fast',
        AI_MODEL_FALLBACK: 'fake-fallback',
        STT_PROVIDER: 'plusvibe',
        STT_MODEL: 'fake-stt',
      },
    },
  ],
})
