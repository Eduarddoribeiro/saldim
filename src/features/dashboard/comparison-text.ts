import { formatMonth, type MonthKey } from '@/lib/dates'
import type { Comparison } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'

/** 'setembro' (mesmo ano do mês de referência) ou 'dezembro de 2025' (ano diferente). */
export function previousMonthLabel(previous: MonthKey, reference: MonthKey): string {
  const label = formatMonth(previous)
  return previous.slice(0, 4) === reference.slice(0, 4) ? label.replace(/ de \d{4}$/, '') : label
}

/**
 * Texto da variação face ao mês anterior. Só descreve números (sem juízos de "bom" ou "mau"):
 * mais despesas e mais receitas aparecem da mesma forma, com sinal e valor.
 *   '+R$ 120,00 (+8%) em relação a setembro' · 'igual a setembro' · 'nada em setembro'
 */
export function comparisonText(
  comparison: Comparison,
  currency: Currency,
  previousLabel: string,
): string {
  if (comparison.diferenca === 0) return `igual a ${previousLabel}`
  const value = formatMoney(comparison.diferenca, currency, { signDisplay: 'always' })
  // Mês anterior a zero: a diferença é o próprio valor (já mostrado ao lado), por isso basta dizê-lo
  if (comparison.percent === null) return `nada em ${previousLabel}`
  const percent = `${comparison.percent > 0 ? '+' : ''}${comparison.percent}%`
  return `${value} (${percent}) em relação a ${previousLabel}`
}
