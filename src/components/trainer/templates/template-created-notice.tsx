'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Уведомление «Шаблон создан» после редиректа из окна создания.
 *
 * Раньше тост и переход жили в самом окне: при возврате назад страница
 * восстанавливалась с тем же состоянием действия и снова показывала тост и
 * уводила на шаблон. Теперь сообщение приходит один раз по `?created=1`,
 * а параметр сразу убирается из адреса, чтобы возврат и перезагрузка молчали.
 */
export function TemplateCreatedNotice() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    toast.success('Шаблон создан', { description: 'Добавь упражнения в дни' })
    router.replace(pathname)
  }, [pathname, router])

  return null
}
