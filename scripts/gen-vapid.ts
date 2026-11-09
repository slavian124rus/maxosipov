import { generateVAPIDKeys } from 'web-push'

/**
 * Печатает пару ключей VAPID для `.env`. Запуск: `pnpm tsx scripts/gen-vapid.ts`.
 * Ключи не коммитятся; при смене пары все подписки придётся оформить заново.
 */
const keys = generateVAPIDKeys()

console.log('Добавь в .env и на сервер:')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:hello@maxosipov.ru')