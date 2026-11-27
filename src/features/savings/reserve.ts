import { addDays, addMonths, type IsoDate } from '@/lib/dates'
import { monthSummary } from '@/lib/finance'

type Movement = Parameters<typeof monthSummary>[0][number]

/** Meses completos olhados para o gasto médio */
const SPENDING_MONTHS = 3

/**
 * Quanto se gasta por mês (só gastos seus: compras de outras pessoas não contam). É o maior de dois
 * números, para não ficar baixo demais com pouco histórico (pedido de 2026-11-27: a meta da reserva
 * saiu pela metade):
 * - a média dos últimos meses completos, sem o mês em que se começou a lançar (fica pela metade)
 *   nem os meses sem gastos;
 * - o que saiu nos últimos 30 dias.
 */
export function averageMonthlySpending(movements: Movement[], today: IsoDate): number {
  const own = movements.filter((movement) => !movement.pessoa_id)
  const firstMonth = own
    .filter((movement) => movement.tipo === 'despesa')
    .map((movement) => movement.data.slice(0, 7))
    .sort()[0]
  const current = today.slice(0, 7)
  const totals = Array.from({ length: SPENDING_MONTHS }, (_, i) => addMonths(current, -1 - i))
    .filter((month) => firstMonth !== undefined && month > firstMonth)
    .map((month) => monthSummary(own, month).despesas)
    .filter((total) => total > 0)
  const average =
    totals.length > 0 ? totals.reduce((sum, total) => sum + total, 0) / totals.length : 0

  const from = addDays(today, -29)
  const last30 = own
    .filter((movement) => movement.data >= from && movement.data <= today)
    .reduce(
      (sum, movement) =>
        sum +
        (movement.tipo === 'despesa'
          ? movement.valor_centavos
          : movement.tipo === 'estorno'
            ? -movement.valor_centavos
            : 0),
      0,
    )
  return Math.round(Math.max(average, last30, 0))
}
