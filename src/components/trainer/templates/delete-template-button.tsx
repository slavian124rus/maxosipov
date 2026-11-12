'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { archiveTemplateAction } from '@/app/(app)/app/trainer/programs/actions'

/**
 * Удаление шаблона: он уходит в архив (CLAUDE.md, правило 6).
 * Копии, уже выданные клиентам, и их история остаются — так и написано в подтверждении.
 */
export function DeleteTemplateButton({
  templateId,
  title,
  className,
}: {
  templateId: string
  title: string
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove(): void {
    startTransition(async () => {
      const result = await archiveTemplateAction(templateId)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Шаблон удалён', { description: title })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={`Удалить шаблон «${title}»`}
      >
        <Trash2 size={16} strokeWidth={1.75} aria-hidden />
        Удалить
      </Button>

      <DialogContent className="grid grid-cols-[minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>Удалить «{title}»?</DialogTitle>
          <DialogDescription>
            Шаблон пропадёт из списка. Программы, которые уже выданы клиентам, и их история
            останутся.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
            {pending ? 'Удаляем…' : 'Удалить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
