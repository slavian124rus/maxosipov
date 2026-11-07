import localFont from 'next/font/local'

/** Oswald 500–600 — цифры, крупные заголовки, словесный знак. */
export const oswald = localFont({
  src: [
    { path: './oswald-cyrillic-wght-normal.woff2', style: 'normal', weight: '200 700' },
    { path: './oswald-latin-wght-normal.woff2', style: 'normal', weight: '200 700' },
  ],
  variable: '--font-display',
  display: 'swap',
})

/** Manrope 400/600 — интерфейс и текст. */
export const manrope = localFont({
  src: [
    { path: './manrope-cyrillic-wght-normal.woff2', style: 'normal', weight: '200 800' },
    { path: './manrope-latin-wght-normal.woff2', style: 'normal', weight: '200 800' },
  ],
  variable: '--font-sans',
  display: 'swap',
})
