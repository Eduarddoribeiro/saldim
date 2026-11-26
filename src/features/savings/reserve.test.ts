import { describe, expect, it } from 'vitest'
import { averageMonthlySpending, emergencyReserve } from './reserve'

const mov = (data: string, valor: number, extra: Record<string, unknown> = {}) => ({
  account_id: 'a',
  category_id: 'c',
  tipo: 'despesa' as const,
  valor_centavos: valor,
  data,
  pessoa_id: null,
  ...extra,
})

describe('reserva de emergência', () => {
  it('gasto médio dos 3 últimos meses completos, sem o mês atual nem compras de outras pessoas', () => {
    const movements = [
      mov('2026-08-10', 100000),
      mov('2026-09-10', 150000),
      mov('2026-10-10', 140000),
      mov('2026-10-11', 99999, { pessoa_id: 'mae' }),
      mov('2026-11-10', 999999), // mês atual: não conta
      mov('2026-07-10', 999999), // fora da janela
    ]
    expect(averageMonthlySpending(movements, '2026-11-26')).toBe(130000)
  })

  it('meses sem gastos ficam de fora da média', () => {
    expect(averageMonthlySpending([mov('2026-10-10', 145000)], '2026-11-26')).toBe(145000)
    expect(averageMonthlySpending([], '2026-11-26')).toBe(0)
  })

  it('meta de 3 meses, o que já tem e o que falta', () => {
    expect(emergencyReserve(145000, 100000)).toEqual({
      meta: 435000,
      guardado: 100000,
      falta: 335000,
    })
    expect(emergencyReserve(145000, 500000).falta).toBe(0)
  })
})
