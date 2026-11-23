import type { RepeatingExpense } from './repeating'

export type AreaRow = {
  categoryId: string
  /** Quanto vai por mês para esta área */
  mensal: number
  /** Parte do total dos gastos que se repetem (0 a 1) */
  share: number
  /** Os gastos desta área, do maior para o menor */
  nomes: string[]
}

/** Os gastos que se repetem por área (categoria), da que leva mais para a que leva menos. */
export function byArea(items: readonly RepeatingExpense[]): AreaRow[] {
  const total = items.reduce((sum, item) => sum + item.mensal, 0)
  const areas = new Map<string, { mensal: number; nomes: [string, number][] }>()
  for (const item of items) {
    const area = areas.get(item.categoryId) ?? { mensal: 0, nomes: [] }
    area.mensal += item.mensal
    area.nomes.push([item.nome, item.mensal])
    areas.set(item.categoryId, area)
  }
  return [...areas]
    .map(([categoryId, area]) => ({
      categoryId,
      mensal: area.mensal,
      share: total > 0 ? area.mensal / total : 0,
      nomes: area.nomes.sort((a, b) => b[1] - a[1]).map(([nome]) => nome),
    }))
    .sort((a, b) => b.mensal - a.mensal || a.categoryId.localeCompare(b.categoryId))
}
