import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Возврат с вложенного экрана клиента (DESIGN.md §8.1): стрелка и понятная подпись,
 * куда именно возвращаемся — «К тренировкам», «К прогрессу».
 *
 * Раньше на этих экранах стоял серый текст «Назад» без стрелки: не было видно ни что
 * это ссылка, ни куда она ведёт. Размер 44 px по высоте — палец попадает без прицела.
 */
export function ClientBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 flex min-h-11 w-fit items-center gap-1.5 rounded-control px-2 text-[15px] text-text-secondary hover:bg-surface-2/60 hover:text-text"
    >
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
      {label}
    </Link>
  )
}
