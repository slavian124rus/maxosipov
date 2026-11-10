import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const SOURCE = 'public/landing/logo.png'
const OUT_DIR = 'public/icons'
const BACKGROUND = '#0E0E10'

/** Иконка `size`×`size`: логотип по центру тёмного фона, занимает `scale` стороны. */
async function icon(size: number, scale: number, file: string): Promise<void> {
  const inner = Math.round(size * scale)
  const logo = await sharp(SOURCE).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${OUT_DIR}/${file}`)
}

/** Иконки PWA из логотипа (`public/landing/logo.png`). Маскабл — с широкими полями под обрезку. */
async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })

  await icon(192, 0.9, 'icon-192.png')
  await icon(512, 0.9, 'icon-512.png')
  await icon(180, 0.9, 'apple-touch-icon.png')
  await icon(512, 0.64, 'maskable-512.png')

  console.log('Иконки PWA собраны в public/icons')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
