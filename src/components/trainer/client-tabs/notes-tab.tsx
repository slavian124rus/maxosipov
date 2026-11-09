import type { ClientCard } from '@/modules/trainer'
import { addNoteAction } from '@/app/(app)/app/trainer/clients/actions'

function dateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** Вкладка «Заметки»: тренер пишет, галочка решает, увидит ли клиент. */
export function NotesTab({ card }: { card: ClientCard }) {
  return (
    <div className="flex flex-col gap-3">
      {card.notes.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Заметок пока нет</p>
      ) : (
        card.notes.map((note) => (
          <div key={note.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-1 px-3 py-2">
            <p className="text-[15px] text-text">{note.text}</p>
            <p className="text-[13px] text-text-muted">
              {dateRu(note.createdAt)}
              {note.visibleToClient ? ' · клиент видит' : ' · только для тренера'}
            </p>
          </div>
        ))
      )}

      {card.permissions.notes ? (
        <form
          action={addNoteAction}
          className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 px-3 py-3"
        >
          <input type="hidden" name="clientId" value={card.id} />
          <textarea
            name="text"
            rows={3}
            required
            maxLength={2000}
            placeholder="Например: следи за спиной на тяге"
            aria-label="Текст заметки"
            className="rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text"
          />
          <label className="flex items-center gap-2 text-[15px] text-text-secondary">
            <input type="checkbox" name="visible" className="h-5 w-5" />
            Показать клиенту
          </label>
          <button type="submit" className="h-11 rounded-control bg-surface-2 px-3 text-[15px] text-text">
            Сохранить заметку
          </button>
        </form>
      ) : null}
    </div>
  )
}