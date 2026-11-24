import { describe, expect, it } from 'vitest'
import { projectedCardCharges, projectRecurring } from './projection'

const rec = (over: Partial<Parameters<typeof projectRecurring>[0][number]> = {}) => ({
  id: 'netflix',
  account_id: 'nubank',
  category_id: 'lazer',
  tipo: 'despesa',
  valor_centavos: 4490,
  descricao: 'Netflix',
  frequencia: 'mensal' as const,
  dia: 12,
  proxima_data: '2026-12-12',
  ativa: true,
  ...over,
})

describe('projectRecurring', () => {
  it('as próximas ocorrências depois de hoje até à data pedida; pausadas não entram', () => {
    const occurrences = projectRecurring(
      [
        rec(),
        rec({
          id: 'aluguel',
          account_id: 'conta',
          descricao: 'Aluguel',
          dia: 30,
          proxima_data: '2026-11-30',
          valor_centavos: 180000,
        }),
        rec({ id: 'pausada', ativa: false }),
      ],
      '2026-11-23',
      '2027-01-31',
    )
    expect(occurrences.map((o) => [o.recurrenceId, o.data])).toEqual([
      ['aluguel', '2026-11-30'],
      ['netflix', '2026-12-12'],
      ['aluguel', '2026-12-30'],
      ['netflix', '2027-01-12'],
      ['aluguel', '2027-01-30'],
    ])
  })

  it('uma ocorrência de hoje ou de antes já é (ou vai ser) lançada: não se prevê', () => {
    expect(
      projectRecurring(
        [rec({ proxima_data: '2026-11-23', dia: 23 })],
        '2026-11-23',
        '2026-12-31',
      ).map((o) => o.data),
    ).toEqual(['2026-12-23'])
  })
})

describe('projectedCardCharges', () => {
  it('põe cada recorrente do cartão na fatura onde vai cair', () => {
    const charges = projectedCardCharges(
      projectRecurring([rec()], '2026-11-23', '2027-01-31'),
      // Nubank: fecha dia 3, vence dia 10
      [{ id: 'nubank', dia_fechamento: 3, dia_vencimento: 10 }],
    )
    expect(charges.map((c) => [c.data, c.vencimento])).toEqual([
      ['2026-12-12', '2027-01-10'],
      ['2027-01-12', '2027-02-10'],
    ])
  })

  it('recorrentes de contas de dinheiro não vão para faturas', () => {
    expect(
      projectedCardCharges(
        projectRecurring([rec({ account_id: 'conta' })], '2026-11-23', '2026-12-31'),
        [{ id: 'conta', dia_fechamento: null, dia_vencimento: null }],
      ),
    ).toEqual([])
  })
})

describe('projectRecurring: só lembrar', () => {
  const corte = rec({
    id: 'corte',
    account_id: 'conta',
    descricao: 'Corte de cabelo',
    dia: 15,
    proxima_data: '2026-12-15',
    valor_centavos: 5000,
    modo: 'lembrar',
    created_at: '2026-10-01T00:00:00Z',
  })

  it('sem pagamento este mês: previsto "atrasado" para amanhã, com o último valor pago', () => {
    const occurrences = projectRecurring([corte], '2026-11-23', '2027-01-31', [
      { descricao: 'Corte de cabelo', tipo: 'despesa', valor_centavos: 5500, data: '2026-10-12' },
    ])
    expect(occurrences.map((o) => [o.data, o.valor_centavos, o.lembrar, o.atrasado])).toEqual([
      ['2026-11-24', 5500, true, true],
      ['2026-12-15', 5500, true, false],
      ['2027-01-15', 5500, true, false],
    ])
  })

  it('um lançamento com o mesmo nome no mês dá esse mês como pago, seja qual for o dia', () => {
    const occurrences = projectRecurring([corte], '2026-11-23', '2026-12-31', [
      { descricao: 'Corte de Cabelo!', tipo: 'despesa', valor_centavos: 6000, data: '2026-11-03' },
    ])
    expect(occurrences.map((o) => [o.data, o.valor_centavos])).toEqual([['2026-12-15', 6000]])
  })

  it('assinatura em dólar (dia fixo, valor varia): usa o valor da última cobrança', () => {
    const claude = rec({
      id: 'claude',
      descricao: 'Claude',
      dia: 28,
      proxima_data: '2026-11-28',
      modo: 'lembrar',
      valor_centavos: 10000,
    })
    const [proxima] = projectRecurring([claude], '2026-11-23', '2026-11-30', [
      {
        descricao: 'CLAUDE.AI SUBSCRIPTION',
        tipo: 'despesa',
        valor_centavos: 11873,
        data: '2026-10-28',
      },
    ])
    // "claude ai" ≠ "claude": nomes diferentes não se juntam; com o mesmo nome, sim
    expect(proxima.valor_centavos).toBe(10000)
    const [igual] = projectRecurring([claude], '2026-11-23', '2026-11-30', [
      { descricao: 'Claude', tipo: 'despesa', valor_centavos: 11873, data: '2026-10-28' },
    ])
    expect([igual.data, igual.valor_centavos, igual.atrasado]).toEqual(['2026-11-28', 11873, false])
  })
})
