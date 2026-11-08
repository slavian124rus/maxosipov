import { expect, test } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findLoop, hasFfmpeg, probeVideo, processVideo } from '@/modules/media'
import type { Media } from '@/shared/db/schema'

/**
 * Интеграционный прогон пайплайна на фикстурах. Требует ffmpeg + python с opencv.
 * Запуск: `pnpm test:media`. Без ffmpeg тест пропускается с понятным сообщением.
 */
const ffmpegReady = await hasFfmpeg()

test.skipIf(!ffmpegReady)(
  '@slow оба ролика: 720×1280, 5–12 с, mp4 = webm по кадрам, постер есть',
  async () => {
    const outRoot = await mkdtemp(path.join(tmpdir(), 'pipeline-'))
    process.env.MEDIA_ROOT = outRoot

    try {
      for (const name of ['vertical', 'horizontal']) {
        const relDir = `2026/11/${name}`
        const src = path.resolve('tests/fixtures/video', `${name}.mp4`)
        const { copyFile, mkdir } = await import('node:fs/promises')
        await mkdir(path.join(outRoot, relDir), { recursive: true })
        await copyFile(src, path.join(outRoot, relDir, 'original.mp4'))

        const row = {
          id: name,
          createdAt: new Date('2026-11-07T00:00:00Z'),
          originalPath: `${relDir}/original.mp4`,
          processingOptions: { cropX: 0.5 },
        } as unknown as Media

        const probe = await probeVideo(path.join(outRoot, relDir, 'original.mp4'))
        expect(probe.width).toBeGreaterThan(0)

        const paths = await processVideo(row)
        expect(paths.mp4).toBeTruthy()

        const mp4 = path.join(outRoot, paths.mp4!)
        const webm = path.join(outRoot, paths.webm!)
        const poster = path.join(outRoot, paths.poster!)

        expect((await stat(poster)).size).toBeGreaterThan(1000)

        const mp4Probe = await probeVideo(mp4)
        const webmProbe = await probeVideo(webm)

        expect(mp4Probe.width).toBe(720)
        expect(mp4Probe.height).toBe(1280)
        expect(mp4Probe.duration).toBeGreaterThanOrEqual(5)
        expect(mp4Probe.duration).toBeLessThanOrEqual(12.5)
        expect(Math.abs(mp4Probe.duration - webmProbe.duration)).toBeLessThan(0.2)

        const loop = await findLoop(mp4)
        expect(loop.end).toBeGreaterThan(loop.start)
      }
    } finally {
      await rm(outRoot, { recursive: true, force: true })
    }
  },
  15 * 60 * 1000,
)
