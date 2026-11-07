import { LegalDoc } from '../legal-doc'

// Текст читается с диска при запросе.
export const instant = false

export default function PrivacyPage() {
  return <LegalDoc file="privacy.md" />
}
