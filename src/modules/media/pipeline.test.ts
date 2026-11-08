import { expect, test } from 'vitest'
import { buildPipelineCommands, floorEven, frameFilter } from './pipeline'

const base = {
  src: '/in/original.mp4',
  outDir: '/out',
  width: 720,
  height: 1280,
  rotation: 0,
  cropX: 0.5,
  loop: { start: 2, end: 9 },
}

function joined(input: Parameters<typeof buildPipelineCommands>[0]): string {
  return buildPipelineCommands(input)
    .map((args) => args.join(' '))
    .join(' | ')
}

test('вертикальное видео: без crop, со scale 720:1280', () => {
  const all = joined(base)
  expect(all).not.toContain('crop=')
  expect(all).toContain('scale=720:1280')
})

test.each([
  [0.5, 'crop=404:720:438:0'],
  [0, 'crop=404:720:0:0'],
  [1, 'crop=404:720:876:0'],
])('горизонтальное 1280×720, cropX=%s → %s', (cropX, expected) => {
  expect(joined({ ...base, width: 1280, height: 720, cropX })).toContain(expected)
})

test.each([90, 180, 270])('rotation %s: один шаг нормализации без ручного поворота', (rotation) => {
  const commands = buildPipelineCommands({ ...base, rotation })
  expect(commands[0]!.at(-1)).toBe('/out/norm.mp4')
  expect(commands[0]).toContain('null')
  expect(joined({ ...base, rotation })).not.toContain('transpose')
  expect(joined({ ...base, rotation })).not.toContain('hflip')
})

test('без поворота нет transpose', () => {
  expect(joined(base)).not.toContain('transpose')
})

test('порядок шагов: стабилизация → петля → mp4 → webm → постер', () => {
  const commands = buildPipelineCommands(base)
  const flat = commands.map((args) => args[args.length - 1])

  expect(flat).toEqual([
    '-',
    '/out/stab.mp4',
    '/out/loop.mp4',
    '/out/video.mp4',
    '/out/video.webm',
    '/out/poster.webp',
  ])
})

test('постер — кадр из середины петли, а не первый рывок', () => {
  const poster = buildPipelineCommands(base).at(-1)!.join(' ')
  expect(poster).toContain('-ss 3.50 -i /out/video.mp4')
  expect(poster).toContain('-frames:v 1')
})

test('webm кодируется в несколько потоков (row-mt, cpu-used)', () => {
  const webm = buildPipelineCommands(base).find((args) => args.at(-1) === '/out/video.webm')!.join(' ')
  expect(webm).toContain('-row-mt 1')
  expect(webm).toContain('-cpu-used 2')
})

test('петля собирается кроссфейдом 0,4 с', () => {
  const loop = buildPipelineCommands(base)[2]!.join(' ')
  expect(loop).toContain('xfade=transition=fade:duration=0.4:offset=0')
  expect(loop).toContain('trim=start=2.400:end=9.000')
})

test('цветокоррекция и yuv420p в выходах', () => {
  const all = joined(base)
  expect(all).toContain('eq=contrast=1.08:saturation=0.86:gamma=0.97')
  expect(all).toContain('format=yuv420p')
})

test('floorEven округляет вниз до чётного', () => {
  expect(floorEven(405)).toBe(404)
  expect(floorEven(404)).toBe(404)
  expect(floorEven(1)).toBe(0)
})

test('frameFilter для квадратного кадра считает его вертикальным', () => {
  expect(frameFilter({ width: 720, height: 720, cropX: 0.5 })).toBe('scale=720:1280')
})
