const STORAGE_KEY = 'pending-next-weights'

type Pending = { exerciseId: string; weightKg: number }

function read(): Pending[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Pending[]) : []
  } catch {
    return []
  }
}

function write(items: Pending[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // хранилище недоступно — вес не критичен
  }
}

/** Последний принятый вес по упражнению заменяет прежний в очереди. */
export function enqueueNextWeight(item: Pending): void {
  write([...read().filter((entry) => entry.exerciseId !== item.exerciseId), item])
}

async function send(item: Pending): Promise<boolean> {
  try {
    const response = await fetch('/api/training/next-weight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
    })
    return response.ok
  } catch {
    return false
  }
}

/** Сохраняет вес «на следующий раз»; при неудаче (нет сети) кладёт в очередь. */
export async function postNextWeight(item: Pending): Promise<void> {
  if (!(await send(item))) enqueueNextWeight(item)
}

/** Досылает очередь; то, что не ушло, остаётся. */
export async function flushPendingNextWeights(): Promise<void> {
  const items = read()
  if (items.length === 0) return

  const failed: Pending[] = []
  for (const item of items) {
    if (!(await send(item))) failed.push(item)
  }
  write(failed)
}
