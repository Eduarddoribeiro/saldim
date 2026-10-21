import { describe, expect, it } from 'vitest'
import { NEW_PERSON, purchaseFormSchema, type PurchaseFormInput } from './schemas'

const base: PurchaseFormInput = {
  cardId: 'c1',
  valor: '100,00',
  parcelas: '3',
  data: '2026-10-10',
  categoryId: 'alim',
  descricao: '  Televisão ',
  emCurso: false,
  parcelaInicial: '2',
  pessoaId: '',
  novaPessoa: '',
}

const errorsOf = (input: PurchaseFormInput) => {
  const result = purchaseFormSchema.safeParse(input)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]))
}

describe('purchaseFormSchema', () => {
  it('converte para centavos e números; uma compra nova começa na parcela 1', () => {
    expect(purchaseFormSchema.parse(base)).toEqual({
      cardId: 'c1',
      valor: 10000,
      parcelas: 3,
      data: '2026-10-10',
      categoryId: 'alim',
      descricao: 'Televisão',
      parcelaInicial: 1,
      pessoaId: '',
      novaPessoa: '',
    })
  })

  it('compra em andamento: guarda a primeira parcela por pagar (2 a n)', () => {
    expect(purchaseFormSchema.parse({ ...base, emCurso: true, parcelaInicial: '3' })).toMatchObject(
      {
        parcelas: 3,
        parcelaInicial: 3,
      },
    )
    expect(errorsOf({ ...base, emCurso: true, parcelaInicial: '4' })).toEqual({
      parcelaInicial: 'Escolha uma parcela entre 2 e 3.',
    })
    expect(errorsOf({ ...base, parcelas: '1', emCurso: true })).toEqual({
      parcelaInicial: 'Uma compra em andamento tem pelo menos 2 parcelas.',
    })
  })

  it('recusa o que a base de dados recusaria', () => {
    expect(errorsOf({ ...base, valor: '0,02' })).toEqual({
      valor: 'O valor não chega para todas as parcelas (1 centavo cada).',
    })
    expect(errorsOf({ ...base, valor: '0' })).toHaveProperty('valor')
    expect(errorsOf({ ...base, parcelas: '49' })).toEqual({ parcelas: 'De 1 a 48 parcelas.' })
    expect(errorsOf({ ...base, parcelas: '0' })).toEqual({ parcelas: 'De 1 a 48 parcelas.' })
    expect(errorsOf({ ...base, data: '3000-01-01' })).toEqual({ data: 'Informe uma data válida.' })
    expect(errorsOf({ ...base, data: '' })).toEqual({ data: 'Informe uma data válida.' })
    expect(errorsOf({ ...base, cardId: '' })).toEqual({ cardId: 'Escolha o cartão.' })
    expect(errorsOf({ ...base, categoryId: '' })).toEqual({ categoryId: 'Escolha uma categoria.' })
    expect(errorsOf({ ...base, descricao: 'x'.repeat(121) })).toHaveProperty('descricao')
  })

  it('T1: uma pessoa nova precisa do nome; a pessoa passa para o resultado', () => {
    expect(errorsOf({ ...base, pessoaId: NEW_PERSON })).toEqual({
      novaPessoa: 'Informe o nome da pessoa.',
    })
    expect(
      purchaseFormSchema.parse({ ...base, pessoaId: NEW_PERSON, novaPessoa: ' Mãe ' }),
    ).toMatchObject({
      pessoaId: NEW_PERSON,
      novaPessoa: 'Mãe',
    })
    expect(purchaseFormSchema.parse({ ...base, pessoaId: 'p1' }).pessoaId).toBe('p1')
  })
})
