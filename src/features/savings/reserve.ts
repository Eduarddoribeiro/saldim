import { addMonths, type IsoDate } from '@/lib/dates'
import { monthSummary } from '@/lib/finance'

type Movement = Parameters<typeof monthSummary>[0][number]

/** Meses completos olhados para o gasto médio */
const SPENDING_MONTHS = 3

/**
 * Quanto se gasta por mês, em média, nos últimos meses completos (só gastos seus: compras de outras
 * pessoas não contam). Meses sem nenhum gasto (antes de começar a usar a app) ficam de fora.
 */
export function averageMonthlySpending(movements: Movement[], today: IsoDate): number {
  const current = today.slice(0, 7)
  const totals = Array.from({ length: SPENDING_MONTHS }, (_, i) =>
    monthSummary(movements, addMonths(current, -1 - i)),
  )
    .map((summary) => summary.despesas)
    .filter((total) => total > 0)
  if (totals.length === 0) return 0
  return Math.round(totals.reduce((sum, total) => sum + total, 0) / totals.length)
}
