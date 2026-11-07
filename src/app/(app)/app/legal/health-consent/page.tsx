import { LegalDoc } from '../legal-doc'

// Текст читается с диска при запросе.
export const instant = false

export default function HealthConsentPage() {
  return <LegalDoc file="health-consent.md" />
}
