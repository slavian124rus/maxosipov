import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>
}
