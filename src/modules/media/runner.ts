import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { buildOutputCommands, buildPrepCommands } from './pipeline'
import { mediaDir, mediaRoot, safeJoin } from './paths'
import type { Media, ProcessedPaths } from './schema'

const DEFAULT_TIMEOUT = 15 * 60 * 1000

function ffmpeg(): string {
  return process.env.FFMPEG_PATH || 'ffmpeg'
}

function python(): string {
  return process.env.PYTHON_PATH || 'python3'
}

function toolsDir(): string {
  return process.env.MEDIA_TOOLS_DIR || 'media-tools'
}

/** Запускает процесс и возвращает stdout. При ошибке — текст stderr. */
export function runProcess(
  command: string,
  args: string[],
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Превышено время выполнения: ${command}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `${command} завершился с кодом ${code}`))
    })
  })
}

export type ProbeResult = {
  width: number
  height: number
  rotation: number
  duration: number
  fps: number
}

export type LoopResult = { start: number; end: number; mse: number }

function parseToolJson<T>(raw: string): T {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Скрипт вернул не JSON: ${raw.slice(0, 200)}`)
  }
  const error = (data as { error?: string }).error
  if (error) throw new Error(error)
  return data as T
}

/** Размер, поворот и длительность ролика (`media-tools/probe.py`). */
export async function probeVideo(src: string): Promise<ProbeResult> {
  const raw = await runProcess(python(), [`${toolsDir()}/probe.py`, src], 60_000)
  return parseToolJson<ProbeResult>(raw)
}

/** Поиск бесшовного цикла (`media-tools/find_loop.py`). */
export async function findLoop(src: string): Promise<LoopResult> {
  const raw = await runProcess(python(), [`${toolsDir()}/find_loop.py`, src], 5 * 60_000)
  return parseToolJson<LoopResult>(raw)
}

/** Есть ли ffmpeg в окружении (для интеграционного теста и понятной ошибки). */
export async function hasFfmpeg(): Promise<boolean> {
  try {
    await runProcess(ffmpeg(), ['-hide_banner', '-version'], 10_000)
    return true
  } catch {
    return false
  }
}

/** Промежуточные файлы обработки: `stab.trf` весит около 2 МБ на каждые 5 секунд видео. */
const TEMP_FILES = ['norm.mp4', 'stab.trf', 'stab.mp4', 'loop.mp4']

async function processVideoSteps(row: Media): Promise<ProcessedPaths> {
  if (!row.originalPath) throw new Error('Исходник не найден')

  const relDir = mediaDir(row)
  const dir = safeJoin(mediaRoot(), relDir)
  const src = safeJoin(mediaRoot(), row.originalPath)
  await mkdir(dir, { recursive: true })

  const probe = await probeVideo(src)

  for (const args of buildPrepCommands({ src, outDir: dir, rotation: probe.rotation })) {
    await runProcess(ffmpeg(), args)
  }

  const options = row.processingOptions ?? { cropX: 0.5 }
  const stabilized = safeJoin(mediaRoot(), `${relDir}/stab.mp4`)

  let loop: { start: number; end: number }
  if (options.loopStart !== undefined && options.loopEnd !== undefined) {
    loop = { start: options.loopStart, end: options.loopEnd }
  } else {
    const found = await findLoop(stabilized)
    loop = { start: found.start, end: found.end }
  }

  // Хвост для кроссфейда должен существовать в ролике.
  if (loop.end + 0.4 > probe.duration) loop.end = Math.max(loop.start + 1, probe.duration - 0.4)

  const rotated = probe.rotation === 90 || probe.rotation === 270

  for (const args of buildOutputCommands({
    outDir: dir,
    width: rotated ? probe.height : probe.width,
    height: rotated ? probe.width : probe.height,
    cropX: options.cropX,
    loop,
  })) {
    await runProcess(ffmpeg(), args)
  }

  return {
    mp4: `${relDir}/video.mp4`,
    webm: `${relDir}/video.webm`,
    poster: `${relDir}/poster.webp`,
  }
}

/**
 * Полная обработка: поворот → стабилизация → петля → mp4/webm/постер.
 * Возвращает пути относительно `MEDIA_ROOT`; промежуточные файлы удаляются в любом случае.
 */
export async function processVideo(row: Media): Promise<ProcessedPaths> {
  try {
    return await processVideoSteps(row)
  } finally {
    const dir = safeJoin(mediaRoot(), mediaDir(row))
    await Promise.all(TEMP_FILES.map((name) => rm(`${dir}/${name}`, { force: true })))
  }
}
