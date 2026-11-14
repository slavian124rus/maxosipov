// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearRest, readRest, startRest } from '@/lib/rest-store'
import { RestTimer } from './rest-timer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T10:00:00Z'))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('после ухода со страницы и возврата таймер продолжает с того же места', () => {
  startRest('pe-1', 90)
  const first = render(<RestTimer rest={readRest()!} onDone={() => {}} onSkip={() => {}} />)
  act(() => void vi.advanceTimersByTime(20_000))
  expect(screen.getByText('1:10')).toBeTruthy()
  first.unmount() // ушли на другую страницу

  act(() => void vi.setSystemTime(new Date('2026-11-14T10:00:50Z')))
  render(<RestTimer rest={readRest()!} onDone={() => {}} onSkip={() => {}} />)
  expect(screen.getByText('0:40')).toBeTruthy()
})

test('по окончании вызывается onDone', () => {
  startRest('pe-1', 5)
  const onDone = vi.fn()
  render(<RestTimer rest={readRest()!} onDone={onDone} onSkip={() => {}} />)
  act(() => void vi.advanceTimersByTime(5_500))
  expect(onDone).toHaveBeenCalledTimes(1)
})

test('«+30 с» продлевает хранимый отдых', () => {
  startRest('pe-1', 60)
  const { rerender } = render(<RestTimer rest={readRest()!} onDone={() => {}} onSkip={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: '+30 с' }))
  rerender(<RestTimer rest={readRest()!} onDone={() => {}} onSkip={() => {}} />)
  expect(screen.getByText('1:30')).toBeTruthy()
  clearRest()
})
