/**
 * Дерево каталога для кабинета тренера: зона → тренажёр → упражнение.
 * Чистые функции без React — их покрывают тесты (`catalog-tree.test.ts`).
 */

/** Особые ветки: упражнения без тренажёра и тренажёры без заполненной зоны. */
export const NO_MACHINE_KEY = 'no-machine'
export const NO_ZONE_KEY = 'no-zone'
export const NO_MACHINE_TITLE = 'Без тренажёра'
export const NO_ZONE_TITLE = 'Без зоны'

export type ExerciseTreeItem = {
  id: string
  name: string
  status: 'draft' | 'published'
  machineId: string | null
  machineName: string | null
  machineZone: string | null
  /** Названия мышц по-русски — поиск работает и по ним. */
  muscles: string[]
  videoLabel: string
  hasMuscles: boolean
}

export type MachineBranch = {
  key: string
  title: string
  /** В ветке «Без тренажёра» уровень тренажёра не рисуем — упражнения висят прямо на зоне. */
  exercises: ExerciseTreeItem[]
}

export type ZoneBranch = {
  key: string
  title: string
  /** Особые ветки всегда в конце списка зон. */
  pinned: boolean
  machines: MachineBranch[]
  count: number
}

export type MachineTreeItem = {
  id: string
  name: string
  zone: string | null
  weightStepKg: number
  /** Сколько опубликованных упражнений на тренажёре. */
  exerciseCount: number
}

export type MachineZoneBranch = {
  key: string
  title: string
  pinned: boolean
  machines: MachineTreeItem[]
  count: number
}

export type MatchPart = { text: string; hit: boolean }

/** Приводим к нижнему регистру и заменяем «ё» на «е» — как в поиске каталога клиента. */
export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}

function compareRu(a: string, b: string): number {
  return a.localeCompare(b, 'ru')
}

/** Ключ и заголовок ветки зоны. Пустая зона у тренажёра — «Без зоны». */
function zoneOf(zone: string | null): { key: string; title: string; pinned: boolean } {
  const title = zone?.trim()
  if (!title) return { key: NO_ZONE_KEY, title: NO_ZONE_TITLE, pinned: true }

  return { key: normalizeQuery(title), title, pinned: false }
}

/** Дерево упражнений: зоны по алфавиту (особые — в конце), тренажёры по алфавиту. */
export function buildExerciseTree(items: ExerciseTreeItem[]): ZoneBranch[] {
  const zones = new Map<string, ZoneBranch & { byMachine: Map<string, MachineBranch> }>()

  for (const item of items) {
    const withoutMachine = item.machineId === null
    const zone = withoutMachine
      ? { key: NO_MACHINE_KEY, title: NO_MACHINE_TITLE, pinned: true }
      : zoneOf(item.machineZone)

    let branch = zones.get(zone.key)
    if (!branch) {
      branch = { ...zone, machines: [], count: 0, byMachine: new Map() }
      zones.set(zone.key, branch)
    }

    const machineKey = withoutMachine ? NO_MACHINE_KEY : (item.machineId ?? NO_MACHINE_KEY)
    const machineTitle = withoutMachine ? NO_MACHINE_TITLE : (item.machineName ?? NO_ZONE_TITLE)

    let machine = branch.byMachine.get(machineKey)
    if (!machine) {
      machine = { key: machineKey, title: machineTitle, exercises: [] }
      branch.byMachine.set(machineKey, machine)
      branch.machines.push(machine)
    }

    machine.exercises.push(item)
    branch.count += 1
  }

  return [...zones.values()]
    .map((zone) => ({
      key: zone.key,
      title: zone.title,
      pinned: zone.pinned,
      count: zone.count,
      machines: [...zone.machines].sort((a, b) => compareRu(a.title, b.title)),
    }))
    .sort((a, b) => Number(a.pinned) - Number(b.pinned) || compareRu(a.title, b.title))
}

/** Упражнение подходит под поиск: имя, тренажёр или одна из мышц. */
export function exerciseMatches(item: ExerciseTreeItem, needle: string): boolean {
  if (normalizeQuery(item.name).includes(needle)) return true
  if (item.machineName && normalizeQuery(item.machineName).includes(needle)) return true
  return item.muscles.some((muscle) => normalizeQuery(muscle).includes(needle))
}

/**
 * Обрезает дерево до совпадений. Совпала зона — показываем её целиком,
 * совпал тренажёр — все его упражнения; иначе только подходящие упражнения.
 */
export function filterExerciseTree(zones: ZoneBranch[], query: string): ZoneBranch[] {
  const needle = normalizeQuery(query)
  if (!needle) return zones

  const result: ZoneBranch[] = []

  for (const zone of zones) {
    const zoneHit = normalizeQuery(zone.title).includes(needle)
    const machines: MachineBranch[] = []

    for (const machine of zone.machines) {
      const branchHit = zoneHit || normalizeQuery(machine.title).includes(needle)
      const exercises = branchHit
        ? machine.exercises
        : machine.exercises.filter((item) => exerciseMatches(item, needle))

      if (exercises.length > 0) machines.push({ ...machine, exercises })
    }

    if (machines.length > 0) {
      const count = machines.reduce((sum, machine) => sum + machine.exercises.length, 0)
      result.push({ ...zone, machines, count })
    }
  }

  return result
}

/** Сколько упражнений в дереве — для подписи «Найдено: N». */
export function countTreeExercises(zones: ZoneBranch[]): number {
  return zones.reduce((sum, zone) => sum + zone.count, 0)
}

/** Ветка «что-то → зона»: одна группировка на дерево тренажёров и на выбор тренажёра в мастере. */
export type ZoneGroup<T> = {
  key: string
  title: string
  pinned: boolean
  machines: T[]
}

/** Группирует по зоне: зоны по алфавиту, «Без зоны» в конце, внутри — по названию. */
export function groupMachinesByZone<T extends { name: string; zone: string | null }>(
  items: T[],
): ZoneGroup<T>[] {
  const zones = new Map<string, ZoneGroup<T>>()

  for (const item of items) {
    const zone = zoneOf(item.zone)

    let branch = zones.get(zone.key)
    if (!branch) {
      branch = { ...zone, machines: [] }
      zones.set(zone.key, branch)
    }

    branch.machines.push(item)
  }

  return [...zones.values()]
    .map((zone) => ({
      ...zone,
      machines: [...zone.machines].sort((a, b) => compareRu(a.name, b.name)),
    }))
    .sort((a, b) => Number(a.pinned) - Number(b.pinned) || compareRu(a.title, b.title))
}

/** Дерево тренажёров для экрана «Тренажёры»: зона → тренажёр. */
export function buildMachineTree(machines: MachineTreeItem[]): MachineZoneBranch[] {
  return groupMachinesByZone(machines).map((zone) => ({
    ...zone,
    count: zone.machines.reduce((sum, machine) => sum + machine.exerciseCount, 0),
  }))
}

/** То же, что `filterExerciseTree`, но для дерева тренажёров. */
export function filterMachineTree(zones: MachineZoneBranch[], query: string): MachineZoneBranch[] {
  const needle = normalizeQuery(query)
  if (!needle) return zones

  const result: MachineZoneBranch[] = []

  for (const zone of zones) {
    const zoneHit = normalizeQuery(zone.title).includes(needle)
    const machines = zoneHit
      ? zone.machines
      : zone.machines.filter((machine) => normalizeQuery(machine.name).includes(needle))

    if (machines.length > 0) {
      result.push({
        ...zone,
        machines,
        count: machines.reduce((sum, machine) => sum + machine.exerciseCount, 0),
      })
    }
  }

  return result
}

/**
 * Режет текст на куски для подсветки совпадений. Ищем в нормализованной строке:
 * нижний регистр и замена «ё»→«е» длину не меняют, поэтому индексы совпадают.
 */
export function splitMatches(text: string, query: string): MatchPart[] {
  const needle = normalizeQuery(query)
  if (!needle) return [{ text, hit: false }]

  const haystack = normalizeQuery(text)
  const parts: MatchPart[] = []
  let cursor = 0
  let index = haystack.indexOf(needle)

  while (index !== -1) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), hit: false })
    parts.push({ text: text.slice(index, index + needle.length), hit: true })
    cursor = index + needle.length
    index = haystack.indexOf(needle, cursor)
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })

  return parts.length > 0 ? parts : [{ text, hit: false }]
}
