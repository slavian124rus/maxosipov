import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SerwistProvider } from '@serwist/turbopack/react'
import { manrope, oswald } from '@/shared/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Максим Осипов · МаксИИм',
  description: 'Тренировки с Максимом в зале «Колизей», Красноярск',
}

export const viewport: Viewport = {
  themeColor: '#0E0E10',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`dark ${oswald.variable} ${manrope.variable}`}>
      <body className="min-h-dvh bg-bg text-text">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  )
}

