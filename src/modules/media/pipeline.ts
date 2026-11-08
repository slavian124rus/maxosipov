/** Единый стиль видео (Global Constraints этапа 2). */
const COLOR =
  'eq=contrast=1.08:saturation=0.86:gamma=0.97,curves=master=0/0.03 0.5/0.47 1/0.97,vignette=PI/5'

export const TARGET_WIDTH = 720
export const TARGET_HEIGHT = 1280
const CROSSFADE = 0.4

export type PipelineInput = {
  src: string
  outDir: string
  width: number
  height: number
  rotation: number
  cropX: number
  loop: { start: number; end: number }
}

/** Наибольшее чётное ≤ n: H.264 требует чётных размеров. */
export function floorEven(value: number): number {
  return Math.floor(value / 2) * 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Фильтр кадра 9:16: вертикальное — только scale, горизонтальное — crop по центру cropX. */
export function frameFilter(input: { width: number; height: number; cropX: number }): string {
  if (input.height >= input.width) {
    return `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}`
  }

  const cropWidth = floorEven((input.height * 9) / 16)
  const x = floorEven(clamp(input.cropX * input.width - cropWidth / 2, 0, input.width - cropWidth))
  return `crop=${cropWidth}:${input.height}:${x}:0,scale=${TARGET_WIDTH}:${TARGET_HEIGHT}`
}

/** Поворот по тегу и стабилизация: результат — `<outDir>/stab.mp4`. */
export function buildPrepCommands(input: {
  src: string
  outDir: string
  rotation: number
}): string[][] {
  const { src, outDir, rotation } = input
  const commands: string[][] = []

  let current = src

  if (rotation === 90 || rotation === 180 || rotation === 270) {
    const filter = rotation === 90 ? 'transpose=1' : rotation === 270 ? 'transpose=2' : 'hflip,vflip'
    const normalized = `${outDir}/norm.mp4`
    commands.push([
      '-y',
      '-i',
      src,
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '16',
      '-an',
      normalized,
    ])
    current = normalized
  }

  const trf = `${outDir}/stab.trf`
  const stabilized = `${outDir}/stab.mp4`

  commands.push([
    '-y',
    '-i',
    current,
    '-vf',
    `vidstabdetect=shakiness=6:accuracy=15:result=${trf}`,
    '-f',
    'null',
    '-',
  ])

  commands.push([
    '-y',
    '-i',
    current,
    '-vf',
    `vidstabtransform=input=${trf}:smoothing=40:zoom=4:optzoom=0,unsharp=5:5:0.6`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '16',
    '-an',
    stabilized,
  ])

  return commands
}

/** Петля и выходные файлы: mp4, webm, постер. Вход — `<outDir>/stab.mp4`. */
export function buildOutputCommands(input: {
  outDir: string
  width: number
  height: number
  cropX: number
  loop: { start: number; end: number }
}): string[][] {
  const { outDir, loop } = input
  const start = loop.start
  const end = loop.end
  const stabilized = `${outDir}/stab.mp4`
  const looped = `${outDir}/loop.mp4`

  // Хвост [e, e+0.4] перетекает в голову [s, s+0.4]: на стыке цикла нет рывка.
  const filterComplex = [
    `[0:v]trim=start=${(start + CROSSFADE).toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[main]`,
    `[0:v]trim=start=${start.toFixed(3)}:end=${(start + CROSSFADE).toFixed(3)},setpts=PTS-STARTPTS[head]`,
    `[0:v]trim=start=${end.toFixed(3)}:end=${(end + CROSSFADE).toFixed(3)},setpts=PTS-STARTPTS[tail]`,
    `[tail][head]xfade=transition=fade:duration=${CROSSFADE}:offset=0[blend]`,
    `[blend][main]concat=n=2:v=1:a=0[out]`,
  ].join(';')

  const frame = `${frameFilter(input)},${COLOR},format=yuv420p`

  return [
    [
      '-y',
      '-i',
      stabilized,
      '-filter_complex',
      filterComplex,
      '-map',
      '[out]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '16',
      '-an',
      looped,
    ],
    [
      '-y',
      '-i',
      looped,
      '-vf',
      frame,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '25',
      '-movflags',
      '+faststart',
      '-an',
      `${outDir}/video.mp4`,
    ],
    [
      '-y',
      '-i',
      looped,
      '-vf',
      frame,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '36',
      '-b:v',
      '0',
      '-an',
      `${outDir}/video.webm`,
    ],
    [
      '-y',
      '-i',
      `${outDir}/video.mp4`,
      '-vf',
      'select=eq(n\\,3)',
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      `${outDir}/poster.webp`,
    ],
  ]
}

/** Все шаги обработки по порядку (чистая функция, без запуска ffmpeg). */
export function buildPipelineCommands(input: PipelineInput): string[][] {
  return [...buildPrepCommands(input), ...buildOutputCommands(input)]
}
