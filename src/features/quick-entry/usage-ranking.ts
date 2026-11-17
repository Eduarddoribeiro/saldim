import { addDays, type IsoDate } from '@/lib/dates'

/** Janela do "mais usado": os últimos 90 dias (docs/features/lancamento-rapido.md, regras 4 e 5). */
export const USAGE_WINDOW_DAYS = 90

type Usage = { data: IsoDate }

/**
 * Quantas vezes cada id aparece nos movimentos dos últimos `days` dias (até hoje, inclusive).
 * Movimentos futuros (parcelas que ainda vêm, lançamentos agendados) não contam: não são escolhas
 * recentes de quem usa a app.
 */
export function usageCounts<T extends Usage>(
  movements: readonly T[],
  idOf: (movement: T) => string | null,
  { today, days = USAGE_WINDOW_DAYS }: { today: IsoDate; days?: number },
): Map<string, number> {
  const since = addDays(today, -days)
  const counts = new Map<string, number>()
  for (const movement of movements) {
    if (movement.data < since || movement.data > today) continue
    const id = idOf(movement)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Ordena pelos mais usados; empates (e os nunca usados) por ordem alfabética. Não altera a lista. */
export function rankByUsage<T extends { id: string; nome: string }>(
  items: readonly T[],
  counts: ReadonlyMap<string, number>,
): T[] {
  return [...items].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}
