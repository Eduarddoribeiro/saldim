import { describe, expect, it } from 'vitest'
import { ownerLabel, summarizeSharedDebt } from './shared-debt'
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
