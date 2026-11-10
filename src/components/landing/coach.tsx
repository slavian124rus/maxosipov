import { Check } from 'lucide-react'
import { COACH_DEMO, LANDING_UI } from '../../../content/landing'
import { CoachDialog } from './coach-dialog'
import { Reveal } from './reveal'
import { Section } from './section'

type Props = {
  title: string
  text: string
}

/**
 * Блок МаксИИма: слева — что умеет помощник, справа — живая демонстрация: выбираешь вопрос,
 * МаксИИм «печатает» ответ, а предложение по программе можно принять или отклонить.
 */
export function Coach({ title, text }: Props) {
  return (
    <Section
      id="coach"
      eyebrow={LANDING_UI.sections.coach}
      title={title}
      lead={text}
      className="border-y border-border/60 bg-surface-1/40"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[1fr_460px] lg:gap-16">
        <Reveal className="flex flex-col gap-3">
          <ul className="flex flex-col gap-4">
            {LANDING_UI.coach.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[16px] leading-relaxed text-text-secondary md:text-[18px]"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-muscle-primary/40 bg-muscle-primary/10">
                  <Check size={15} strokeWidth={2.25} aria-hidden="true" className="text-muscle-primary" />
                </span>
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="flex w-full min-w-0 justify-center lg:justify-end">
          <CoachDialog
            scenarios={COACH_DEMO}
            avatar={LANDING_UI.coach.avatar}
            avatarNote={LANDING_UI.coach.avatarNote}
            proposal={LANDING_UI.coach.proposal}
            hint={LANDING_UI.coach.demoHint}
            greeting={LANDING_UI.coach.demoGreeting}
            note={LANDING_UI.coach.demoNote}
            typingLabel={LANDING_UI.coach.typing}
            resetLabel={LANDING_UI.coach.reset}
          />
        </Reveal>
      </div>
    </Section>
  )
}
