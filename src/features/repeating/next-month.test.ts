import { describe, expect, it } from 'vitest'
import { nextMonthToPay } from './next-month'

const mov = (account_id: string, data: string, valor_centavos: number, tipo = 'despesa') => ({
  account_id,
  data,
  valor_centavos,
  tipo,
})

describe('nextMonthToPay', () => {
  it('junta a minha parte das faturas do mês e as despesas da conta (futuras e previstas)', () => {
    const result = nextMonthToPay({
      month: '2026-12',
      today: '2026-11-26',
      cardMonths: [
        { month: '2026-12', meu: 90000, pessoas: [{ pessoaId: 'mae', centavos: 49418 }] },
        { month: '2027-01', meu: 50000, pessoas: [] },
      ],
      movements: [
        mov('conta', '2026-12-05', 2000), // futura: conta
        mov('conta', '2026-11-20', 9999), // já passou (mês errado)
        mov('cartao', '2026-12-10', 7777), // no cartão: já está na fatura
        mov('conta', '2026-12-15', 100000, 'receita'), // receita não sai
      ],
      projected: [mov('conta', '2026-12-12', 5500), mov('conta', '2027-01-12', 5500)],
      cardIds: new Set(['cartao']),
    })
    // Só a minha parte da fatura; a da mãe fica à parte
    expect(result).toEqual({
      month: '2026-12',
      cartoes: 90000,
      pessoas: [{ pessoaId: 'mae', centavos: 49418 }],
      conta: 7500,
      total: 97500,
    })
  })

  it('sem faturas nem despesas no mês, tudo zero', () => {
    expect(
      nextMonthToPay({
        month: '2026-12',
        today: '2026-11-26',
        cardMonths: [],
        movements: [],
        projected: [],
        cardIds: new Set(),
      }).total,
    ).toBe(0)
  })
})
