import { describe, expect, it } from 'vitest'
import { quickEntrySchema, type QuickEntryInput } from './schema'

const base: QuickEntryInput = {
  tipo: 'despesa',
  valor: '42,90',
  data: '2026-11-17',
  categoryId: 'mercado',
  accountId: 'banco',
  descricao: '',
  parcelas: '1',
  emCurso: false,
  parcelaInicial: '2',
  pessoaId: '',
  novaPessoa: '',
  divisao: 'minha',
  partePessoa: '',
}
const schema = quickEntrySchema(new Set(['visa']))

const errorsOf = (input: QuickEntryInput) => {
  const result = schema.safeParse(input)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('formulário único de lançamento', () => {
  it('conta de dinheiro → transação, em centavos', () => {
    expect(schema.parse(base)).toEqual({
      kind: 'transaction',
      values: {
        tipo: 'despesa',
        valor: 4290,
        data: '2026-11-17',
        categoryId: 'mercado',
        accountId: 'banco',
        descricao: '',
      },
    })
  })

  it('cartão → compra no cartão, com parcelas e pessoa', () => {
    const result = schema.parse({
      ...base,
      accountId: 'visa',
      parcelas: '3',
      divisao: 'pessoa',
      pessoaId: 'ana',
    })
    expect(result).toEqual({
      kind: 'purchase',
      values: expect.objectContaining({
        cardId: 'visa',
        valor: 4290,
        parcelas: 3,
        parcelaInicial: 1,
        pessoaId: 'ana',
      }),
    })
  })

  it('usa as regras de cada tipo e devolve os erros nos campos deste formulário', () => {
    expect(errorsOf({ ...base, categoryId: '', valor: '' })).toEqual({
      categoryId: 'Escolha uma categoria.',
      valor: expect.any(String),
    })
    expect(errorsOf({ ...base, accountId: '' })).toEqual({ accountId: 'Escolha uma conta.' })
    // Regras só da compra no cartão (C4): 1 centavo por parcela; pessoa nova precisa de nome (T1)
    expect(errorsOf({ ...base, accountId: 'visa', valor: '0,02', parcelas: '3' })).toEqual({
      valor: 'O valor não chega para todas as parcelas (1 centavo cada).',
    })
    expect(
      errorsOf({ ...base, accountId: 'visa', divisao: 'pessoa', pessoaId: '__nova__' }),
    ).toEqual({
      novaPessoa: 'Informe o nome da pessoa.',
    })
  })

  it('recusa uma receita num cartão', () => {
    expect(errorsOf({ ...base, tipo: 'receita', accountId: 'visa' })).toEqual({
      accountId: 'Uma receita entra numa conta, não num cartão.',
    })
  })

  it('compra dividida: a parte da pessoa em centavos; a pessoa é obrigatória', () => {
    const cartao = { ...base, accountId: 'visa', valor: '66,66', parcelas: '2' }
    expect(
      schema.parse({ ...cartao, divisao: 'dividida', pessoaId: 'mae', partePessoa: '33,34' }),
    ).toMatchObject({ kind: 'split', valorPessoa: 3334, values: { valor: 6666, pessoaId: 'mae' } })
    expect(errorsOf({ ...cartao, divisao: 'dividida', partePessoa: '33,34' })).toEqual({
      pessoaId: 'Escolha a pessoa.',
    })
    // A parte dela não pode ser o total (sobraria 0 para mim) nem menos de 1 centavo por parcela
    expect(
      errorsOf({ ...cartao, divisao: 'dividida', pessoaId: 'mae', partePessoa: '66,66' }),
    ).toHaveProperty('partePessoa')
    expect(
      errorsOf({ ...cartao, divisao: 'dividida', pessoaId: 'mae', partePessoa: '0,01' }),
    ).toHaveProperty('partePessoa')
  })

  it('"Minha" ignora uma pessoa escolhida antes; "De outra pessoa" leva-a', () => {
    const cartao = { ...base, accountId: 'visa', pessoaId: 'mae' }
    expect(schema.parse({ ...cartao, divisao: 'minha' })).toMatchObject({
      kind: 'purchase',
      values: { pessoaId: '' },
    })
    expect(schema.parse({ ...cartao, divisao: 'pessoa' })).toMatchObject({
      kind: 'purchase',
      values: { pessoaId: 'mae' },
    })
  })
})
