import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { findLoop, hasFfmpeg, probeVideo, processVideo, runProcess } from '@/modules/media'
import type { Media } from '@/shared/db/schema'

/**
 * Интеграционный прогон пайплайна на фикстурах. Требует ffmpeg (с libvidstab) и python с opencv.
 * Запуск: `pnpm test:media`. Без ffmpeg тесты пропускаются.
 *
 * Фикстуры — зацикленные клипы по 5,4 с, поэтому петлю для них задаём вручную
 * (`find_loop.py` отвергает ролики короче 7 с). Поиск петли проверяется на длинном ролике.
 */
const ffmpegReady = await hasFfmpeg()
const execFileAsync = promisify(execFile)
const FIXTURES = path.resolve('tests/fixtures/video')
const LOOP = { loopStart: 0.5, loopEnd: 4.0 }

let root = ''

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pipeline-'))
  process.env.MEDIA_ROOT = root
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

async function run(name: string, fixture: string, extension = 'mp4') {
  const relDir = `2026/11/${name}`
  await mkdir(path.join(root, relDir), { recursive: true })
  await copyFile(fixture, path.join(root, relDir, `original.${extension}`))

  const row = {
    id: name,
    createdAt: new Date('2026-11-07T00:00:00Z'),
    originalPath: `${relDir}/original.${extension}`,
    processingOptions: { cropX: 0.5, ...LOOP },
  } as unknown as Media

  const paths = await processVideo(row)
  return {
    mp4: path.join(root, paths.mp4!),
    webm: path.join(root, paths.webm!),
    poster: path.join(root, paths.poster!),
  }
}

/** Средний PSNR двух роликов одной длины (дБ). */
async function psnr(a: string, b: string): Promise<number> {
  const { stderr } = await execFileAsync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'])
  const match = /average:([0-9.]+)/.exec(stderr)
  if (!match) throw new Error(`PSNR не найден: ${stderr.slice(-200)}`)
  return Number(match[1])
}

test.skipIf(!ffmpegReady)(
  '@slow вертикальный и горизонтальный ролики → 720×1280, mp4 = webm по длине, постер есть',
  async () => {
    for (const name of ['vertical', 'horizontal']) {
      const out = await run(name, path.join(FIXTURES, `${name}.mp4`))

      expect((await stat(out.poster)).size).toBeGreaterThan(1000)

      const mp4 = await probeVideo(out.mp4)
      const webm = await probeVideo(out.webm)

      expect(mp4.width).toBe(720)
      expect(mp4.height).toBe(1280)
      expect(mp4.rotation).toBe(0)
      expect(mp4.duration).toBeGreaterThanOrEqual(3)
      expect(mp4.duration).toBeLessThanOrEqual(4)
      expect(Math.abs(mp4.duration - webm.duration)).toBeLessThan(0.2)
    }
  },
  15 * 60 * 1000,
)

test.skipIf(!ffmpegReady)(
  '@slow ролик с тегом поворота (iPhone) выходит ровным 720×1280 и совпадает с вертикальным',
  async () => {
    const rotatedProbe = await probeVideo(path.join(FIXTURES, 'rotated.mp4'))
    expect([90, 270]).toContain(rotatedProbe.rotation)
    expect(rotatedProbe.width).toBeGreaterThan(rotatedProbe.height)

    const upright = await run('upright', path.join(FIXTURES, 'vertical.mp4'))
    const rotated = await run('rotated', path.join(FIXTURES, 'rotated.mp4'))

    const probe = await probeVideo(rotated.mp4)
    expect(probe.width).toBe(720)
    expect(probe.height).toBe(1280)
    expect(probe.rotation).toBe(0)

    // Тот же кадр, что и у ролика без тега: если поворот двойной или не в ту сторону,
    // PSNR падает ниже 15 дБ; перекодирование даёт более 28.
    expect(await psnr(rotated.mp4, upright.mp4)).toBeGreaterThan(25)
  },
  15 * 60 * 1000,
)

test.skipIf(!ffmpegReady)(
  '@slow поиск петли на длинном ролике',
  async () => {
    const long = path.join(root, 'long.mp4')
    await runProcess('ffmpeg', ['-y', '-stream_loop', '3', '-i', path.join(FIXTURES, 'vertical.mp4'), '-c', 'copy', long], 60_000)

    const loop = await findLoop(long)
    expect(loop.end).toBeGreaterThan(loop.start)
    expect(loop.end - loop.start).toBeGreaterThanOrEqual(5)
    expect(loop.end - loop.start).toBeLessThanOrEqual(12)
  },
  5 * 60 * 1000,
)
