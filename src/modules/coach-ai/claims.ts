/** Дописывается к ответу, если модель пообещала черновик, а инструмент его не создал. */
export const MISSING_DRAFT_NOTICE =
  'Черновик не создался. Напиши «оформи» — соберу заново.'

const CLAIM_PATTERNS = [
  /(нажми|жми|нажмите)\s*[«"“]?\s*принять/,
  /черновик\s+(уже\s+)?(готов|собран|создан|сформирован)/,
  /(^|[^а-я])собрал(а)?([^а-я]|$)/,
  /(^|[^а-я])оформил(а)?([^а-я]|$)/,
  /предложение\s+(готово|создано)/,
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}

/** Ответ обещает, что изменение уже собрано и ждёт кнопки. */
export function claimsProposal(text: string): boolean {
  const normalized = normalize(text)
  return CLAIM_PATTERNS.some((pattern) => pattern.test(normalized))
}

const PROPOSAL_TOOLS = new Set(['draft_workout', 'propose_program_change'])

/** Хотя бы один инструмент предложения вернул `ok: true`. */
export function proposalWasCreated(results: { toolName: string; output: unknown }[]): boolean {
  return results.some((result) => {
    if (!PROPOSAL_TOOLS.has(result.toolName)) return false
    const output = result.output as { ok?: boolean } | null
    return output?.ok === true
  })
}

/** Нужно ли дописать «Черновик не создался». */
export function needsMissingDraftNotice(
  answer: string,
  results: { toolName: string; output: unknown }[],
): boolean {
  return claimsProposal(answer) && !proposalWasCreated(results)
}
