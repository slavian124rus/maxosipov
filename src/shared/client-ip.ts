/**
 * IP клиента за нашим Caddy (ревью F7): Caddy дописывает адрес клиента в конец
 * `X-Forwarded-For`, а начало заголовка может прислать сам клиент — берём последний.
 */
export function clientIpFrom(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
