export type HealthStatus = {
  ok: boolean
  db: 'up' | 'down'
}

/**
 * Проверка живости БД с таймаутом: при недоступной базе отвечаем `down`,
 * а не висим. `ping` — любой запрос к БД (`select 1`).
 */
export async function checkHealth(
  ping: () => Promise<void>,
  timeoutMs = 2000,
): Promise<HealthStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const pingPromise = ping()
    // Если победит таймаут, поздняя ошибка ping не должна стать unhandled rejection.
    pingPromise.catch(() => {})

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('health timeout')), timeoutMs)
    })

    await Promise.race([pingPromise, timeoutPromise])
    return { ok: true, db: 'up' }
  } catch {
    return { ok: false, db: 'down' }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
