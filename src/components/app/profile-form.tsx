'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfileAction, type ProfileFormState } from '@/app/(app)/app/(client)/actions'

const INITIAL: ProfileFormState = { error: null, saved: false }

const GOALS = [
  { value: 'strength', label: 'Сила' },
  { value: 'mass', label: 'Масса' },
  { value: 'fat_loss', label: 'Похудение' },
  { value: 'health', label: 'Здоровье' },
] as const

const EXPERIENCE = [
  { value: 'novice', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Опытный' },
] as const

const SEX = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
] as const

export type ProfileFormProfile = {
  sex: string
  birthYear: number
  heightCm: number
  weightKg: number
  goal: string
  experience: string
  sessionsPerWeek: number
  limitations: string | null
  /** Дано ли согласие на обработку данных о здоровье (от него зависят ограничения). */
  healthConsent: boolean
} | null

const selectClass =
  'h-12 w-full rounded-control border border-border bg-surface-1 px-3 text-[15px] text-text outline-none focus-visible:border-accent'

/**
 * Профиль клиента (DESIGN.md §8.1): имя и анкета. Имя видит тренер в кабинете,
 * поэтому его можно поправить в любой момент — в том числе если при регистрации
 * человек записался «без имени».
 */
export function ProfileForm({ name, profile }: { name: string; profile: ProfileFormProfile }) {
  const [state, formAction, pending] = useActionState(saveProfileAction, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Имя</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={name}
          placeholder="Как тебя зовут"
          autoComplete="name"
          required
          minLength={2}
          maxLength={60}
        />
        <p className="text-[13px] text-text-muted">
          Так тебя видит Максим в кабинете и МаксИИм в чате
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 px-4 py-4">
        <p className="text-[15px] text-text">Анкета</p>
        <p className="-mt-2 text-[13px] text-text-muted">
          Заполни — и Максим точнее посчитает нагрузку. Можно сохранить только имя
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px] text-text-muted">
            Пол
            <select name="sex" defaultValue={profile?.sex ?? 'male'} className={selectClass}>
              {SEX.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-birth" className="text-[13px] text-text-muted">
              Год рождения
            </Label>
            <Input
              id="profile-birth"
              name="birthYear"
              inputMode="numeric"
              defaultValue={profile?.birthYear ?? ''}
              placeholder="1995"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-height" className="text-[13px] text-text-muted">
              Рост, см
            </Label>
            <Input
              id="profile-height"
              name="heightCm"
              inputMode="numeric"
              defaultValue={profile?.heightCm ?? ''}
              placeholder="180"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-weight" className="text-[13px] text-text-muted">
              Вес, кг
            </Label>
            <Input
              id="profile-weight"
              name="weightKg"
              inputMode="decimal"
              defaultValue={profile ? String(profile.weightKg).replace('.', ',') : ''}
              placeholder="82,5"
            />
          </div>

          <label className="flex flex-col gap-2 text-[13px] text-text-muted">
            Цель
            <select name="goal" defaultValue={profile?.goal ?? 'health'} className={selectClass}>
              {GOALS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-[13px] text-text-muted">
            Опыт
            <select
              name="experience"
              defaultValue={profile?.experience ?? 'novice'}
              className={selectClass}
            >
              {EXPERIENCE.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-sessions" className="text-[13px] text-text-muted">
              Тренировок в неделю
            </Label>
            <Input
              id="profile-sessions"
              name="sessionsPerWeek"
              inputMode="numeric"
              defaultValue={profile?.sessionsPerWeek ?? 3}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-limitations" className="text-[13px] text-text-muted">
            Ограничения по здоровью
          </Label>
          <textarea
            id="profile-limitations"
            name="limitations"
            rows={2}
            maxLength={500}
            defaultValue={profile?.limitations ?? ''}
            placeholder="Например: побаливает поясница"
            className="rounded-control border border-border bg-bg px-3 py-2 text-[15px] text-text"
          />
          <label className="flex items-start gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              name="healthConsent"
              defaultChecked={profile?.healthConsent ?? false}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Согласен на обработку данных о здоровье — иначе ограничения не сохраняются.
              Подробнее в{' '}
              <a
                href="/legal/health-consent"
                className="text-accent underline-offset-4 hover:underline"
              >
                согласии
              </a>
            </span>
          </label>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-[15px] text-danger">
          {state.error}
        </p>
      ) : state.saved ? (
        <p role="status" className="text-[15px] text-success">
          Сохранено
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </Button>
    </form>
  )
}