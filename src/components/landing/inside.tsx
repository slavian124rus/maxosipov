import type { InsideItem } from '../../../content/landing'
import { InsideTabs } from './inside-tabs'
import { Section } from './section'

type Props = {
  eyebrow: string
  title: string
  items: InsideItem[]
  lead: string
  tabsLabel: string
}

/** «Что внутри приложения»: переключаемые экраны с телефоном (интерактив в `InsideTabs`). */
export function Inside({ eyebrow, title, items, lead, tabsLabel }: Props) {
  return (
    <Section id="inside" eyebrow={eyebrow} title={title} lead={lead}>
      <InsideTabs items={items} label={tabsLabel} />
    </Section>
  )
}
