import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * Строит временные `public/figure/front.svg` и `back.svg` из контуров прототипа
 * (`prototypes/exercise-card/figure.json`). Финальную фигуру по фото Максима
 * делает дизайнер (DESIGN.md §6.2) — здесь только рабочий силуэт.
 *
 * Новые контуры не рисуются: коды, которых нет в прототипе, просто отсутствуют.
 */

type FigureJson = {
  sil: string
  front: [string, string][]
  back: [string, string][]
}

/** Соответствие ключей прототипа кодам мышц (DESIGN.md §6.3). */
const FRONT_MAP: Record<string, string> = {
  'traps-upper': 'traps-upper',
  delts: 'delts-front',
  chest: 'chest',
  biceps: 'biceps',
  forearms: 'forearms-flexors',
  abs: 'abs',
  obliques: 'obliques',
  quads: 'quads',
  adductors: 'adductors',
  calves: 'tibialis',
}

const BACK_MAP: Record<string, string> = {
  traps: 'traps-middle',
  'delts-rear': 'delts-rear',
  lats: 'lats',
  triceps: 'triceps',
  forearms: 'forearms-extensors',
  'lower-back': 'lower-back',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  calves: 'calves',
}

function buildLayers(entries: [string, string][], map: Record<string, string>): string {
  const seen = new Map<string, number>()

  return entries
    .map(([key, path]) => {
      const code = map[key]
      if (!code) return ''

      const count = seen.get(key) ?? 0
      seen.set(key, count + 1)

      const pairIndex = Math.floor(count / 2)
      const side = count % 2 === 0 ? 'l' : 'r'
      const id = pairIndex === 0 ? `m-${code}-${side}` : `m-${code}-${side}-${pairIndex + 1}`

      return `    <path id="${id}" data-muscle="${code}" d="${path}" fill="#3A3A40" stroke="#131316" stroke-width="1.1" />`
    })
    .filter(Boolean)
    .join('\n')
}

function buildSvg(figure: FigureJson, view: 'front' | 'back'): string {
  const map = view === 'front' ? FRONT_MAP : BACK_MAP
  const layers = buildLayers(figure[view], map)

  // Корень резиновый: фигура заполняет контейнер и центрируется (DESIGN.md §6.4).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="22 0 156 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
  <path id="silhouette" d="${figure.sil}" fill="#26262B" />
  <ellipse cx="100" cy="30" rx="15" ry="19" fill="#26262B" />
  <rect x="93" y="44" width="14" height="14" rx="4" fill="#26262B" />
  <g id="muscles">
${layers}
  </g>
</svg>
`
}

function main(): void {
  const figure = JSON.parse(
    readFileSync('prototypes/exercise-card/figure.json', 'utf-8'),
  ) as FigureJson

  mkdirSync('public/figure', { recursive: true })
  writeFileSync('public/figure/front.svg', buildSvg(figure, 'front'), 'utf-8')
  writeFileSync('public/figure/back.svg', buildSvg(figure, 'back'), 'utf-8')

  console.log('Готово: public/figure/front.svg, public/figure/back.svg')
}

main()
