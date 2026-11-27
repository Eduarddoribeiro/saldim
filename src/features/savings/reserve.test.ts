import { describe, expect, it } from 'vitest'
import { averageMonthlySpending } from './reserve'

const mov = (data: string, valor: number, extra: Record<string, unknown> = {}) => ({
  account_id: 'a',
  category_id: 'c',
  tipo: 'despesa' as const,
  valor_centavos: valor,
  data,
  pessoa_id: null,
  ...extra,
})

describe('gasto do mês (para a reserva)', () => {
  it('média dos 3 últimos meses completos, sem o mês atual nem compras de outras pessoas', () => {
    const movements = [
      mov('2026-07-10', 5000), // primeiro mês (pela metade): não conta
      mov('2026-08-10', 100000),
      mov('2026-09-10', 150000),
      mov('2026-10-10', 140000),
      mov('2026-10-11', 99999, { pessoa_id: 'mae' }),
      mov('2026-11-02', 1000), // mês atual (só conta nos últimos 30 dias)
    ]
    expect(averageMonthlySpending(movements, '2026-11-26')).toBe(130000)
  })

  it('o mês em que se começou a lançar não puxa a média para baixo', () => {
    const movements = [mov('2026-09-25', 10000), mov('2026-10-10', 145000)]
    expect(averageMonthlySpending(movements, '2026-11-26')).toBe(145000)
  })

  it('com pouco histórico, usa o que saiu nos últimos 30 dias se for maior', () => {
    // Começou em outubro: a média não tem meses completos; nos últimos 30 dias saíram 1.450
    const movements = [
      mov('2026-10-20', 20000),
      mov('2026-10-28', 80000),
      mov('2026-11-10', 65000),
      mov('2026-11-12', 5000, { tipo: 'estorno' }),
    ]
    expect(averageMonthlySpending(movements, '2026-11-26')).toBe(80000 + 65000 - 5000)
  })

  it('sem gastos, zero', () => {
    expect(averageMonthlySpending([], '2026-11-26')).toBe(0)
  })
})
