type Saved = { role: string; content: string }

/**
 * Телефон заблокировали посреди ответа: поток оборвался, но сервер дописал ответ и сохранил его.
 * Опрашиваем сохранённые сообщения, пока после нашего вопроса не появится ответ.
 */
export async function recoverReply(
  load: () => Promise<Saved[] | null>,
  userText: string,
  options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | null> {
  const attempts = options.attempts ?? 20
  const delayMs = options.delayMs ?? 2000
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const messages = await load()
      if (messages) {
        let lastUser = -1
        messages.forEach((item, index) => {
          if (item.role === 'user' && item.content === userText) lastUser = index
        })
        const reply = lastUser >= 0 ? messages.slice(lastUser + 1).find((item) => item.role === 'assistant') : null
        if (reply?.content) return reply.content
      }
    } catch {
      // Сети ещё нет — попробуем в следующий раз.
    }
    if (attempt < attempts - 1) await sleep(delayMs)
  }
  return null
}
