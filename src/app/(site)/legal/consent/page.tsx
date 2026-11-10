import type { Metadata } from 'next'
import { LegalDoc } from '../../../(app)/app/legal/legal-doc'

// Текст читается с диска при запросе.
export const instant = false

export const metadata: Metadata = {
  title: 'Согласие на обработку персональных данных',
}

/** Тот же документ, что и в приложении: `content/legal/consent.md` (план, задача 4). */
export default function SiteConsentPage() {
  return <LegalDoc file="consent.md" />
}
