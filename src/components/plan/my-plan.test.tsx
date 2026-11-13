// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MyPlan, type PlanDay } from './my-plan'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/app/(app)/app/(client)/plan/actions', () => ({ patchMyPlanAction: async () => ({ error: null }) }))

afterEach(cleanup)

const DAYS: PlanDay[] = [
  {
    id: 'd1',
    name: 'День 1 — ноги',
    minutes: 60,
    exercises: [{ id: 'p1', exerciseId: 'e1', name: 'Жим ногами', machineName: null, sets: 3, repMin: 10, repMax: 12, restSec: 90 }],
  },
  {
    id: 'd2',
    name: 'День 2 — спина',
    minutes: 55,
    exercises: [{ id: 'p2', exerciseId: 'e2', name: 'Тяга верхнего блока', machineName: null, sets: 4, repMin: 12, repMax: 15, restSec: 90 }],
  },
]

function renderPlan() {
  return render(<MyPlan programId="pr" programName="Программа" days={DAYS} catalog={[]} history={[]} />)
}

test('день можно свернуть и развернуть: упражнения прячутся вместе с кнопкой добавления', () => {
  renderPlan()
  expect(screen.getByText('Жим ногами')).toBeTruthy()

  const header = screen.getByRole('button', { name: /День 1 — ноги/ })
  expect(header.getAttribute('aria-expanded')).toBe('true')

  fireEvent.click(header)
  expect(screen.queryByText('Жим ногами')).toBeNull()
  expect(header.getAttribute('aria-expanded')).toBe('false')
  // Соседний день не затронут.
  expect(screen.getByText('Тяга верхнего блока')).toBeTruthy()

  fireEvent.click(header)
  expect(screen.getByText('Жим ногами')).toBeTruthy()
})

test('«Свернуть всё» и «Развернуть всё» работают сразу для всех дней', () => {
  renderPlan()

  fireEvent.click(screen.getByRole('button', { name: 'Свернуть всё' }))
  expect(screen.queryByText('Жим ногами')).toBeNull()
  expect(screen.queryByText('Тяга верхнего блока')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Развернуть всё' }))
  expect(screen.getByText('Жим ногами')).toBeTruthy()
  expect(screen.getByText('Тяга верхнего блока')).toBeTruthy()
})
