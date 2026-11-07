import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { createPkce } from './pkce'

function base64url(input: Buffer): string {
  return input.toString('base64url')
}

test('verifier нужной длины и из допустимых символов', () => {
  const { verifier } = createPkce()
  expect(verifier.length).toBeGreaterThanOrEqual(43)
  expect(verifier.length).toBeLessThanOrEqual(128)
  expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
})

test('challenge = base64url(sha256(verifier))', () => {
  const { verifier, challenge } = createPkce()
  expect(challenge).toBe(base64url(createHash('sha256').update(verifier).digest()))
})

test('каждый вызов даёт новую пару', () => {
  expect(createPkce().verifier).not.toBe(createPkce().verifier)
})
