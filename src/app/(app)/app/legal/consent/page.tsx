import { LegalDoc } from '../legal-doc'

// Текст читается с диска при запросе.
export const instant = false

export default function ConsentPage() {
  return <LegalDoc file="consent.md" />
}
