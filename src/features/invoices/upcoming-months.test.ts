import { describe, expect, it } from 'vitest'
import { upcomingCardMonths } from './upcoming-months'

const item = (valor: number, pessoa: string | null = null, tipo = 'despesa') => ({
  pessoa_id: pessoa,
  valor_centavos: valor,
  tipo,
  compra_id: 'c',
  parcela_numero: 1,
})

const invoice = (
  id: string,
  card: string,
  vencimento: string,
  parcelas: ReturnType<typeof item>[],
  pago = 0,
) => {
  const total = parcelas.reduce(
    (sum, p) => sum + (p.tipo === 'estorno' ? -p.valor_centavos : p.valor_centavos),
    0,
  )
  return {
    id,
    account_id: card,
    data_vencimento: vencimento,
    parcelas,
    totalCentavos: total,
    pagoCentavos: pago,
    emAbertoCentavos: total - pago,
  }
}

describe('upcomingCardMonths', () => {
  it('junta os cartões pelo mês do vencimento e separa o meu do de cada pessoa', () => {
    const months = upcomingCardMonths(
      [
        invoice('n-dez', 'nubank', '2026-12-10', [item(50000), item(20000, 'mae')]),
        invoice('i-dez', 'itau', '2026-12-07', [item(30000), item(5000, 'mae'), item(1000, 'ana')]),
        invoice('n-jan', 'nubank', '2027-01-10', [item(10000, 'mae')]),
      ],
      '2026-11-20',
    )
    expect(months.map((m) => [m.month, m.total, m.meu, m.ultimoVencimento])).toEqual([
      ['2026-12', 106000, 80000, '2026-12-10'],
      ['2027-01', 10000, 0, '2027-01-10'],
    ])
    expect(months[0].pessoas).toEqual([
      { pessoaId: 'mae', centavos: 25000 },
      { pessoaId: 'ana', centavos: 1000 },
    ])
    expect(months[0].cartoes.map((c) => [c.cardId, c.total, c.items.length])).toEqual([
      ['nubank', 70000, 2],
      ['itau', 36000, 3],
    ])
  })

  it('ignora faturas já vencidas e as já pagas; um pagamento adiantado abate a minha parte', () => {
    const months = upcomingCardMonths(
      [
        invoice('velha', 'nubank', '2026-11-10', [item(99999)]),
        invoice('paga', 'itau', '2026-12-07', [item(40000)], 40000),
        invoice('parcial', 'nubank', '2026-12-10', [item(30000), item(10000, 'mae')], 25000),
      ],
      '2026-11-20',
    )
    expect(months).toHaveLength(1)
    expect([months[0].total, months[0].meu, months[0].pessoas]).toEqual([
      15000,
      5000,
      [{ pessoaId: 'mae', centavos: 10000 }],
    ])
  })

  it('a fatura que vence hoje ainda conta; estornos descontam', () => {
    const [month] = upcomingCardMonths(
      [invoice('hoje', 'nubank', '2026-11-20', [item(10000), item(3000, null, 'estorno')])],
      '2026-11-20',
    )
    expect([month.total, month.meu]).toEqual([7000, 7000])
  })
})
