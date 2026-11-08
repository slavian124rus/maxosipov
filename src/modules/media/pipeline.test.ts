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

test('rotation 90 добавляет transpose=1', () => {
  expect(joined({ ...base, rotation: 90 })).toContain('transpose=1')
})

test('rotation 270 добавляет transpose=2, 180 — переворот', () => {
  expect(joined({ ...base, rotation: 270 })).toContain('transpose=2')
  expect(joined({ ...base, rotation: 180 })).toContain('hflip,vflip')
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

test('постер — кадр №3', () => {
  const poster = buildPipelineCommands(base).at(-1)!.join(' ')
  expect(poster).toContain('select=eq(n\\,3)')
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
