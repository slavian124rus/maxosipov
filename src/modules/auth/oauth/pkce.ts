import { createHash, randomBytes } from 'node:crypto'

export type Pkce = { verifier: string; challenge: string }

/** PKCE (S256): verifier 43 символа base64url, challenge = base64url(sha256(verifier)). */
export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}
