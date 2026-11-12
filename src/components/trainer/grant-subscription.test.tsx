// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { GrantSubscription, formatDateInput } from './grant-subscription'

// Серверное действие подменяем: важно, что именно уходит в форму и что показываем после.
const grant = vi.hoisted(() => ({ calls: [] as { months: string; until: string }[] }))

vi.mock('@/app/(app)/app/trainer/subscriptions/actions', () => ({
  grantSubscriptionAction: async (_prev: unknown, formData: FormData) => {
    grant.calls.push({
      months: String(formData.get('months') ?? ''),
      until: String(formData.get('untilDate') ?? ''),
    })

    return { error: null, untilLabel: 'Выдано до 5 января 2027', months: 1 }
  },
}))

// Диалог Radix в jsdom не открывается — подменяем простым условием по open.
const dialog = vi.hoisted(() => ({ open: false }))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
    dialog.open = Boolean(open)
    return <div>{children}</div>
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialog.open ? <div role="dialog">{children}</div> : null,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const OPTIONS = [
  { months: 1 as const, label: '+1 мес', untilLabel: '5 января 2027' },
  { months: 3 as const, label: '+3 мес', untilLabel: '5 марта 2027' },
]

afterEach(() => {
  cleanup()
  grant.calls = []
  dialog.open = false
})

function setup(props: Partial<Parameters<typeof GrantSubscription>[0]> = {}) {
  return render(
    <GrantSubscription
      clientId="client-1"
      clientName="Иван Петров"
      currentLabel="сейчас до 5 декабря 2026"
      options={OPTIONS}
      {...props}
    />,
  )
}

test('кнопка продления сначала спрашивает подтверждение с точной датой', async () => {
  setup()

  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '+1 мес' }))

  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  expect(screen.getByText('Продлить подписку?')).toBeTruthy()
  // В подтверждении видно, кто и до какой даты.
  expect(screen.getByText(/Иван Петров · сейчас до 5 декабря 2026 → до 5 января 2027/)).toBeTruthy()
  expect(screen.getByText(/Доступ продлится на 1 месяц и будет действовать до 5 января 2027/)).toBeTruthy()

  // Пока не подтвердили — в действие ничего не ушло.
  expect(grant.calls).toHaveLength(0)
})

test('«Отмена» закрывает подтверждение и ничего не продлевает', async () => {
  setup()

  fireEvent.click(screen.getByRole('button', { name: '+3 мес' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(grant.calls).toHaveLength(0)
})

test('«Да, продлить» отправляет месяцы и показывает «Выдано до …»', async () => {
  setup()

  fireEvent.click(screen.getByRole('button', { name: '+1 мес' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Да, продлить' }))

  const status = await screen.findByRole('status')
  expect(status.textContent).toContain('Выдано до 5 января 2027')
  expect(status.textContent).toContain('Подписка продлена на 1 месяц')

  expect(grant.calls).toEqual([{ months: '1', until: '' }])
})

test('выдача до даты: подтверждение и отправка выбранного дня', async () => {
  setup({ withUntilDate: true })

  fireEvent.change(screen.getByLabelText('До даты'), { target: { value: '2027-02-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Выдать' }))

  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  expect(screen.getByText(/Доступ будет действовать до 1 февраля 2027/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Да, продлить' }))
  await waitFor(() => expect(grant.calls).toHaveLength(1))
  expect(grant.calls[0]).toEqual({ months: '', until: '2027-02-01' })
})

test('«Выдать» неактивна, пока дата не выбрана', () => {
  setup({ withUntilDate: true })

  expect(screen.getByRole('button', { name: 'Выдать' }).hasAttribute('disabled')).toBe(true)
})

test('formatDateInput: дата из поля → «1 февраля 2027»', () => {
  expect(formatDateInput('2027-02-01')).toBe('1 февраля 2027')
  expect(formatDateInput('')).toBe('')
})
