import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const SOURCE = 'public/icons/icon.svg'
const OUT_DIR = 'public/icons'
const BACKGROUND = '#0E0E10'

/** Иконки PWA из одного SVG. Маскабл — с полями 10%. */
async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })

  await sharp(SOURCE).resize(192, 192).png().toFile(`${OUT_DIR}/icon-192.png`)
  await sharp(SOURCE).resize(512, 512).png().toFile(`${OUT_DIR}/icon-512.png`)
  await sharp(SOURCE).resize(180, 180).png().toFile(`${OUT_DIR}/apple-touch-icon.png`)

  const inner = await sharp(SOURCE).resize(410, 410).png().toBuffer()
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(`${OUT_DIR}/maskable-512.png`)

  console.log('Иконки PWA собраны в public/icons')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
