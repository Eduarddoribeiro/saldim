import { describe, expect, it } from 'vitest'
import { accountFormSchema, type AccountFormInput } from './schemas'

const input = (overrides: Partial<AccountFormInput> = {}): AccountFormInput => ({
  nome: 'Conta',
  tipo: 'corrente',
  saldoInicial: '0,00',
  diaFechamento: '',
  diaVencimento: '',
  limite: '',
  contaPagamentoId: '',
  ...overrides,
})
const card = (overrides: Partial<AccountFormInput> = {}) =>
  input({
    nome: 'Cartão',
    tipo: 'cartao_credito',
    diaFechamento: '25',
    diaVencimento: '5',
    limite: '5.000,00',
    contaPagamentoId: 'banco',
    ...overrides,
  })

/** Erros por campo (primeira mensagem de cada um). */
function errors(values: AccountFormInput): Record<string, string> {
  const result = accountFormSchema.safeParse(values)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('accountFormSchema — contas normais', () => {
  it('converte o saldo inicial para centavos e não tem configuração de cartão', () => {
    expect(accountFormSchema.parse(input({ saldoInicial: '-1.234,56' }))).toEqual({
      nome: 'Conta',
      tipo: 'corrente',
      saldoInicial: -123456,
      cartao: null,
    })
  })

  it('ignora campos de cartão que tenham ficado escritos (o formulário esconde-os)', () => {
    expect(
      accountFormSchema.parse(input({ diaFechamento: '31', diaVencimento: '31', limite: 'x' })),
    ).toMatchObject({ cartao: null })
  })

  it('saldo inválido é um erro do campo do saldo', () => {
    expect(errors(input({ saldoInicial: '12,345' }))).toEqual({
      saldoInicial: expect.stringMatching(/Valor inválido/),
    })
  })
})

describe('accountFormSchema — cartão de crédito', () => {
  it('converte dias para números e o limite para centavos; o saldo inicial é sempre 0', () => {
    expect(accountFormSchema.parse(card({ saldoInicial: '999' }))).toEqual({
      nome: 'Cartão',
      tipo: 'cartao_credito',
      saldoInicial: 0,
      cartao: {
        diaFechamento: 25,
        diaVencimento: 5,
        limiteCentavos: 500000,
        contaPagamentoId: 'banco',
      },
    })
  })

  it('um saldo inválido escondido não impede guardar um cartão', () => {
    expect(accountFormSchema.safeParse(card({ saldoInicial: 'abc' })).success).toBe(true)
  })

  it('campos em falta: um erro em cada campo', () => {
    expect(
      errors(card({ diaFechamento: '', diaVencimento: '', limite: '', contaPagamentoId: '' })),
    ).toEqual({
      diaFechamento: 'Escolhe o dia de fechamento.',
      diaVencimento: 'Escolhe o dia de vencimento.',
      limite: 'Indica o valor.',
      contaPagamentoId: 'Escolhe a conta de onde sai o pagamento da fatura.',
    })
  })

  it('aplica as regras dos dias de src/lib/credit-card.ts', () => {
    expect(errors(card({ diaFechamento: '10', diaVencimento: '10' }))).toEqual({
      diaVencimento: 'O vencimento tem de ser num dia diferente do fechamento.',
    })
    expect(Object.keys(errors(card({ diaFechamento: '28', diaVencimento: '30' })))).toEqual([
      'diaFechamento',
    ])
    expect(errors(card({ diaFechamento: '27', diaVencimento: '28' }))).toEqual({})
  })

  it('o limite tem de ser positivo e válido', () => {
    expect(errors(card({ limite: '0' }))).toEqual({ limite: 'O valor tem de ser maior que zero.' })
    expect(errors(card({ limite: '-10' })).limite).toMatch(/Não pode ser negativo/)
  })
})
