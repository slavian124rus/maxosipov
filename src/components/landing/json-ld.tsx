import { LANDING } from '../../../content/landing'

export type PostalAddressSchema = {
  '@type': 'PostalAddress'
  addressLocality: string
  streetAddress: string
  addressCountry: string
}

export type PersonSchema = {
  '@context': 'https://schema.org'
  '@type': 'Person'
  name: string
  jobTitle: string
  description: string
  url: string
  telephone?: string
  address: PostalAddressSchema
  worksFor: {
    '@type': 'ExerciseGym'
    name: string
    address: PostalAddressSchema
  }
}

/**
 * Разбирает адрес из `content/landing.ts` («Красноярск, ул. Говорова, 57, Аллея») на город,
 * улицу с номером дома и название зала, если оно есть в строке. Зал без номера в адресе
 * (старый формат «…, зал «Колизей»») тоже разбирается; чего нет в контенте — того нет в разметке.
 */
export function splitAddress(address: string): { locality: string; street: string; gym: string } {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  let street = parts[1] ?? ''
  let rest = parts.slice(2)

  // Номер дома — часть улицы: «ул. Говорова, 57».
  if (rest[0] && /^\d/.test(rest[0])) {
    street = `${street}, ${rest[0]}`
    rest = rest.slice(1)
  }

  const gymPart = rest.find((part) => /зал/i.test(part)) ?? ''

  return {
    locality: parts[0] ?? '',
    street,
    gym: gymPart.replace(/^зал\s*/i, '').replace(/[«»]/g, '').trim(),
  }
}

/** `Person` + `ExerciseGym` (DESIGN.md §10: `LocalBusiness`/`Person`). */
export function buildPersonSchema(options: {
  siteUrl: string
  description: string
  address: string
  phone: string | null
}): PersonSchema {
  const { locality, street, gym } = splitAddress(options.address)

  const address: PostalAddressSchema = {
    '@type': 'PostalAddress',
    addressLocality: locality,
    streetAddress: street,
    addressCountry: 'RU',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Максим Осипов',
    jobTitle: 'Персональный тренер',
    description: options.description,
    url: options.siteUrl,
    ...(options.phone ? { telephone: options.phone } : {}),
    address,
    worksFor: { '@type': 'ExerciseGym', name: gym || 'Колизей', address },
  }
}

/** JSON-LD главной страницы: данные для поисковиков под «персональный тренер Красноярск». */
export function PersonJsonLd({
  siteUrl,
  description,
}: {
  siteUrl: string
  description: string
}) {
  const schema = buildPersonSchema({
    siteUrl,
    description,
    address: LANDING.contacts.address,
    phone: LANDING.contacts.phone,
  })

  return (
    <script
      type="application/ld+json"
      // Разметка собирается из наших же данных, без пользовательского ввода.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
