'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

const surfaceTokens = [
  'bg-bg',
  'bg-surface-1',
  'bg-surface-2',
  'bg-accent',
  'bg-accent-pressed',
  'bg-muscle-primary',
  'bg-muscle-secondary',
  'bg-muscle-idle',
  'bg-silhouette',
  'bg-gold',
  'bg-success',
  'bg-warning',
  'bg-danger',
] as const

const textTokens = [
  'text-text',
  'text-text-secondary',
  'text-text-muted',
  'text-accent',
  'text-gold',
  'text-success',
  'text-warning',
  'text-danger',
] as const

export function UiShowcase() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <h1 className="font-display text-[40px] leading-none font-medium">Витрина UI</h1>
      <p className="text-[15px] text-text-secondary">
        Служебная страница: токены, шрифты и компоненты. В продакшене отдаёт 404.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Фон и акценты</h2>
        <div className="grid grid-cols-3 gap-3">
          {surfaceTokens.map((token) => (
            <div key={token} className="flex flex-col gap-1">
              <div className={cn('h-16 rounded-card border border-border', token)} />
              <span className="text-[13px] text-text-muted">{token.replace('bg-', '')}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Текст</h2>
        <div className="flex flex-col gap-1">
          {textTokens.map((token) => (
            <p key={token} className={cn('text-[15px]', token)}>
              {token} — Максим Осипов, зал «Колизей»
            </p>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Шрифты</h2>
        <p className="font-display text-[56px] leading-none font-medium tabular-nums">120 × 8</p>
        <p className="font-display text-[40px] leading-none font-medium">Заголовок Oswald</p>
        <p className="text-[20px]">Manrope 20 — текст экрана</p>
        <p className="text-[17px]">Manrope 17 — основной текст</p>
        <p className="text-[15px] text-text-secondary">Manrope 15 — подписи</p>
        <p className="text-[13px] text-text-muted">Manrope 13 — подсказки</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Кнопки</h2>
        <Button>Начать тренировку</Button>
        <Button variant="secondary">Свободный режим</Button>
        <Button variant="outline">Изменить</Button>
        <Button variant="ghost">Отмена</Button>
        <Button variant="destructive">Пожаловаться на боль</Button>
        <Button size="sm">Маленькая</Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[22px] font-semibold">Поле</h2>
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" inputMode="tel" placeholder="+7 999 000-00-00" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Карточка</h2>
        <Card>
          <CardHeader>
            <CardTitle>Жим лёжа</CardTitle>
            <CardDescription>3 подхода · 10–12 раз · 60 кг</CardDescription>
          </CardHeader>
          <CardContent className="text-text-secondary">Последний раз — легко</CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Лист снизу</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Открыть лист</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Записать подход</SheetTitle>
              <SheetDescription>Вес и повторения — двумя касаниями</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 pb-6">
              <Input inputMode="decimal" placeholder="60" />
              <Input inputMode="numeric" placeholder="10" />
              <Button>Сохранить</Button>
            </div>
          </SheetContent>
        </Sheet>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold">Прочее</h2>
        <Tabs defaultValue="week">
          <TabsList>
            <TabsTrigger value="week">Неделя</TabsTrigger>
            <TabsTrigger value="month">Месяц</TabsTrigger>
          </TabsList>
          <TabsContent value="week" className="text-text-secondary">
            Тренировок за неделю: 3
          </TabsContent>
          <TabsContent value="month" className="text-text-secondary">
            Тренировок за месяц: 11
          </TabsContent>
        </Tabs>
        <div className="flex items-center gap-3">
          <Switch id="reminder" defaultChecked />
          <Label htmlFor="reminder">Напоминание о тренировке</Label>
        </div>
        <Button variant="outline" onClick={() => toast.success('Готово')}>
          Показать уведомление
        </Button>
      </section>

      <Toaster />
    </div>
  )
}
