import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Интеграционные тесты видео: нужны ffmpeg и python с opencv. Запуск: `pnpm test:media`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
