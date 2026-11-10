import { Check } from 'lucide-react'
import type { DialogLine } from '../../../content/landing'
import { LANDING_UI } from '../../../content/landing'
import { CoachDialog } from './coach-dialog'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  title: string
  text: string
  dialog: DialogLine[]
}

/**
 * Блок МаксИИма (DESIGN.md §10.3): слева — что умеет помощник, справа — живой
 * пример диалога с карточкой предложения. Реплики появляются по очереди.
 */
export function Coach({ title, text, dialog }: Props) {
  return (
    <Section
      id="coach"
      eyebrow={LANDING_UI.sections.coach}
      title={title}
      lead={text}
      className="border-y border-border/60 bg-surface-1/40"
    >
      <div className="grid items-start gap-10 md:grid-cols-[1fr_auto] md:gap-16">
        <Reveal className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {LANDING_UI.coach.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] leading-relaxed text-text-secondary md:text-[17px]">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-muscle-primary/40 bg-muscle-primary/10">
                  <Check size={14} strokeWidth={2.25} aria-hidden="true" className="text-muscle-primary" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="flex w-full justify-center md:justify-end">
          <CoachDialog
            dialog={dialog}
            avatar={LANDING_UI.coach.avatar}
            avatarNote={LANDING_UI.coach.avatarNote}
            proposal={LANDING_UI.coach.proposal}
          />
        </Reveal>
      </div>
    </Section>
  )
}
