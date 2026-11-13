import { expect, test } from 'vitest'
import { claimsProposal, needsMissingDraftNotice, proposalWasCreated } from './claims'

test('обещание черновика распознаётся', () => {
  expect(claimsProposal('Собрал: становая убрана. Черновик готов — нажми «Принять».')).toBe(true)
  expect(claimsProposal('Нажми Принять, когда посмотришь.')).toBe(true)
})

test('обычный ответ не считается обещанием', () => {
  expect(claimsProposal('Тяга гантели хорошо заменяет становую. Какой вариант выберешь?')).toBe(false)
})

test('proposalWasCreated смотрит на ok инструмента', () => {
  expect(proposalWasCreated([{ toolName: 'propose_program_change', output: { ok: true } }])).toBe(true)
  expect(proposalWasCreated([{ toolName: 'propose_program_change', output: { ok: false } }])).toBe(false)
  expect(proposalWasCreated([{ toolName: 'find_exercises', output: { ok: true } }])).toBe(false)
})

test('заметка нужна, когда пообещал, а инструмент не сработал', () => {
  expect(needsMissingDraftNotice('Собрал, нажми «Принять»', [])).toBe(true)
  expect(
    needsMissingDraftNotice('Собрал, нажми «Принять»', [
      { toolName: 'draft_workout', output: { ok: true } },
    ]),
  ).toBe(false)
  expect(needsMissingDraftNotice('Привет!', [])).toBe(false)
})
