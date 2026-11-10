import type { ReactNode } from 'react'

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }

export type Inline = { bold: boolean; text: string }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

/** Делит ответ ИИ на абзацы и списки: без внешних библиотек, только то, что нужно чату. */
export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length > 0) blocks.push({ type: 'p', text: paragraph.join('\n') })
    paragraph = []
  }

  for (const line of source.split('\n')) {
    const bullet = BULLET.exec(line)
    const numbered = NUMBERED.exec(line)
    const item = bullet?.[1] ?? numbered?.[1]

    if (item !== undefined) {
      flushParagraph()
      const type = bullet ? 'ul' : 'ol'
      const last = blocks.at(-1)
      if (last && last.type === type) last.items.push(item)
      else blocks.push({ type, items: [item] })
    } else if (line.trim() === '') {
      flushParagraph()
      // пустая строка завершает и список
      const last = blocks.at(-1)
      if (last && last.type !== 'p') blocks.push({ type: 'p', text: '' })
    } else {
      const last = blocks.at(-1)
      if (last && last.type !== 'p') blocks.push({ type: 'p', text: '' })
      paragraph.push(line)
    }
  }
  flushParagraph()

  // Убираем служебные пустые абзацы, оставленные разделителями.
  return blocks.filter((block) => block.type !== 'p' || block.text.trim() !== '')
}

/** Выделяет `**жирное**`; незакрытые звёздочки остаются текстом. */
export function parseInline(source: string): Inline[] {
  const parts: Inline[] = []
  let rest = source

  for (;;) {
    const start = rest.indexOf('**')
    const end = start === -1 ? -1 : rest.indexOf('**', start + 2)
    if (start === -1 || end === -1) break

    if (start > 0) parts.push({ bold: false, text: rest.slice(0, start) })
    parts.push({ bold: true, text: rest.slice(start + 2, end) })
    rest = rest.slice(end + 2)
  }

  if (rest) parts.push({ bold: false, text: rest })
  return parts
}

function renderInline(text: string): ReactNode {
  return parseInline(text).map((part, index) =>
    part.bold ? (
      <strong key={index} className="font-semibold">
        {part.text}
      </strong>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  )
}

/** Ответ МаксИИма: абзацы, списки и жирный текст. */
export function RichText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseBlocks(text).map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {renderInline(block.text)}
            </p>
          )
        }
        const List = block.type === 'ul' ? 'ul' : 'ol'
        return (
          <List
            key={index}
            className={`flex flex-col gap-1 pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
