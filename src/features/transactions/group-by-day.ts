import type { IsoDate } from '@/lib/dates'

/**
 * Agrupa por dia mantendo a ordem recebida (a API já devolve do mais recente para o mais antigo).
 * Devolve pares [dia, itens] para iterar facilmente na interface.
 */
export function groupByDay<T extends { data: IsoDate }>(items: T[]): [IsoDate, T[]][] {
  const groups = new Map<IsoDate, T[]>()
  for (const item of items) {
    const group = groups.get(item.data)
    if (group) group.push(item)
    else groups.set(item.data, [item])
  }
  return [...groups]
}
