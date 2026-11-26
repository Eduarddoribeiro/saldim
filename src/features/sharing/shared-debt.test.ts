import { describe, expect, it } from 'vitest'
import { ownerLabel, sharedSpendingByCategory, summarizeSharedDebt } from './shared-debt'
import type { SharedDebt } from './sharing-api'

const parcela = (fatura: string, valor: number, data: string) => ({
  tipo: 'despesa' as const,
  valor_centavos: valor,
  data,
  account_id: 'visa',
  fatura_id: fatura,
  compra_id: 'sofa',
  pessoa_id: 'mae',
})

const debt = (patch: Partial<SharedDebt> = {}): SharedDebt => ({
  pessoaId: 'mae',
  pessoaNome: 'Mãe',
  donoNome: 'Edu',
  dividaAnterior: 0,
  compras: [],
  movimentos: [parcela('out', 10000, '2026-09-28'), parcela('nov', 10000, '2026-10-28')],
  faturas: [
    { id: 'out', data_vencimento: '2026-10-10' },
    { id: 'nov', data_vencimento: '2026-11-10' },
  ],
  cartoes: [],
  categorias: [],
  reembolsos: [],
  donoChavePix: null,
  ...patch,
})

describe('summarizeSharedDebt', () => {
  it('separa o já vencido do que vem, como em A receber', () => {
    expect(summarizeSharedDebt(debt(), '2026-10-20')).toEqual({
      total: 20000,
      vencido: 10000,
      futuro: 10000,
    })
  })

  it('os pagamentos abatem primeiro o vencido; a dívida anterior conta como vencida', () => {
    const result = summarizeSharedDebt(
      debt({
        dividaAnterior: 5000,
        reembolsos: [{ id: 'r', valor_centavos: 3000, data: '2026-10-15', descricao: '' }],
      }),
      '2026-10-20',
    )
    expect(result).toEqual({ total: 22000, vencido: 12000, futuro: 10000 })
  })

  it('sem nada: em dia', () => {
    expect(summarizeSharedDebt(debt({ movimentos: [] }), '2026-10-20')).toEqual({
      total: 0,
      vencido: 0,
      futuro: 0,
    })
  })
})

describe('ownerLabel', () => {
  it('usa o nome de quem convidou, ou uma descrição', () => {
    expect(ownerLabel({ donoNome: 'Edu' })).toBe('Edu')
    expect(ownerLabel({ donoNome: ' ' })).toBe('quem te emprestou o cartão')
  })
})

describe('sharedSpendingByCategory', () => {
  it('soma as compras por categoria, da maior para a menor, com os nomes', () => {
    const compra = (id: string, category_id: string, descricao: string, valor: number) => ({
      id,
      account_id: 'visa',
      category_id,
      descricao,
      data_compra: '2026-10-01',
      valor_total_centavos: valor,
      parcelas: 1,
      parcela_inicial: 1,
      pessoa_id: 'mae',
    })
    const rows = sharedSpendingByCategory({
      compras: [
        compra('a', 'lazer', 'Show', 32000),
        compra('b', 'compras', 'Celular', 179880),
        compra('c', 'compras', 'Passagem', 18900),
        compra('d', 'compras', 'Celular', 100),
      ],
    })
    expect(rows.map((row) => [row.categoryId, row.total, row.nomes])).toEqual([
      ['compras', 198880, ['Celular', 'Passagem']],
      ['lazer', 32000, ['Show']],
    ])
    expect(rows[0].share + rows[1].share).toBeCloseTo(1)
  })
})
