import { describe, expect, it } from 'vitest'
import { transactionFormSchema } from './schemas'

const valid = {
  tipo: 'despesa',
  valor: '42,50',
  data: '2026-10-14',
  categoryId: 'cat-1',
  accountId: 'conta-1',
  descricao: '  Jantar  ',
}

const messages = (input: unknown) =>
  transactionFormSchema.safeParse(input).error?.issues.map((issue) => issue.message) ?? []

describe('transactionFormSchema', () => {
  it('converte o valor para centavos e limpa a descrição', () => {
    expect(transactionFormSchema.parse(valid)).toEqual({
      ...valid,
      valor: 4250,
      descricao: 'Jantar',
    })
  })

  it('descrição é opcional', () => {
    expect(transactionFormSchema.parse({ ...valid, descricao: '' }).descricao).toBe('')
  })

  it('exige valor maior que zero', () => {
    expect(messages({ ...valid, valor: '0' })).toEqual(['O valor tem de ser maior que zero.'])
    expect(messages({ ...valid, valor: '-5' })[0]).toMatch(/Não pode ser negativo/)
  })

  it('exige categoria, conta e data válida', () => {
    expect(messages({ ...valid, categoryId: '', accountId: '', data: '2026-02-30' })).toEqual([
      'Indica uma data válida.',
      'Escolhe uma categoria.',
      'Escolhe uma conta.',
    ])
  })

  it('limita a descrição a 120 caracteres', () => {
    expect(messages({ ...valid, descricao: 'x'.repeat(121) })).toEqual([
      'A descrição pode ter no máximo 120 caracteres.',
    ])
  })
})
