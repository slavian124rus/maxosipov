'use client'

import { useState } from 'react'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MuscleFigure } from '@/components/muscle-figure/muscle-figure'
import { cycleMuscle, type MuscleState } from '@/components/muscle-figure/state'
import { VideoCrop } from '@/components/trainer/video-crop'
import { groupMachinesByZone, normalizeQuery } from '@/components/trainer/catalog-tree'
import { Highlight, TreeSearchField } from '@/components/trainer/tree-ui'
import { muscleName, type MuscleCode } from '@/shared/muscles'
import type { Machine } from '@/modules/catalog'

export type MachineChoice = Pick<Machine, 'id' | 'name' | 'zone'>

export type VideoUpload = {
  uploading: boolean
  progress: number
  error: string | null
}

/** Видео упражнения: загрузка и ползунок «где ты в кадре». */
export function VideoPanel({
  upload,
  videoFile,
  videoMediaId,
  cropX,
  onUpload,
  onCropChange,
}: {
  upload: VideoUpload
  videoFile: File | null
  videoMediaId: string | null
  cropX: number
  onUpload: (file: File) => void
  onCropChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-text-secondary">
        Снимай вертикально, весь тренажёр и ты целиком, 2–3 чистых повторения.
      </p>
      <p className="text-[15px] text-text-secondary">
        Видео можно добавить позже: пока его нет, в карточке показывается фото тренажёра.
      </p>

      <label
        htmlFor="exercise-video-file"
        className={`inline-flex min-h-14 cursor-pointer items-center justify-center rounded-card border border-border bg-surface-2 px-4 text-[17px] text-text ${
          upload.uploading ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {videoFile ? 'Выбрать другой файл' : videoMediaId ? 'Заменить видео' : 'Выбрать видео'}
      </label>
      <input
        id="exercise-video-file"
        type="file"
        accept="video/*"
        disabled={upload.uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
        }}
        className="sr-only"
      />
      {videoFile ? <p className="break-all text-[13px] text-text-muted">{videoFile.name}</p> : null}

      {upload.uploading ? (
        <p className="text-[15px] text-text-secondary">Загружаем… {upload.progress}%</p>
      ) : null}
      {upload.error ? <p className="text-[15px] text-danger">{upload.error}</p> : null}
      {videoMediaId && !upload.uploading ? (
        <p className="text-[15px] text-success">
          {videoMediaId === 'existing' ? 'Видео уже загружено' : 'Видео загружено'}
        </p>
      ) : null}

      <VideoCrop file={videoFile} value={cropX} onChange={onCropChange} />
    </div>
  )
}

/** Тренажёр упражнения: список по зонам с поиском. */
export function MachinePanel({
  machines,
  machineId,
  onChange,
}: {
  machines: MachineChoice[]
  machineId: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const needle = normalizeQuery(query)
  const visible = needle
    ? machines.filter(
        (machine) =>
          normalizeQuery(machine.name).includes(needle) ||
          normalizeQuery(machine.zone ?? '').includes(needle),
      )
    : machines
  const groups = groupMachinesByZone(visible)

  return (
    <div className="flex flex-col gap-4">
      <TreeSearchField
        value={query}
        onChange={setQuery}
        placeholder="Тренажёр или зона"
        label="Поиск тренажёра"
      />

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <p className="text-[13px] text-text-muted">
              <Highlight text={group.title} query={query} />
            </p>

            {group.machines.map((machine) => (
              <button
                key={machine.id}
                type="button"
                onClick={() => onChange(machine.id)}
                aria-pressed={machineId === machine.id}
                className={`min-h-14 rounded-card border px-4 py-3 text-left text-[17px] ${
                  machineId === machine.id
                    ? 'border-accent bg-surface-2 text-text'
                    : 'border-border bg-surface-1 text-text-secondary'
                }`}
              >
                <Highlight text={machine.name} query={query} />
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[13px] text-text-muted">
        {groups.length === 0
          ? 'Такого тренажёра нет — добавь его в разделе «Тренажёры».'
          : 'Новый тренажёр добавляется в разделе «Тренажёры».'}
      </p>
    </div>
  )
}

/** Мышцы упражнения: фигура с касаниями и профиль подсветки на видео. */
export function MusclesPanel({
  muscles,
  onChange,
  overlayProfile,
  onOverlayChange,
}: {
  muscles: MuscleState
  onChange: (state: MuscleState) => void
  overlayProfile: string
  onOverlayChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <MuscleFigure
        primary={muscles.primary}
        secondary={muscles.secondary}
        onMuscleTap={(code: MuscleCode) => onChange(cycleMuscle(muscles, code))}
        size="md"
      />
      <p className="text-[13px] text-text-muted">
        Одно касание — основная, второе — помогает, третье — убрать
      </p>
      <div className="flex flex-col gap-1 text-[15px] text-text-secondary">
        <p>Основные: {muscles.primary.map(muscleName).join(', ') || 'нет'}</p>
        <p>Помогают: {muscles.secondary.map(muscleName).join(', ') || 'нет'}</p>
      </div>

      <label className="flex flex-col gap-2 text-[15px] text-text-secondary">
        Подсветка на видео
        <select
          value={overlayProfile}
          onChange={(event) => onOverlayChange(event.target.value)}
          className="h-12 rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text"
        >
          <option value="none">Нет</option>
          <option value="pull_vertical">Тяга сверху</option>
          <option value="pull_horizontal">Тяга горизонтальная</option>
        </select>
      </label>
    </div>
  )
}

/** Описание упражнения: название, повторения, шаги, ошибки, совет и черновик МаксИИма. */
export function TextPanel({
  name,
  onName,
  repMin,
  repMax,
  onRepMin,
  onRepMax,
  steps,
  onSteps,
  mistakes,
  onMistakes,
  tips,
  onTips,
  onDraft,
  drafting,
  draftError,
}: {
  name: string
  onName: (value: string) => void
  repMin: string
  repMax: string
  onRepMin: (value: string) => void
  onRepMax: (value: string) => void
  steps: string[]
  onSteps: (items: string[]) => void
  mistakes: string[]
  onMistakes: (items: string[]) => void
  tips: string
  onTips: (value: string) => void
  onDraft: () => void
  drafting: boolean
  draftError: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Название</Label>
        <Input id="name" value={name} onChange={(event) => onName(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          disabled={drafting || name.trim().length < 2}
          onClick={onDraft}
        >
          {drafting ? 'МаксИИм пишет…' : 'Черновик от МаксИИма'}
        </Button>
        {draftError ? <p className="text-[13px] text-danger">{draftError}</p> : null}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="repMin">Повторений от</Label>
          <Input
            id="repMin"
            inputMode="numeric"
            value={repMin}
            onChange={(event) => onRepMin(event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="repMax">до</Label>
          <Input
            id="repMax"
            inputMode="numeric"
            value={repMax}
            onChange={(event) => onRepMax(event.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      <ListEditor
        title="Как делать"
        items={steps}
        onChange={onSteps}
        placeholder="Сядь и зафиксируй колени"
      />
      <ListEditor
        title="Частые ошибки"
        items={mistakes}
        onChange={onMistakes}
        placeholder="Рывки корпусом"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="tips">Совет</Label>
        <textarea
          id="tips"
          value={tips}
          onChange={(event) => onTips(event.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-[15px] text-text outline-none focus-visible:border-accent"
        />
      </div>
    </div>
  )
}

/**
 * Список строк «Как делать» и «Частые ошибки» (DESIGN.md §8.9).
 *
 * Пункт открывается в окне с многострочным полем: шаг — это предложение на 140 символов,
 * в однострочном поле его не видно целиком и неудобно править, особенно на телефоне.
 * В списке видна первая строка пункта, рядом — «Удалить».
 */
export function ListEditor({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function open(index: number): void {
    setDraft(items[index] ?? '')
    setEditing(index)
  }

  function save(): void {
    if (editing === null) return

    const next = [...items]
    next[editing] = draft.trim()
    onChange(next)
    setEditing(null)
  }

  function add(): void {
    onChange([...items, ''])
    // Сразу открываем окно — новый пункт всё равно нужно заполнить.
    setDraft('')
    setEditing(items.length)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>

      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-stretch gap-1 rounded-control border border-border bg-surface-1"
        >
          <button
            type="button"
            onClick={() => open(index)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
          >
            <span className="font-display text-[16px] leading-none text-accent">{index + 1}</span>
            <span
              className={`min-w-0 flex-1 truncate text-[15px] ${
                item.trim() ? 'text-text' : 'text-text-muted'
              }`}
            >
              {item.trim() || placeholder}
            </span>
            <ChevronRight
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="shrink-0 text-text-muted"
            />
          </button>

          <button
            type="button"
            onClick={() => onChange(items.filter((_, position) => position !== index))}
            aria-label={`Удалить пункт ${index + 1}`}
            className="flex w-11 shrink-0 items-center justify-center text-text-muted hover:text-danger"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-fit">
        <Plus size={16} strokeWidth={1.75} aria-hidden />
        Добавить
      </Button>

      <Dialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
      >
        <DialogContent className="grid max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>
              {title}: пункт {(editing ?? 0) + 1}
            </DialogTitle>
            <DialogDescription>
              Видно весь текст целиком. Короткие пункты читаются на телефоне лучше — до 140
              символов
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              maxLength={300}
              autoFocus
              placeholder={placeholder}
              aria-label={`Текст пункта ${(editing ?? 0) + 1}`}
              className="w-full rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text outline-none focus-visible:border-accent"
            />
            <p className="text-right tabular-nums text-[12px] text-text-muted">
              {draft.trim().length} / 140
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={save}>
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

