'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { maskPhone } from '../../login/forms'
import { saveOnboardingAction, type OnboardingState } from '../actions'

const INITIAL_ONBOARDING_STATE: OnboardingState = { error: null, done: false, trialUntil: null }
type Draft = {
  goal: string
  experience: string
  sessionsPerWeek: string
  sex: string
  birthYear: string
  heightCm: string
  weightKg: string
  limitations: string
  healthConsent: boolean
  pdConsent: boolean
  phone: string
}

const INITIAL_DRAFT: Draft = {
  goal: '',
  experience: '',
  sessionsPerWeek: '',
  sex: '',
  birthYear: '',
  heightCm: '',
  weightKg: '',
  limitations: '',
  healthConsent: false,
  pdConsent: false,
  phone: '',
}

const GOALS = [
  { value: 'strength', label: 'Стать сильнее' },
  { value: 'mass', label: 'Набрать массу' },
  { value: 'fat_loss', label: 'Похудеть' },
  { value: 'health', label: 'Здоровье и тонус' },
]

const EXPERIENCE = [
  { value: 'novice', label: 'Новичок' },
  { value: 'intermediate', label: 'Занимаюсь до года' },
  { value: 'advanced', label: 'Больше года' },
]

const TOTAL_STEPS = 7

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

function OptionCard({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 w-full rounded-card border px-4 py-3 text-left text-[17px] transition-colors ${
        selected
          ? 'border-accent bg-surface-2 text-text'
          : 'border-border bg-surface-1 text-text-secondary'
      }`}
    >
      {label}
    </button>
  )
}

function InstallHint({
  isIos,
  installPrompt,
}: {
  isIos: boolean
  installPrompt: BeforeInstallPromptEvent | null
}) {
  if (isIos) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-1 px-4 py-5">
        <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
          <rect x="30" y="4" width="60" height="82" rx="10" fill="#17171A" stroke="#2A2A2F" />
          <path d="M60 26v28M48 40l12-14 12 14" stroke="#F5F5F7" strokeWidth="3" fill="none" />
          <rect x="46" y="66" width="28" height="6" rx="3" fill="#E5322D" />
        </svg>
        <p className="text-center text-[15px] text-text-secondary">
          Поделиться → На экран «Домой»
        </p>
      </div>
    )
  }

  if (!installPrompt) return null

  return (
    <Button variant="secondary" onClick={() => void installPrompt.prompt()}>
      Установить
    </Button>
  )
}

export function OnboardingSteps({ isIos, askPhone }: { isIos: boolean; askPhone: boolean }) {
  const [state, formAction, pending] = useActionState(
    saveOnboardingAction,
    INITIAL_ONBOARDING_STATE,
  )
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (state.done) {
    return (
      <div className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-semibold">
            Пробный месяц активирован{state.trialUntil ? ` до ${state.trialUntil}` : ''}
          </h1>
          <p className="text-[15px] text-text-secondary">
            Установи приложение на экран «Домой» — так оно работает как обычное.
          </p>
        </div>

        <InstallHint isIos={isIos} installPrompt={installPrompt} />

        <Button asChild>
          <Link href="/">Перейти к тренировкам</Link>
        </Button>
      </div>
    )
  }

  const canGoNext = ((): boolean => {
    switch (step) {
      case 0:
        return draft.goal !== ''
      case 1:
        return draft.experience !== ''
      case 2:
        return draft.sessionsPerWeek !== ''
      case 3: {
        const year = Number(draft.birthYear)
        const maxYear = new Date().getFullYear() - 14
        return draft.sex !== '' && Number.isInteger(year) && year >= 1940 && year <= maxYear
      }
      case 4: {
        const height = Number(draft.heightCm)
        const weight = Number(draft.weightKg.replace(',', '.'))
        return height >= 120 && height <= 230 && weight >= 35 && weight <= 250
      }
      case 5:
        return true
      default:
        return draft.pdConsent
    }
  })()

  return (
    <form action={formAction} className="flex min-h-dvh flex-col px-4 py-6">
      <div className="mb-6 h-1 w-full rounded-full bg-surface-2">
        <div
          className="h-1 rounded-full bg-accent transition-all duration-200"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <input type="hidden" name="goal" value={draft.goal} />
      <input type="hidden" name="experience" value={draft.experience} />
      <input type="hidden" name="sessionsPerWeek" value={draft.sessionsPerWeek} />
      <input type="hidden" name="sex" value={draft.sex} />
      <input type="hidden" name="birthYear" value={draft.birthYear} />
      <input type="hidden" name="heightCm" value={draft.heightCm} />
      <input type="hidden" name="weightKg" value={draft.weightKg.replace(',', '.')} />
      <input type="hidden" name="limitations" value={draft.limitations} />
      <input type="hidden" name="healthConsent" value={draft.healthConsent ? 'on' : ''} />
      <input type="hidden" name="pdConsent" value={draft.pdConsent ? 'on' : ''} />
      {askPhone ? <input type="hidden" name="phone" value={draft.phone} /> : null}

      <div className="flex flex-1 flex-col gap-4">
        {step === 0 ? (
          <>
            <h1 className="text-[22px] font-semibold">Какая у тебя цель?</h1>
            {GOALS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={draft.goal === option.value}
                onClick={() => setDraft({ ...draft, goal: option.value })}
              />
            ))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="text-[22px] font-semibold">Какой у тебя опыт?</h1>
            {EXPERIENCE.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={draft.experience === option.value}
                onClick={() => setDraft({ ...draft, experience: option.value })}
              />
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-[22px] font-semibold">Сколько раз в неделю будешь ходить?</h1>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, sessionsPerWeek: String(value) })}
                  className={`h-14 w-14 rounded-card border font-display text-[20px] ${
                    draft.sessionsPerWeek === String(value)
                      ? 'border-accent bg-surface-2 text-text'
                      : 'border-border bg-surface-1 text-text-secondary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-[22px] font-semibold">Немного о тебе</h1>
            <div className="flex gap-3">
              <OptionCard
                label="Мужской"
                selected={draft.sex === 'male'}
                onClick={() => setDraft({ ...draft, sex: 'male' })}
              />
              <OptionCard
                label="Женский"
                selected={draft.sex === 'female'}
                onClick={() => setDraft({ ...draft, sex: 'female' })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="birthYear">Год рождения</Label>
              <Input
                id="birthYear"
                inputMode="numeric"
                value={draft.birthYear}
                onChange={(event) =>
                  setDraft({ ...draft, birthYear: event.target.value.replace(/\D/g, '') })
                }
              />
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 className="text-[22px] font-semibold">Рост и вес</h1>
            <div className="flex flex-col gap-2">
              <Label htmlFor="heightCm">Рост, см</Label>
              <Input
                id="heightCm"
                inputMode="numeric"
                value={draft.heightCm}
                onChange={(event) =>
                  setDraft({ ...draft, heightCm: event.target.value.replace(/\D/g, '') })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weightKg">Вес, кг</Label>
              <Input
                id="weightKg"
                inputMode="decimal"
                value={draft.weightKg}
                onChange={(event) =>
                  setDraft({ ...draft, weightKg: event.target.value.replace(/[^\d.,]/g, '') })
                }
              />
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1 className="text-[22px] font-semibold">Есть ограничения или травмы?</h1>
            <textarea
              value={draft.limitations}
              onChange={(event) => setDraft({ ...draft, limitations: event.target.value })}
              rows={4}
              maxLength={500}
              placeholder="Например: побаливает поясница после становой"
              className="w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-[15px] text-text outline-none focus-visible:border-accent"
            />
            <p className="text-[13px] text-text-muted">
              МаксИИм учтёт это при подборе упражнений. Можно пропустить
            </p>
            <label className="flex items-start gap-3 text-[15px] text-text-secondary">
              <input
                type="checkbox"
                checked={draft.healthConsent}
                onChange={(event) => setDraft({ ...draft, healthConsent: event.target.checked })}
                className="mt-1 h-5 w-5 accent-accent"
              />
              <span>
                Согласен на обработку данных о здоровье (
                <Link href="/legal/health-consent" className="underline">
                  подробнее
                </Link>
                )
              </span>
            </label>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h1 className="text-[22px] font-semibold">Последний шаг</h1>
            {askPhone ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Телефон для связи с тренером (необязательно)</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: maskPhone(event.target.value) })}
                />
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-[15px] text-text-secondary">
              <input
                type="checkbox"
                checked={draft.pdConsent}
                onChange={(event) => setDraft({ ...draft, pdConsent: event.target.checked })}
                className="mt-1 h-5 w-5 accent-accent"
              />
              <span>
                Согласен на обработку персональных данных (
                <Link href="/legal/consent" className="underline">
                  подробнее
                </Link>
                )
              </span>
            </label>
            {state.error ? <p className="text-[15px] text-danger">{state.error}</p> : null}
          </>
        ) : null}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Назад
          </Button>
        ) : null}

        {step < TOTAL_STEPS - 1 ? (
          <Button
            type="button"
            className="flex-1"
            disabled={!canGoNext}
            onClick={() => setStep(step + 1)}
          >
            Дальше
          </Button>
        ) : (
          <Button type="submit" className="flex-1" disabled={!canGoNext || pending}>
            {pending ? 'Сохраняем…' : 'Начать'}
          </Button>
        )}
      </div>
    </form>
  )
}
