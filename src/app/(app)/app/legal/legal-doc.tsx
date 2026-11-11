import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'

/**
 * Юридические тексты лежат в `content/legal/*.md` и предоставляются владельцем.
 * Разметка минимальная: `#` — заголовок, остальное — абзацы.
 */
export async function LegalDoc({ file }: { file: string }) {
  const text = await readFile(path.join(process.cwd(), 'content', 'legal', file), 'utf-8')
  const blocks = text.split('\n').filter((line) => line.trim() !== '')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-3 px-4 py-8">
      <Link href="/" className="text-[15px] text-text-muted underline-offset-4 hover:underline">
        Назад
      </Link>

      {blocks.map((line, index) =>
        line.startsWith('# ') ? (
          <h1 key={index} className="text-[22px] font-semibold">
            {line.slice(2)}
          </h1>
        ) : (
          <p key={index} className="text-[15px] leading-relaxed text-text-secondary">
            {line}
          </p>
        ),
      )}
    </main>
  )
}
