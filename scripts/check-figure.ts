import { readFileSync } from 'node:fs'
import { MUSCLES } from '../src/modules/catalog/muscles'

/** Печатает, каких кодов мышц нет в SVG-фигурах (DESIGN.md §6.3). */
function codesInFile(path: string): Set<string> {
  const svg = readFileSync(path, 'utf-8')
  const codes = new Set<string>()
  for (const match of svg.matchAll(/data-muscle="([^"]+)"/g)) {
    if (match[1]) codes.add(match[1])
  }
  return codes
}

function main(): void {
  const views = [
    { view: 'front' as const, path: 'public/figure/front.svg' },
    { view: 'back' as const, path: 'public/figure/back.svg' },
  ]

  let missingTotal = 0

  for (const { view, path } of views) {
    const present = codesInFile(path)
    const expected = MUSCLES.filter((muscle) => muscle.view === view).map((muscle) => muscle.code)
    const missing = expected.filter((code) => !present.has(code))

    missingTotal += missing.length

    console.log(`${view}: есть ${expected.length - missing.length} из ${expected.length}`)
    if (missing.length > 0) console.log(`  нет: ${missing.join(', ')}`)
  }

  console.log(`Всего отсутствует кодов: ${missingTotal} (контуры рисует дизайнер, DESIGN.md §6.2)`)
}

main()
